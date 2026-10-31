'use strict';
/**
 * Fastboot 管理器
 *
 * Fastboot 是 Android 的底层刷机模式（俗称"线刷模式"）。
 * 与 adb 不同，它不走 shell，而是直接与 bootloader 通信，功能更底层：
 * 刷入 boot/recovery 镜像、刷 OTA 包、解锁 bootloader、清除数据等。
 *
 * 注意：fastboot 工具随 Google SDK Platform-Tools 一起分发，
 * 通常与 adb.exe 位于同一目录，因此优先复用 adb 的定位结果。
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const FASTBOOT_EXEC = 'fastboot.exe';

/**
 * 高风险操作清单 —— UI 需要据此做二次确认
 * level: 'warn' 需确认 | 'danger' 需二次确认并强提示
 */
const RISKY_OPERATIONS = {
  'flashing unlock': { level: 'danger', label: '解锁 Bootloader', note: '会清除手机全部数据，且可能导致银行/支付类应用无法使用' },
  'flashing lock': { level: 'warn', label: '锁定 Bootloader', note: '重新锁定会清除数据并移除自定义 Recovery' },
  'erase userdata': { level: 'danger', label: '清除用户数据', note: '等同于恢复出厂设置，所有资料会丢失' },
  'erase cache': { level: 'warn', label: '清除缓存分区', note: '会删除缓存数据，不影响用户资料' },
  '-w': { level: 'danger', label: '格式化 + 恢复出厂', note: '清空所有数据并恢复出厂设置' },
  'flash boot': { level: 'warn', label: '刷入 boot 镜像', note: '镜像不匹配可能导致无法开机' },
  'flash recovery': { level: 'warn', label: '刷入 recovery 镜像', note: '镜像不匹配可能导致无法进入 Recovery' },
  'flash vbmeta': { level: 'warn', label: '刷入 vbmeta 镜像', note: '错误的 vbmeta 可能导致无法开机' },
  'flash zip': { level: 'warn', label: '刷入 ZIP 包', note: '请确认包与机型匹配' },
  'boot': { level: 'warn', label: '临时启动镜像', note: '仅本次启动生效，重启后失效' }
};

class FastbootManager {
  constructor({ logger, config, adb }) {
    this.logger = logger;
    this.config = config;
    this.adb = adb;
    this.resolved = null; // { exe, source }
    this.PROBE_COOLDOWN = 5000;
    this.lastProbe = null;
  }

  get isWindows() {
    return process.platform === 'win32';
  }

  get fastbootExeName() {
    return this.isWindows ? FASTBOOT_EXEC : 'fastboot';
  }

  /**
   * 定位 fastboot 可执行文件
   * 优先：与已定位的 adb 同目录 → PATH → 常见目录 → SDK 目录
   */
  async locate({ force = false } = {}) {
    if (this.resolved && !force) return { ok: true, ...this.resolved };

    const now = Date.now();
    if (!force && this.lastProbe && now - this.lastProbe.at < this.PROBE_COOLDOWN) {
      return this.lastProbe.result;
    }

    const candidates = [];

    // 0) 设置里手动指定的路径（优先级最高）
    const manual = (this.config.get('fastbootPath') || '').trim();
    if (manual) candidates.push({ exe: manual, source: '手动指定' });

    // 1) 与 adb 同目录 —— 需先确保 adb 已定位，才能拿到目录
    if (this.adb) {
      if (!this.adb.resolved) {
        await this.adb.locate({ allowDownload: false });
      }
      if (this.adb.resolved && this.adb.resolved.exe) {
        const dir = path.dirname(this.adb.resolved.exe);
        candidates.push({ exe: path.join(dir, this.fastbootExeName), source: '与 adb 同目录' });
        // 少数环境用脚本包装器，也一并尝试
        for (const ext of ['.bat', '.cmd']) {
          candidates.push({
            exe: path.join(dir, 'fastboot' + ext),
            source: '与 adb 同目录（脚本包装）'
          });
        }
      }
    }

    // 2) PATH
    const which = this._whichFastboot();
    if (which) candidates.push(which);

    // 3) SDK / 常见目录
    const sdkRoots = [
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
      process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Android', 'Sdk') : null
    ].filter(Boolean);
    for (const root of sdkRoots) {
      candidates.push({
        exe: path.join(root, 'platform-tools', this.fastbootExeName),
        source: 'SDK 目录'
      });
    }
    if (this.adb && this.adb.bundledAdb) {
      candidates.push({
        exe: path.join(path.dirname(this.adb.bundledAdb), this.fastbootExeName),
        source: '内置 platform-tools'
      });
    }
    const common = [
      path.join('C:\\', 'platform-tools'),
      path.join('C:\\', 'adb'),
      path.join('C:\\', 'Program Files', 'platform-tools')
    ];
    for (const dir of common) {
      candidates.push({ exe: path.join(dir, this.fastbootExeName), source: '常见目录' });
    }

    for (const c of candidates) {
      try {
        if (fs.existsSync(c.exe) && fs.statSync(c.exe).isFile()) {
          this.resolved = { exe: c.exe, source: c.source };
          this.logger.info(`找到 fastboot：${c.exe}`, { source: c.source });
          // 验证可执行性
          const res = await this._raw(['version'], 10000);
          if (res.code !== 0) {
            this.logger.warn('fastboot 无法执行', { stderr: res.stderr, error: res.error });
            this.resolved = null;
            continue;
          }
          const version = (res.stdout || '').split('\n')[0].trim();
          const result = { ok: true, ...this.resolved, version };
          this.lastProbe = { at: Date.now(), result };
          return result;
        }
      } catch (_) {}
    }

    this.logger.warn('未找到 fastboot 可执行文件');
    const result = {
      ok: false,
      error: '未找到 fastboot。它随 Google SDK Platform-Tools 一起分发，' +
        '请安装完整 platform-tools，或在设置中手动指定路径。'
    };
    this.lastProbe = { at: Date.now(), result };
    return result;
  }

  _whichFastboot() {
    const pathEnv = process.env.PATH || '';
    const exts = this.isWindows ? (process.env.PATHEXT || '.EXE').split(';') : [''];
    const dirs = pathEnv.split(this.isWindows ? ';' : ':').filter(Boolean);
    for (const dir of dirs) {
      for (const ext of exts) {
        const p = path.join(dir, this.fastbootExeName + ext.toLowerCase());
        try {
          if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            return { exe: p, source: '系统 PATH' };
          }
        } catch (_) {}
      }
    }
    return null;
  }

  /** 底层执行 */
  _raw(args, timeout = 60000, onData) {
    return new Promise((resolve) => {
      if (!this.resolved) {
        resolve({ code: -1, stdout: '', stderr: '', error: 'fastboot 未就绪' });
        return;
      }
      let child;
      try {
        // Windows 下 .bat/.cmd 不能被直接 spawn，必须经由 cmd.exe
        const isBatch = /\.(bat|cmd)$/i.test(this.resolved.exe);
        const realExe = isBatch ? (this.isWindows ? 'cmd.exe' : '/bin/sh') : this.resolved.exe;
        const realArgs = isBatch
          ? (this.isWindows ? ['/c', this.resolved.exe, ...args] : [this.resolved.exe, ...args])
          : args;
        child = spawn(realExe, realArgs, { windowsHide: true });
      } catch (e) {
        resolve({ code: -1, stdout: '', stderr: '', error: e.message });
        return;
      }
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill(); } catch (_) {}
        resolve({ code: -1, stdout, stderr, error: `命令超时（${timeout}ms）` });
      }, timeout);

      child.stdout.on('data', (d) => {
        const s = d.toString('utf8');
        stdout += s;
        if (onData) onData(s, 'stdout');
      });
      child.stderr.on('data', (d) => {
        const s = d.toString('utf8');
        stderr += s;
        if (onData) onData(s, 'stderr');
      });
      child.on('error', (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code: -1, stdout, stderr, error: e.message });
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code: code === null ? -1 : code, stdout, stderr });
      });
    });
  }

  /**
   * 执行 fastboot 命令
   * @param {string[]} args
   */
  async exec(args, opts = {}) {
    const { timeout = 60000, onData, label } = opts;
    const loc = await this.locate();
    if (!loc.ok) {
      return { code: -1, stdout: '', stderr: '', error: loc.error };
    }
    const cmd = `${this.resolved.exe} ${args.join(' ')}`;
    this.logger.info('执行 fastboot 命令', { cmd });
    const res = await this._raw(args, timeout, onData);
    if (label) {
      if (res.code === 0) this.logger.info(`${label} 完成`);
      else this.logger.warn(`${label} 失败`, { code: res.code, stderr: res.stderr, error: res.error });
    }
    return res;
  }

  /**
   * 列出 fastboot 模式设备
   * 输出形如：
   *   XXXXXXXX	fastboot
   */
  async listDevices() {
    const res = await this.exec(['devices'], { timeout: 15000 });
    if (res.code !== 0) {
      this.logger.warn('fastboot devices 失败', { code: res.code, stderr: res.stderr, error: res.error });
      return [];
    }
    const devices = [];
    for (const line of (res.stdout || '').split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      const m = t.match(/^(\S+)\s+(fastboot|offline|no permissions[^\s]*|unauthorized)\b(.*)$/);
      if (!m) continue;
      const [, serial, state, rest] = m;
      devices.push({
        serial,
        state,
        stateText: { fastboot: '已连接', offline: '离线', unauthorized: '未授权' }[state] || state,
        product: (rest.match(/product:(\S+)/) || [])[1] || '',
        variant: (rest.match(/variant:(\S+)/) || [])[1] || ''
      });
    }
    this.logger.info(`fastboot 设备数：${devices.length}`, {
      devices: devices.map((d) => `${d.serial}(${d.state})`)
    });
    return devices;
  }

  /**
   * 读取设备信息（getvar all）
   * fastboot 的 getvar 输出走 stderr，需要合并解析
   */
  async getDeviceInfo(serial) {
    const res = await this.exec(['-s', serial, 'getvar', 'all'], { timeout: 20000 });
    const text = (res.stdout || '') + (res.stderr || '');
    const info = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\(bootloader\)\s*([\w-]+):\s*(.+?)\s*$/);
      if (m) info[m[1]] = m[2];          // m[0]=整行 m[1]=键 m[2]=值
      else {
        const m2 = line.match(/^([\w-]+):\s*(.+?)\s*$/);
        if (m2 && !/fastboot|Finished|total time/i.test(m2[1])) info[m2[1]] = m2[2];
      }
    }
    return { ok: res.code === 0, info, raw: text.trim() };
  }

  /**
   * 执行一个操作
   * @param {string} serial
   * @param {string} action  操作标识，如 'flash boot' / 'reboot' / 'flashing unlock'
   * @param {string[]} extra 额外参数，如镜像路径
   */
  async perform(serial, action, extra = []) {
    const args = ['-s', serial, ...action.split(' '), ...extra];
    this.logger.info(`fastboot 操作：${action}`, { serial, extra });
    const res = await this.exec(args, { timeout: 180000, label: action });
    const output = ((res.stdout || '') + (res.stderr || '')).trim();
    return {
      ok: res.code === 0,
      code: res.code,
      message: this.explainOutput(output, res.code),
      output
    };
  }

  /** 把 fastboot 输出翻译成中文提示 */
  explainOutput(output, code) {
    if (code === 0) {
      if (/FAILED|error:/i.test(output)) {
        return '命令已执行，但输出中包含错误信息';
      }
      if (/OKAY/.test(output)) return '操作成功';
      return '操作已执行';
    }
    if (/unlocked/i.test(output)) return '设备处于解锁状态';
    if (/device unauthorized/i.test(output)) {
      return '设备未授权。请在屏幕上确认 bootloader 解锁许可';
    }
    if (/no devices\/emulators found/i.test(output)) {
      return '未检测到 fastboot 设备。请确认手机已进入 fastboot 模式';
    }
    if (/FAILED \(remote: '.*locked/i.test(output)) {
      return '设备 Bootloader 已锁定，无法刷写。请先解锁 Bootloader';
    }
    if (/FAILED \(remote: '.*unlocked/i.test(output)) {
      return '设备 Bootloader 已解锁';
    }
    if (/too small|invalid.*image|bad.*signature/i.test(output)) {
      return '镜像无效或与机型不匹配，请确认镜像来源与机型';
    }
    if (/timeout/i.test(output)) {
      return '设备无响应，请尝试拔插数据线后重试';
    }
    const first = output.split('\n').filter(Boolean)[0] || '';
    return first ? `操作失败：${first.trim()}` : '操作失败';
  }

  /** 风险等级查询（供 UI 做二次确认） */
  getRisk(action) {
    return RISKY_OPERATIONS[action] || null;
  }
}

module.exports = { FastbootManager, RISKY_OPERATIONS };

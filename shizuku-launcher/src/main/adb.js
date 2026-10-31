'use strict';
/**
 * ADB 管理器
 * - 定位：手动指定 > 环境变量 > PATH > 常见安装目录 > 内置 platform-tools
 * - 下载：Google 官方 platform-tools zip，解压到 resources/platform-tools
 * - 执行：统一封装 spawn，带超时、编码、stdout/stderr 捕获
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const ADB_EXEC = 'adb.exe';
const ADB_UNIX = 'adb';

class AdbManager {
  constructor({ logger, config, resourcesDir }) {
    this.logger = logger;
    this.config = config;
    this.resourcesDir = resourcesDir;
    this.bundledDir = path.join(resourcesDir, 'platform-tools');
    this.bundledAdb = path.join(this.bundledDir, ADB_EXEC);
    this.resolved = null;   // { exe, source, version }
    this.adbServer = null;  // 复用的 adb server 进程句柄
    this.lastProbe = null;  // 上次探测结果（用于冷却）
    this.PROBE_COOLDOWN = 5000; // 探测冷却窗口（毫秒）
  }

  get isWindows() {
    return process.platform === 'win32';
  }

  get adbExeName() {
    return this.isWindows ? ADB_EXEC : ADB_UNIX;
  }

  /** 候选路径列表（按优先级） */
  _candidates() {
    const out = [];
    const manual = (this.config.get('adbPath') || '').trim();
    if (manual) out.push({ exe: manual, source: '手动指定' });

    // 环境变量
    const sdkRoots = [
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT,
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
      process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Android', 'Sdk') : null
    ].filter(Boolean);
    for (const root of sdkRoots) {
      out.push({ exe: path.join(root, 'platform-tools', this.adbExeName), source: 'SDK 目录' });
    }

    // 常见第三方安装位置
    const common = [
      path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools'),
      path.join(os.homedir(), 'platform-tools'),
      path.join(os.homedir(), 'adb'),
      path.join('C:\\', 'platform-tools'),
      path.join('C:\\', 'adb'),
      path.join('C:\\', 'Program Files', 'platform-tools'),
      path.join('C:\\', 'Program Files (x86)', 'platform-tools'),
      path.join('C:\\', 'Program Files', 'Android', 'android-sdk', 'platform-tools'),
      path.join('C:\\', 'Program Files (x86)', 'Android', 'android-sdk', 'platform-tools'),
      path.join('C:\\', 'Android', 'platform-tools'),
      path.join('C:\\', 'Program Files', 'MuMu', 'emulator', 'nemu', 'vmonitor', 'bin'),
      path.join('C:\\', 'Program Files', 'Netease', 'MuMuPlayer', 'shell')
    ];
    for (const dir of common) {
      out.push({ exe: path.join(dir, this.adbExeName), source: '常见目录' });
    }

    // 内置
    out.push({ exe: this.bundledAdb, source: '内置' });

    return out;
  }

  /** 在 PATH 中查找 */
  _whichAdb() {
    const pathEnv = process.env.PATH || '';
    const exts = this.isWindows
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
      : [''];
    const dirs = pathEnv.split(this.isWindows ? ';' : ':').filter(Boolean);
    for (const dir of dirs) {
      for (const ext of exts) {
        const p = path.join(dir, this.adbExeName + ext.toLowerCase());
        const p2 = ext ? path.join(dir, this.adbExeName + ext) : p;
        for (const cand of new Set([p2, p])) {
          try {
            if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
              return { exe: cand, source: '系统 PATH' };
            }
          } catch (_) {}
        }
      }
    }
    return null;
  }

  /**
   * 定位 adb。找不到时可选自动下载。
   * 带冷却窗口，避免短时间内反复探测刷屏日志。
   * @returns {Promise<{ok:boolean, adb?:string, source?:string, version?:string, error?:string}>}
   */
  async locate({ allowDownload = true, force = false } = {}) {
    // 已就绪且非强制，直接复用
    if (this.resolved && !force) {
      return { ok: true, ...this.resolved };
    }

    // 冷却：短时间内重复探测只返回上次结果
    const now = Date.now();
    if (!force && this.lastProbe && now - this.lastProbe.at < this.PROBE_COOLDOWN) {
      return this.lastProbe.result;
    }

    this.resolved = null;

    // 1) PATH
    const which = this._whichAdb();
    if (which) {
      this.logger.info(`找到 adb：${which.exe}`, { source: which.source });
      this.resolved = { exe: which.exe, source: which.source };
    } else {
      // 2) 候选路径
      for (const c of this._candidates()) {
        try {
          if (fs.existsSync(c.exe) && fs.statSync(c.exe).isFile()) {
            this.logger.info(`找到 adb：${c.exe}`, { source: c.source });
            this.resolved = { exe: c.exe, source: c.source };
            break;
          }
        } catch (_) {}
      }
    }

    if (!this.resolved) {
      this.logger.warn('未找到可用的 adb');
      if (!allowDownload || !this.config.get('autoDownloadAdb', true)) {
        const result = { ok: false, error: '未找到 adb，且未启用自动下载' };
        this.lastProbe = { at: Date.now(), result };
        return result;
      }
      this.logger.info('开始自动下载 Google 官方 platform-tools…');
      const dl = await this.downloadPlatformTools();
      if (!dl.ok) {
        const result = { ok: false, error: dl.error || 'adb 下载失败' };
        this.lastProbe = { at: Date.now(), result };
        return result;
      }
      this.resolved = { exe: this.bundledAdb, source: '内置（自动下载）' };
    }

    // 3) 验证可用性
    const ver = await this.exec(['version'], { timeout: 10000 });
    if (ver.code !== 0) {
      this.logger.error('adb 无法执行', { stderr: ver.stderr });
      return { ok: false, error: '找到 adb 但无法执行：' + (ver.stderr || ver.error || '未知错误') };
    }
    const version = (ver.stdout || '').split('\n')[0].trim();
    this.resolved.version = version;
    this.logger.info(`adb 就绪：${version}`, { path: this.resolved.exe });
    const result = { ok: true, ...this.resolved, version };
    this.lastProbe = { at: Date.now(), result };
    return result;
  }

  /** 下载并解压 platform-tools */
  async downloadPlatformTools(onProgress) {
    const url = this.config.get(
      'platformToolsMirror',
      'https://dl.google.com/android/repository/platform-tools-latest-windows.zip'
    );
    const tmpZip = path.join(os.tmpdir(), `platform-tools-${Date.now()}.zip`);
    try {
      await this._download(url, tmpZip, onProgress);
      this.logger.info('platform-tools 下载完成，开始解压…', { url, tmpZip });

      // 解压：用系统 tar（Win10+ 内置），失败则回退 PowerShell Expand-Archive
      const ok = await this._extract(tmpZip, this.resourcesDir);
      if (!ok) {
        return { ok: false, error: '解压 platform-tools 失败' };
      }

      if (!fs.existsSync(this.bundledAdb)) {
        return { ok: false, error: '解压后未找到 adb.exe：' + this.bundledAdb };
      }
      this.logger.info('内置 adb 安装完成', { path: this.bundledAdb });
      return { ok: true, path: this.bundledAdb };
    } catch (e) {
      this.logger.error('platform-tools 下载/解压失败', { error: e.message, url });
      return { ok: false, error: e.message };
    } finally {
      try { if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip); } catch (_) {}
    }
  }

  _download(url, dest, onProgress) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 60000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          this._download(res.headers.location, dest, onProgress).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        let lastEmit = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          const now = Date.now();
          if (onProgress && now - lastEmit > 200) {
            lastEmit = now;
            onProgress({
              received,
              total,
              percent: total ? Math.round((received / total) * 100) : 0
            });
          }
        });
        const out = fs.createWriteStream(dest);
        pipeline(res, out).then(resolve, reject);
      });
      req.on('timeout', () => req.destroy(new Error('下载超时')));
      req.on('error', reject);
    });
  }

  async _extract(zipPath, targetDir) {
    // 优先用系统 tar
    try {
      const { code, stderr } = await this._raw(
        'tar',
        ['-xf', zipPath, '-C', targetDir],
        120000
      );
      if (code === 0) return true;
      this.logger.warn('tar 解压失败，尝试 PowerShell', { stderr });
    } catch (e) {
      this.logger.warn('tar 不可用，尝试 PowerShell', { error: e.message });
    }
    // PowerShell 回退
    try {
      const { code, stderr } = await this._raw(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`
        ],
        180000
      );
      return code === 0 ? true : (this.logger.error('PowerShell 解压失败', { stderr }), false);
    } catch (e) {
      this.logger.error('解压完全失败', { error: e.message });
      return false;
    }
  }

  /** 底层 spawn */
  _raw(exe, args, timeout = 30000, onData) {
    return new Promise((resolve) => {
      let child;
      // Windows 下 .bat/.cmd 不能被直接 spawn，必须经由 cmd.exe
      const isBatch = /\.(bat|cmd)$/i.test(exe);
      const realExe = isBatch ? (this.isWindows ? 'cmd.exe' : '/bin/sh') : exe;
      const realArgs = isBatch
        ? (this.isWindows ? ['/c', exe, ...args] : [exe, ...args])
        : args;
      try {
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
   * 执行 adb 命令
   * @param {string[]} args
   */
  async exec(args, opts = {}) {
    const { timeout = 30000, onData, label } = opts;
    let target = this.resolved ? this.resolved.exe : null;
    if (!target) {
      // 仅尝试一次探测，避免每次调用都重复走完整探测流程
      const loc = await this.locate({ allowDownload: false });
      if (!loc.ok) return { code: -1, stdout: '', stderr: '', error: loc.error };
      target = loc.exe;
    }
    const cmd = `${target} ${args.join(' ')}`;
    this.logger.debug('执行 adb 命令', { cmd });
    const res = await this._raw(target, args, timeout, onData);
    if (label) {
      if (res.code === 0) this.logger.debug(`${label} 成功`);
      else this.logger.warn(`${label} 失败`, { code: res.code, stderr: res.stderr, error: res.error });
    }
    return res;
  }

  /** 启动/连接 adb server（避免每次命令都重启） */
  async startServer() {
    if (this.adbServer && this.adbServer.exitCode === null) return true;
    const res = await this.exec(['start-server'], { timeout: 20000 });
    if (res.code === 0) {
      this.logger.info('adb server 已启动');
      return true;
    }
    this.logger.warn('adb server 启动返回非零', { code: res.code, stderr: res.stderr });
    return false;
  }
}

module.exports = { AdbManager };

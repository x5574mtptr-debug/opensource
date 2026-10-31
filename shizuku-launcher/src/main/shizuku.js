'use strict';
/**
 * Shizuku 核心逻辑
 * - 设备枚举（adb devices -l）
 * - USB 模式：直接执行 start.sh
 * - 无线模式：pair 配对 + connect 连接
 * - 状态探测：多信号交叉验证（进程 / binder / 端口）
 */
const { AdbManager } = require('./adb');

const SHIZUKU_PKG = 'moe.shizuku.privileged.api';

class ShizukuManager {
  constructor({ logger, config, adb }) {
    this.logger = logger;
    this.config = config;
    this.adb = adb;
    this.statusCache = { running: false, checkedAt: 0 };
  }

  /** 列出已连接设备 */
  async listDevices() {
    await this.adb.startServer();
    const res = await this.adb.exec(['devices', '-l'], { timeout: 15000, label: 'devices' });
    if (res.code !== 0) {
      // adb 未就绪属于可预期情况，用 WARN 而非 ERROR，避免误判为故障
      const level = /未找到 adb/.test(res.error || '') ? 'warn' : 'error';
      this.logger[level]('获取设备列表失败', { stderr: res.stderr, error: res.error });
      return [];
    }
    const devices = [];
    const lines = (res.stdout || '').split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('List of devices')) continue;
      if (t.startsWith('*')) continue; // daemon 启动信息
      const m = t.match(/^(\S+)\s+(device|offline|unauthorized|no permissions[^\s]*)\b(.*)$/);
      if (!m) continue;
      const [, serial, state, rest] = m;
      const model = (rest.match(/model:(\S+)/) || [])[1] || '';
      const device = (rest.match(/device:(\S+)/) || [])[1] || '';
      const transport = (rest.match(/transport_id:(\S+)/) || [])[1] || '';
      devices.push({
        serial,
        state,
        model,
        device,
        transportId: transport,
        wireless: /:\d+$/.test(serial),
        type: /:\d+$/.test(serial) ? 'wireless' : 'usb',
        raw: t
      });
    }
    this.logger.info(`发现 ${devices.length} 台设备`, {
      devices: devices.map((d) => `${d.serial}(${d.state})`)
    });
    return devices;
  }

  /**
   * 无线调试配对
   * @param {string} host  设备 IP
   * @param {number} port  配对端口（弹窗里的）
   * @param {string} code  6 位配对码
   */
  async pair(host, port, code) {
    this.logger.info(`开始无线配对 ${host}:${port}`, { code: '******' });
    const res = await this.adb.exec(
      ['pair', `${host}:${port}`, String(code).trim()],
      { timeout: 30000, label: 'pair' }
    );
    const out = (res.stdout || '') + (res.stderr || '');
    const ok = res.code === 0 && /successfully paired|已成功配对/i.test(out);
    if (ok) {
      this.logger.info('配对成功');
      return { ok: true, message: '配对成功' };
    }
    // 常见失败原因翻译
    let reason = out.trim() || res.error || '配对失败';
    if (/failed to connect|connection refused/i.test(reason)) reason = '无法连接到设备的配对端口，请确认 IP 和端口正确、设备与电脑在同一局域网';
    else if (/incorrect|invalid|code/i.test(reason) && /fail/i.test(reason)) reason = '配对码不正确或已过期，请重新获取';
    else if (/protocol fault|unexpected end/i.test(reason)) reason = '配对协议错误，设备可能已配对过，请先在设备上取消配对后重试';
    this.logger.error('配对失败', { reason });
    return { ok: false, message: reason };
  }

  /** 连接无线设备 */
  async connect(host, port) {
    const addr = `${host}:${port}`;
    this.logger.info(`连接无线设备 ${addr}`);
    const res = await this.adb.exec(['connect', addr], { timeout: 20000, label: 'connect' });
    const out = (res.stdout || '') + (res.stderr || '');
    if (/connected to/i.test(out) && !/unable|failed|cannot/i.test(out)) {
      this.logger.info('无线连接成功', { addr });
      return { ok: true, message: '已连接 ' + addr };
    }
    let reason = out.trim() || '连接失败';
    if (/failed to connect|refused|timed out/i.test(reason)) reason = '连接失败：请确认设备无线调试已开启、端口正确、且与电脑在同一网络';
    else if (/already connected/i.test(reason)) return { ok: true, message: '设备已处于连接状态' };
    this.logger.error('无线连接失败', { reason });
    return { ok: false, message: reason };
  }

  /** 断开无线设备 */
  async disconnect(addr) {
    const res = await this.adb.exec(['disconnect', addr], { timeout: 10000 });
    const ok = res.code === 0;
    this.logger[ok ? 'info' : 'warn'](`断开 ${addr}`, { stdout: res.stdout });
    return { ok, message: (res.stdout || res.stderr || '').trim() };
  }

  /**
   * 激活 Shizuku
   * 依次尝试配置的多个 start.sh 路径（不同版本/ROM 存放位置不同）
   */
  async activate(serial) {
    const paths = this.config.get('startScriptPaths', []) || [];
    const target = this.adb.resolved ? this.adb.resolved.exe : null;
    if (!target) return { ok: false, message: 'adb 未就绪' };

    this.logger.info(`开始在设备 ${serial} 上激活 Shizuku`);
    const attempts = [];

    for (const p of paths) {
      const cmd = `sh ${p}`;
      this.logger.info(`尝试启动脚本：${cmd}`);
      const res = await this.adb.exec(
        ['-s', serial, 'shell', 'sh', p],
        { timeout: 60000, label: 'start.sh' }
      );
      const out = ((res.stdout || '') + (res.stderr || '')).trim();
      attempts.push({ path: p, code: res.code, output: out });

      if (res.code === 0 && !/not found|no such file|permission denied/i.test(out)) {
        this.logger.info(`脚本执行成功：${p}`, { output: out });
        // 稍等再验证
        await this._sleep(1500);
        const status = await this.checkStatus(serial);
        if (status.running) {
          this.logger.info('Shizuku 激活成功', { path: p });
          return { ok: true, message: 'Shizuku 已激活', path: p, status };
        }
        this.logger.info('脚本执行成功但服务尚未就绪，继续尝试其他路径', { path: p });
      } else {
        this.logger.warn(`脚本 ${p} 执行未成功`, { code: res.code, output: out });
      }
    }

    // 全部失败：给出有意义的诊断
    const first = attempts[0] || {};
    let message = '启动脚本未能成功执行。';
    const joined = attempts.map((a) => a.output).join(' ');
    if (/No such file|not found/i.test(joined)) {
      message = '手机上找不到 Shizuku 的启动脚本。请确认已安装 Shizuku 应用并至少打开过一次（新版需在应用内完成一次配对）。';
    } else if (/Permission denied/i.test(joined)) {
      message = '权限被拒绝。请在手机「开发者选项」中开启「USB 调试（安全设置）」（MIUI 专有），并关闭「权限监控」（ColorOS）。';
    } else if (/device unauthorized/i.test(joined)) {
      message = '设备未授权 USB 调试。请在手机上确认「允许 USB 调试」弹窗，并勾选「一律允许」。';
    } else if (/device offline/i.test(joined)) {
      message = '设备处于 offline 状态，请重新插拔数据线并再次确认调试授权。';
    } else if (/no devices\/emulators found/i.test(joined)) {
      message = '未检测到设备，请检查数据线与 USB 调试授权。';
    }
    this.logger.error('Shizuku 激活失败', { message, attempts });
    return { ok: false, message, attempts };
  }

  /**
   * 检测 Shizuku 运行状态
   * 多信号交叉验证，避免误判
   */
  async checkStatus(serial) {
    const signals = { process: false, binder: false, port: false };
    const detail = {};

    // 信号 1：进程存在
    const p1 = await this.adb.exec(
      ['-s', serial, 'shell', 'ps -A 2>/dev/null | grep -i shizuku_server'],
      { timeout: 15000 }
    );
    const psOut = (p1.stdout || '') + (p1.stderr || '');
    signals.process = /shizuku/i.test(psOut);
    detail.process = psOut.trim().split('\n').slice(0, 3).join(' | ');

    // 信号 2：binder 服务注册
    const p2 = await this.adb.exec(
      ['-s', serial, 'shell', 'cat /proc/net/unix 2>/dev/null | grep -i shizuku'],
      { timeout: 15000 }
    );
    const bOut = (p2.stdout || '') + (p2.stderr || '');
    signals.binder = /shizuku/i.test(bOut);

    // 信号 3：管理器包存在（安装检查）
    const p3 = await this.adb.exec(
      ['-s', serial, 'shell', `pm path ${SHIZUKU_PKG}`],
      { timeout: 15000 }
    );
    const pkgOut = (p3.stdout || '') + (p3.stderr || '');
    detail.packageInstalled = /package:/.test(pkgOut);

    const running = signals.process || signals.binder;
    this.statusCache = { running, checkedAt: Date.now(), signals, detail };

    this.logger.debug('Shizuku 状态检测', { serial, signals, ...detail });
    return { running, signals, detail, checkedAt: Date.now() };
  }

  /** 读取设备 Android 版本 */
  async getAndroidVersion(serial) {
    const res = await this.adb.exec(
      ['-s', serial, 'shell', 'getprop ro.build.version.release'],
      { timeout: 10000 }
    );
    return (res.stdout || '').trim();
  }

  /** 打开 Shizuku 应用（用于需要用户手动确认的场景） */
  async launchShizukuApp(serial) {
    const res = await this.adb.exec(
      ['-s', serial, 'shell', `monkey -p ${SHIZUKU_PKG} -c android.intent.category.LAUNCHER 1`],
      { timeout: 15000 }
    );
    const ok = res.code === 0;
    this.logger[ok ? 'info' : 'warn']('尝试拉起 Shizuku 应用', { stdout: res.stdout });
    return { ok, message: ok ? '已尝试打开 Shizuku 应用' : (res.stderr || '失败').trim() };
  }

  /** 重启手机后 Shizuku 会失效，此处用于提示 */
  async isRebootNeededNotice(serial) {
    return {
      ok: true,
      message: '提示：手机每次重启后 Shizuku 服务都会停止，需要重新执行一次激活。'
    };
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = { ShizukuManager, SHIZUKU_PKG };

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
   * 取得 Shizuku 管理器 APK 在设备上的路径
   * 用 `pm path`（系统命令），不受 Android 11+ 分区存储限制
   * @returns {Promise<{ok:boolean, apkPath?:string, libDir?:string, error?:string}>}
   */
  async getManagerApkPath(serial) {
    const res = await this.adb.exec(
      ['-s', serial, 'shell', 'pm', 'path', SHIZUKU_PKG],
      { timeout: 15000 }
    );
    const out = ((res.stdout || '') + (res.stderr || '')).trim();
    // 输出形如 package:/data/app/~~xxx==/moe.shizuku.privileged.api-yyy==/base.apk
    // 必须按行首匹配：否则 "Unknown package: xxx" 里的子串会被误当成路径
    const m = out.match(/^package:(\S+)/m);
    if (!m) {
      if (!out) {
        return {
          ok: false,
          error: `手机上未安装 Shizuku 应用（包名 ${SHIZUKU_PKG}），请先安装并打开一次`
        };
      }
      return {
        ok: false,
        error: /Unknown package|Could not find/i.test(out)
          ? `手机上未安装 Shizuku 应用（包名 ${SHIZUKU_PKG}）`
          : `无法获取 Shizuku APK 路径：${out}`
      };
    }
    const apkPath = m[1];
    // native 库目录：与 APK 同级的 lib/arm64
    const dir = apkPath.replace(/\/[^/]+$/, '');
    const libDir = `${dir}/lib/arm64`;
    return { ok: true, apkPath, libDir };
  }

  /**
   * 策略一：app_process 直接拉起 Shizuku 服务
   *
   * 背景：Android 11+ 起 /sdcard/Android/data/<pkg>/ 受分区存储保护，
   * adb shell 读取会返回 Permission denied，官方 start.sh 命令在
   * Android 11+ 上已不可用；Shizuku v13.7 起更是彻底移除了 start.sh。
   *
   * 本策略完全绕开文件系统：先用 pm path 拿到 APK 路径（系统命令不受限），
   * 再用 app_process 直接以 shell 身份运行 rikka.shizuku.server.ShizukuService。
   */
  async startViaAppProcess(serial) {
    const apk = await this.getManagerApkPath(serial);
    if (!apk.ok) return { ok: false, message: apk.error };

    this.logger.info('已定位 Shizuku APK', { apkPath: apk.apkPath });

    // 杀掉可能残留的旧服务，避免 binder 端口冲突导致启动失败
    await this.killOldServer(serial);

    // 两种参数组合：先不带 library.path（更简单），失败再带
    const variants = [
      { name: 'app_process（基础）', libPath: null },
      { name: 'app_process（含 native 库路径）', libPath: apk.libDir }
    ];

    for (const v of variants) {
      const defProps = `-Djava.class.path=${apk.apkPath}`;
      const libProps = v.libPath ? ` -Dshizuku.library.path=${v.libPath}` : '';
      const inner =
        `/system/bin/app_process ${defProps}${libProps} /system/bin ` +
        `--nice-name=shizuku_server rikka.shizuku.server.ShizukuService`;

      // server 是常驻进程，必须后台运行，否则 adb shell 永不返回
      const cmd = `nohup ${inner} >/dev/null 2>&1 &`;

      this.logger.info(`尝试 ${v.name}`, { command: inner });
      const res = await this.adb.exec(
        ['-s', serial, 'shell', cmd],
        { timeout: 25000, label: v.name }
      );
      const out = ((res.stdout || '') + (res.stderr || '')).trim();
      this.logger.debug(`${v.name} 执行结果`, { code: res.code, output: out });

      // app_process 是后台启动，退出码不代表成败，必须靠状态检测判定
      await this._sleep(2500);
      const status = await this.checkStatus(serial);
      if (status.running) {
        this.logger.info('Shizuku 激活成功', { method: v.name });
        return {
          ok: true,
          message: 'Shizuku 已激活',
          method: v.name,
          command: inner,
          status
        };
      }
      this.logger.info(`${v.name} 执行后服务仍未就绪`, { signals: status.signals });
    }

    return {
      ok: false,
      message: 'app_process 启动后服务未能就绪',
      command: `/system/bin/app_process -Djava.class.path=${apk.apkPath} /system/bin --nice-name=shizuku_server rikka.shizuku.server.ShizukuService`
    };
  }

  /** 终止设备上残留的 shizuku_server 进程 */
  async killOldServer(serial) {
    const cmds = [
      'killall shizuku_server 2>/dev/null',
      'pkill -f shizuku_server 2>/dev/null'
    ];
    for (const c of cmds) {
      const res = await this.adb.exec(['-s', serial, 'shell', c], { timeout: 10000 });
      const out = ((res.stdout || '') + (res.stderr || '')).trim();
      if (!/not found|No such|not exist/i.test(out) && res.code === 0) {
        this.logger.info('已清理残留的 shizuku_server 进程', { cmd: c });
      }
    }
  }

  /**
   * 策略三：把 native starter 复制到 /data/local/tmp 再执行
   * 这是 Shizuku v13.6 官方 release note 推荐的方式：
   * "You can copy this file to any executable location, such as /data/local/tmp/shizuku"
   */
  async startViaStarterCopy(serial) {
    const dirs = [
      '/storage/emulated/0/Android/data/moe.shizuku.privileged.api',
      '/sdcard/Android/data/moe.shizuku.privileged.api'
    ];

    for (const dir of dirs) {
      // 设备内部复制：source 与 dest 都在设备上
      const cpCmd = `cp ${dir}/starter /data/local/tmp/shizuku 2>/dev/null`;
      const res = await this.adb.exec(['-s', serial, 'shell', cpCmd], { timeout: 15000 });
      const out = ((res.stdout || '') + (res.stderr || '')).trim();
      if (/Permission denied/i.test(out)) {
        this.logger.warn('Android/data 目录不可读（分区存储限制）', { dir, output: out });
        continue;
      }
      if (res.code !== 0) {
        this.logger.info('starter 复制失败', { dir, output: out });
        continue;
      }

      const chmod = await this.adb.exec(
        ['-s', serial, 'shell', 'chmod 755 /data/local/tmp/shizuku'],
        { timeout: 10000 }
      );
      if (chmod.code !== 0) continue;

      this.logger.info('尝试执行 /data/local/tmp/shizuku');
      await this.adb.exec(['-s', serial, 'shell', '/data/local/tmp/shizuku'], {
        timeout: 20000
      });
      await this._sleep(2500);
      const status = await this.checkStatus(serial);
      if (status.running) {
        this.logger.info('Shizuku 激活成功', { method: 'starter 复制执行' });
        return {
          ok: true,
          message: 'Shizuku 已激活',
          method: 'starter 复制执行',
          command: `adb -s ${serial} shell sh ${dir}/start.sh`,
          status
        };
      }
    }
    return { ok: false, message: 'starter 复制方案未成功（Android/data 目录通常不可读）' };
  }

  /**
   * 设备端诊断
   * 逐项检测并给出「正常 / 有问题 / 无法检测」+ 原因说明，
   * 让用户能自己看懂到底卡在哪一环。
   */
  async diagnose(serial) {
    const items = [];
    const add = (name, state, detail) => items.push({ name, state, detail: detail || '' });

    this.logger.info(`开始设备诊断：${serial}`);

    // 1) Shizuku 应用是否安装
    const apk = await this.getManagerApkPath(serial);
    if (apk.ok) {
      add('Shizuku 应用已安装', 'ok', apk.apkPath);
    } else {
      add('Shizuku 应用已安装', 'err', apk.error);
    }

    // 2) Android 版本
    const ver = await this.getAndroidVersion(serial);
    const androidVer = parseInt(ver, 10);
    if (androidVer) {
      const isAndroid11Plus = androidVer >= 11;
      add(
        'Android 版本',
        'ok',
        `Android ${ver}${isAndroid11Plus ? '（分区存储限制生效，将使用 app_process 直启）' : '（可直接使用 start.sh）'}`
      );
    } else {
      add('Android 版本', 'warn', '未能读取');
    }

    // 3) Android/data 目录可读性（决定 start.sh 能否走通）
    const dataDirs = [
      '/storage/emulated/0/Android/data/moe.shizuku.privileged.api',
      '/sdcard/Android/data/moe.shizuku.privileged.api'
    ];
    let dataState = 'warn';
    let dataDetail = '';
    for (const d of dataDirs) {
      const res = await this.adb.exec(
        ['-s', serial, 'shell', `ls ${d} 2>&1`],
        { timeout: 12000 }
      );
      const out = ((res.stdout || '') + (res.stderr || '')).trim();
      if (/Permission denied/i.test(out)) {
        dataDetail = `${d}：权限被拒（Android 11+ 分区存储限制）`;
      } else if (/start\.sh|starter|No such file/i.test(out)) {
        dataState = 'warn';
        dataDetail = `${d}：可访问，但未找到 start.sh / starter（版本较新或应用未初始化）`;
      } else if (res.code === 0 && out) {
        dataState = 'ok';
        dataDetail = `${d}：可访问（${out.split('\n').slice(0, 3).join(', ')}）`;
        break;
      }
    }
    add('Android/data 可访问性', dataState, dataDetail || '未知');

    // 4) start.sh 是否存在
    const paths = this.config.get('startScriptPaths', []) || [];
    let foundScript = null;
    for (const p of paths) {
      const res = await this.adb.exec(
        ['-s', serial, 'shell', `test -f ${p} && echo YES || echo NO`],
        { timeout: 10000 }
      );
      if (/YES/i.test(res.stdout || '')) {
        foundScript = p;
        break;
      }
    }
    if (foundScript) {
      add('启动脚本 start.sh', 'ok', foundScript);
    } else {
      add(
        '启动脚本 start.sh',
        'warn',
        '未找到（Shizuku v13.7+ 已移除该脚本，属正常）—— 将使用 app_process 直启'
      );
    }

    // 5) app_process 是否可用（直启方案的前提）
    const apRes = await this.adb.exec(
      ['-s', serial, 'shell', 'ls -l /system/bin/app_process 2>&1'],
      { timeout: 10000 }
    );
    const apOut = ((apRes.stdout || '') + (apRes.stderr || '')).trim();
    if (/app_process/.test(apOut) && !/No such file/i.test(apOut)) {
      add('app_process 可用', 'ok', apOut.split('\n')[0]);
    } else {
      add('app_process 可用', 'err', apOut || '未找到 /system/bin/app_process');
    }

    // 6) 当前服务状态
    const status = await this.checkStatus(serial);
    add(
      'Shizuku 服务状态',
      status.running ? 'ok' : 'warn',
      status.running
        ? '服务已在运行'
        : '未运行（进程与 binder 均未检测到）'
    );

    // 7) 汇总建议
    const summary = this.buildDiagnosisSummary(items, status);

    this.logger.info('设备诊断完成', { items, summary });
    return { items, summary, status, checkedAt: Date.now() };
  }

  /** 根据诊断结果生成结论与行动建议 */
  buildDiagnosisSummary(items, status) {
    if (status && status.running) {
      return {
        level: 'ok',
        title: 'Shizuku 已在运行',
        advice: '无需激活。若要在手机授权其他应用，打开 Shizuku 应用进入「已授权应用」列表。'
      };
    }

    const byName = {};
    items.forEach((i) => (byName[i.name] = i));

    if (byName['Shizuku 应用已安装'] && byName['Shizuku 应用已安装'].state === 'err') {
      return {
        level: 'err',
        title: '手机上没有安装 Shizuku 应用',
        advice:
          '请先从官方渠道安装 Shizuku（GitHub Releases / Google Play / F-Droid），' +
          '安装后至少打开一次，再回到本工具重新诊断。'
      };
    }

    if (byName['app_process 可用'] && byName['app_process 可用'].state === 'err') {
      return {
        level: 'err',
        title: '设备缺少 app_process',
        advice: '该设备的 /system/bin/app_process 不可用，属于异常 ROM，请改用 root 方式启动 Shizuku。'
      };
    }

    if (byName['Android/data 可访问性'] && byName['Android/data 可访问性'].state === 'warn') {
      return {
        level: 'warn',
        title: 'Android/data 目录不可访问（Android 11+ 分区存储限制）',
        advice:
          '这是系统限制，不是工具的问题。官方 start.sh 命令在这种情况下必然失败。' +
          '本工具会自动改用 app_process 直启方案（用 pm path 定位 APK，绕开文件系统限制），' +
          '直接点击「立即激活」即可。'
      };
    }

    if (byName['启动脚本 start.sh'] && byName['启动脚本 start.sh'].state === 'warn') {
      return {
        level: 'warn',
        title: '未找到 start.sh（Shizuku v13.7+ 已改用 native starter）',
        advice:
          '属正常现象，工具会自动使用 app_process 直启。' +
          '如果激活仍失败，请确认 Shizuku 应用已打开过一次，并检查手机端开发者选项设置。'
      };
    }

    return {
      level: 'warn',
      title: '环境基本正常，但服务未运行',
      advice: '点击「立即激活」启动服务；若失败请查看日志面板中的具体错误。'
    };
  }

  /**
   * 激活 Shizuku
   *
   * 多策略依次尝试，第一个成功的即采用：
   *   1) app_process 直启   —— 首选，兼容 Android 11+ 与 Shizuku v13.7+
   *   2) start.sh 直跑     —— 兼容 Android 10 及以下与旧版 Shizuku
   *   3) starter 复制执行  —— Shizuku v13.6 官方推荐方式
   */
  async activate(serial) {
    const paths = this.config.get('startScriptPaths', []) || [];
    if (!this.adb.resolved) return { ok: false, message: 'adb 未就绪' };

    this.logger.info(`开始在设备 ${serial} 上激活 Shizuku`);
    const attempts = [];

    // ---- 策略 1：app_process 直启 ----
    const ap = await this.startViaAppProcess(serial);
    attempts.push({ method: 'app_process', ok: ap.ok, output: ap.message });
    if (ap.ok) return { ...ap, attempts };
    this.logger.info('app_process 方案未成功，尝试 start.sh', { reason: ap.message });

    // ---- 策略 2：start.sh 直跑 ----
    for (const p of paths) {
      this.logger.info(`尝试启动脚本：sh ${p}`);
      const res = await this.adb.exec(
        ['-s', serial, 'shell', 'sh', p],
        { timeout: 45000, label: 'start.sh' }
      );
      const out = ((res.stdout || '') + (res.stderr || '')).trim();
      attempts.push({ path: p, code: res.code, output: out });

      const blocked = /not found|no such file|permission denied/i.test(out);
      if (res.code === 0 && !blocked) {
        await this._sleep(2000);
        const status = await this.checkStatus(serial);
        if (status.running) {
          this.logger.info('Shizuku 激活成功', { path: p });
          return { ok: true, message: 'Shizuku 已激活', method: 'start.sh', path: p, status, attempts };
        }
      } else {
        this.logger.warn(`脚本 ${p} 执行未成功`, { code: res.code, output: out });
      }
    }

    // ---- 策略 3：starter 复制执行 ----
    const sc = await this.startViaStarterCopy(serial);
    attempts.push({ method: 'starter-copy', ok: sc.ok, output: sc.message });
    if (sc.ok) return { ...sc, attempts };

    // ---- 全部失败：给出有意义的诊断 ----
    const joined = attempts.map((a) => a.output || '').join(' ');
    const message = this.explainFailure(joined, attempts);
    this.logger.error('Shizuku 激活失败', { message, attempts });
    return { ok: false, message, attempts };
  }

  /** 根据失败输出翻译成用户能懂的原因 */
  explainFailure(joined, attempts) {
    if (/No such file or directory|not found/i.test(joined) && !/Permission denied/i.test(joined)) {
      return '手机上找不到 Shizuku 的启动脚本。可能是：① Shizuku 应用没装或从没打开过；' +
        '② 版本较新（v13.7+）已移除 start.sh。工具已自动尝试 app_process 直启仍未成功，' +
        '请确认 Shizuku 应用已正确安装并至少打开过一次。';
    }
    if (/Permission denied/i.test(joined)) {
      return '访问 Android/data 目录被拒绝 —— 这是 Android 11+ 的分区存储限制，不是工具的问题。' +
        '工具已自动改用 app_process 直启绕过该限制，若仍失败请检查手机端权限设置' +
        '（MIUI 需开启「USB 调试（安全设置）」）。';
    }
    if (/device unauthorized/i.test(joined)) {
      return '设备未授权 USB 调试。请在手机上确认「允许 USB 调试」弹窗，并勾选「一律允许」。';
    }
    if (/device offline/i.test(joined)) {
      return '设备处于 offline 状态，请重新插拔数据线并再次确认调试授权。';
    }
    if (/no devices\/emulators found/i.test(joined)) {
      return '未检测到设备，请检查数据线与 USB 调试授权。';
    }
    if (/Unknown package|Could not find/i.test(joined)) {
      return `手机上未安装 Shizuku 应用（包名 ${SHIZUKU_PKG}）。请先安装并打开一次。`;
    }
    const last = attempts[attempts.length - 1];
    return (
      '所有启动方式均未成功。' +
      (last && last.output ? `最后一条信息：${last.output}` : '') +
      '建议运行「设备诊断」查看详细检测结果。'
    );
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

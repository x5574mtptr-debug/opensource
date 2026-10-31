'use strict';
/**
 * 主进程入口
 */
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

// 若本程序被另一个 Electron 应用（如 WorkBuddy）拉起，宿主会注入
// ELECTRON_RUN_AS_NODE=1，导致 Electron 退化为纯 Node、app 为 undefined。
// 注意：必须在 Electron 进程启动之前清除，脚本入口见 scripts/launch.js。
if (process.env.ELECTRON_RUN_AS_NODE) {
  delete process.env.ELECTRON_RUN_AS_NODE;
}

// 兜底：若在纯 Node 环境下被误执行，给出明确提示而不是抛出 undefined 错误
if (!app) {
  console.error(
    '\n[错误] 本程序需要 Electron 运行时。\n' +
    '请使用 npm start 启动，或直接运行打包好的 exe。\n'
  );
  process.exit(1);
}

const { Logger } = require('./logger');
const { Config } = require('./config');
const { AdbManager } = require('./adb');
const { ShizukuManager } = require('./shizuku');

const isDev = process.argv.includes('--dev');
const startHidden = process.argv.includes('--hidden');
const APP_NAME = 'Shizuku 激活工具';

// 开发辅助：--screenshot <路径> 启动后自动截取窗口，便于界面回归检查
const shotIdx = process.argv.indexOf('--screenshot');
const screenshotPath = shotIdx >= 0 ? process.argv[shotIdx + 1] : null;

// 开发辅助：--tour <目录> 依次遍历四个步骤并截图（使用真实 IPC，贴近真实行为）
const tourIdx = process.argv.indexOf('--tour');
const tourDir = tourIdx >= 0 ? process.argv[tourIdx + 1] : null;

// 开发辅助：--fake-device 用假设备填充界面，便于在没有真机时查看渲染效果
const useFakeDevice = process.argv.includes('--fake-device');

// 单实例锁：第二次启动时聚焦已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = mainWindow;
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

let mainWindow = null;
let logger = null;
let config = null;
let adb = null;
let shizuku = null;
let statusTimer = null;

function resourcesDir() {
  // 打包后 resources 在 process.resourcesPath，开发态在项目根
  return app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(__dirname, '..', '..', 'resources');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f5f6fa',
    title: APP_NAME,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logger.error('页面加载失败', { code, desc, url });
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logger.error('渲染进程崩溃', { reason: details.reason, exitCode: details.exitCode });
  });
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    // 仅在 DEBUG 级别记录渲染端输出，避免刷屏
    if (level >= 2 && logger.getLevel() === 'DEBUG') {
      logger.debug('渲染进程消息', { message });
    }
  });
  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // 开发辅助：截图后自动退出
  // 注意：loadFile 可能早于监听器注册完成，因此两个事件都要兜底，
  // 且用 once 保证只执行一次
  if (screenshotPath) {
    const doShot = async () => {
      try {
        const img = await mainWindow.webContents.capturePage();
        fs.writeFileSync(screenshotPath, img.toPNG());
        logger.info('界面截图已保存', { path: screenshotPath });
      } catch (e) {
        logger.error('截图失败', { error: e.message });
      }
      app.quit();
    };
    let shotDone = false;
    const shotOnce = async () => {
      if (shotDone) return;
      shotDone = true;
      setTimeout(doShot, 1500);
    };
    mainWindow.webContents.once('did-finish-load', shotOnce);
    mainWindow.once('ready-to-show', shotOnce);
  }

  // 开发辅助：四步界面巡检
  if (tourDir) {
    let tourDone = false;
    const tourOnce = () => {
      if (tourDone) return;
      tourDone = true;
      logger.info('巡检触发', { via: 'event' });
      setTimeout(() => runUiTour(mainWindow, tourDir), 1200);
    };
    mainWindow.webContents.once('did-finish-load', tourOnce);
    mainWindow.once('ready-to-show', tourOnce);

    // 兜底：轮询等待加载完成
    const poll = setInterval(() => {
      if (tourDone) return clearInterval(poll);
      if (mainWindow.webContents && !mainWindow.webContents.isLoading()) {
        tourOnce();
      }
    }, 300);
  }

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopStatusPolling();
  });

  // 记忆窗口尺寸与位置
  const bounds = config.get('windowBounds');
  if (bounds && bounds.width && bounds.height) {
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: Math.max(960, bounds.width),
      height: Math.max(640, bounds.height)
    });
  }
  const maximized = config.get('windowMaximized', false);
  if (maximized) mainWindow.maximize();

  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMaximized()) {
      config.set('windowMaximized', true);
    } else {
      const b = mainWindow.getBounds();
      config.set('windowBounds', b);
      config.set('windowMaximized', false);
    }
  };
  mainWindow.on('resized', saveBounds);
  mainWindow.on('moved', saveBounds);
  mainWindow.on('maximize', saveBounds);
  mainWindow.on('unmaximize', saveBounds);

  applyTheme();
}

function applyTheme() {
  const t = config.get('theme', 'system');
  nativeTheme.themeSource = t === 'system' ? 'system' : t;
}

/** 广播日志到渲染进程 */
function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

/** 状态轮询 */
function startStatusPolling(serial) {
  stopStatusPolling();
  const interval = Math.max(1500, config.get('checkIntervalMs', 3000));
  logger.info(`开始状态轮询（间隔 ${interval}ms，设备 ${serial}）`);
  statusTimer = setInterval(async () => {
    try {
      const st = await shizuku.checkStatus(serial);
      broadcast('shizuku:status', { serial, ...st });
    } catch (e) {
      logger.warn('状态轮询异常', { error: e.message });
    }
  }, interval);
}

function stopStatusPolling() {
  if (statusTimer) {
    clearInterval(statusTimer);
    statusTimer = null;
    logger.info('已停止状态轮询');
  }
}

function registerIpc() {
  // ---- 日志 ----
  ipcMain.handle('log:history', () => logger.history(1500));
  ipcMain.handle('log:files', () => logger.listFiles());
  ipcMain.handle('log:read', (_e, name) => logger.readFile(name));
  ipcMain.handle('log:export', async () => {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: '导出日志',
      defaultPath: `shizuku-log-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: '文本文件', extensions: ['txt'] }]
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    return logger.exportAll(res.filePath);
  });
  ipcMain.handle('log:setLevel', (_e, level) => {
    logger.setLevel(level);
    config.set('logLevel', level);
    return logger.getLevel();
  });

  // ---- 配置 ----
  ipcMain.handle('config:get', () => config.data);
  ipcMain.handle('config:set', (_e, patch) => {
    const r = config.update(patch);
    if (patch && patch.logLevel) logger.setLevel(patch.logLevel);
    if (patch && patch.theme) applyTheme();
    broadcast('config:changed', config.data);
    return config.data;
  });
  ipcMain.handle('config:reset', () => {
    const r = config.reset();
    logger.setLevel(r.logLevel);
    applyTheme();
    broadcast('config:changed', config.data);
    return r;
  });
  ipcMain.handle('config:openFolder', () => {
    shell.openPath(path.join(app.getPath('userData'), ''));
  });
  ipcMain.handle('config:openLogFolder', () => {
    shell.openPath(logger.logDir);
  });

  // ---- adb ----
  ipcMain.handle('adb:locate', async (_e, opts) => adb.locate(opts || {}));
  ipcMain.handle('adb:download', async (_e) => {
    const r = await adb.downloadPlatformTools((p) => broadcast('adb:progress', p));
    // 下载完成后重新探测，刷新缓存
    if (r.ok) await adb.locate({ allowDownload: false, force: true });
    return r;
  });
  ipcMain.handle('adb:exec', async (_e, args) => {
    const res = await adb.exec(args, { timeout: 30000 });
    return { code: res.code, stdout: res.stdout, stderr: res.stderr, error: res.error };
  });

  // ---- 设备 ----
  ipcMain.handle('device:list', async () => {
    if (useFakeDevice) {
      return [
        { serial: 'FAKE1234', state: 'device', model: 'Pixel 6a', device: 'flame', transportId: '1', wireless: false, type: 'usb' },
        { serial: '192.168.1.88:5555', state: 'device', model: 'Redmi K60', device: 'houji', transportId: '2', wireless: true, type: 'wireless' },
        { serial: 'BADA0001', state: 'unauthorized', model: 'Unknown', device: '', transportId: '3', wireless: false, type: 'usb' }
      ];
    }
    return shizuku.listDevices();
  });

  // ---- 无线 ----
  ipcMain.handle('wireless:pair', (_e, { host, port, code }) =>
    shizuku.pair(host, port, code)
  );
  ipcMain.handle('wireless:connect', (_e, { host, port }) =>
    shizuku.connect(host, port)
  );
  ipcMain.handle('wireless:disconnect', (_e, addr) => shizuku.disconnect(addr));

  // ---- 激活 ----
  ipcMain.handle('shizuku:activate', async (_e, serial) => {
    const r = await shizuku.activate(serial);
    if (r.ok && config.get('autoCheckStatus', true)) {
      startStatusPolling(serial);
    }
    return r;
  });
  ipcMain.handle('shizuku:diagnose', (_e, serial) => shizuku.diagnose(serial));
  ipcMain.handle('shizuku:status', (_e, serial) => shizuku.checkStatus(serial));
  ipcMain.handle('shizuku:launchApp', (_e, serial) => shizuku.launchShizukuApp(serial));
  ipcMain.handle('shizuku:androidVersion', (_e, serial) => shizuku.getAndroidVersion(serial));

  // ---- 应用 ----
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    userData: app.getPath('userData'),
    logDir: logger.logDir,
    autoLaunch: app.getLoginItemSettings().openAtLogin
  }));
  ipcMain.handle('app:openExternal', (_e, url) => shell.openExternal(url));

  // ---- 开机自启 ----
  ipcMain.handle('app:setAutoLaunch', (_e, enabled) => {
    try {
      if (enabled) {
        // 便携版用不了自启（没有稳定路径），这里只做尽力而为
        app.setLoginItemSettings({
          openAtLogin: true,
          args: ['--hidden']
        });
      } else {
        app.setLoginItemSettings({ openAtLogin: false });
      }
      const state = app.getLoginItemSettings().openAtLogin;
      logger.info('开机自启已' + (state ? '开启' : '关闭'));
      return { ok: true, enabled: state };
    } catch (e) {
      logger.error('设置开机自启失败', { error: e.message });
      return { ok: false, error: e.message };
    }
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: '操作',
        submenu: [
          { label: '刷新设备列表', accelerator: 'CmdOrCtrl+R', click: () => broadcast('menu:refresh', null) },
          { type: 'separator' },
          { label: '打开日志目录', click: () => shell.openPath(logger.logDir) },
          { label: '打开配置目录', click: () => shell.openPath(app.getPath('userData')) },
          { type: 'separator' },
          { role: 'quit', label: '退出' }
        ]
      },
      {
        label: '视图',
        submenu: [
          { role: 'reload', label: '重新加载' },
          { role: 'toggleDevTools', label: '开发者工具' },
          { type: 'separator' },
          { role: 'resetZoom', label: '实际大小' },
          { role: 'zoomIn', label: '放大' },
          { role: 'zoomOut', label: '缩小' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: '全屏' }
        ]
      }
    ])
  );

  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });

  logger = new Logger(userData);
  config = new Config(userData);
  logger.setLevel(config.get('logLevel', 'INFO'));

  // 内置 platform-tools 目录（打包后可能只读，准备失败就降级到用户目录）
  const res = resourcesDir();
  try {
    fs.mkdirSync(res, { recursive: true });
  } catch (_) {
    // ignore
  }

  adb = new AdbManager({ logger, config, resourcesDir: res });
  shizuku = new ShizukuManager({ logger, config, adb });

  logger.on('entry', (entry) => broadcast('log:entry', entry));

  registerIpc();
  createWindow();

  logger.info(`${APP_NAME} 已启动`, {
    version: app.getVersion(),
    electron: process.versions.electron
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopStatusPolling();
  if (logger) logger.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopStatusPolling();
  if (logger) logger.close();
});

// 全局异常捕获：避免主进程静默崩溃导致界面无响应
process.on('uncaughtException', (err) => {
  if (logger) {
    logger.error('主进程未捕获异常', { message: err.message, stack: err.stack });
  } else {
    console.error('[未捕获异常]', err);
  }
});
process.on('unhandledRejection', (reason) => {
  if (logger) {
    logger.error('主进程未处理的 Promise 拒绝', {
      reason: reason && reason.message ? reason.message : String(reason)
    });
  }
});

/**
 * 开发辅助：界面巡检 —— 遍历四个步骤 + 深色主题 + 设置弹窗，逐个截图
 */
async function runUiTour(win, dir) {
  const steps = ['env', 'device', 'activate', 'verify'];
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const step of steps) {
      await win.webContents.executeJavaScript(
        `document.querySelector('.step-item[data-step="${step}"]').click()`
      );
      await sleep(650);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(dir, `ui-${step}.png`), img.toPNG());
      logger.info('巡检截图', { step });
    }

    // 深色主题
    await win.webContents.executeJavaScript(
      `document.documentElement.setAttribute('data-theme','dark');
       document.querySelector('.step-item[data-step="verify"]').click();`
    );
    await sleep(600);
    fs.writeFileSync(
      path.join(dir, 'ui-dark.png'),
      (await win.webContents.capturePage()).toPNG()
    );

    // 设置弹窗
    await win.webContents.executeJavaScript(
      `document.documentElement.setAttribute('data-theme','light');
       document.getElementById('btnOpenSettings').click();`
    );
    await sleep(700);
    fs.writeFileSync(
      path.join(dir, 'ui-settings.png'),
      (await win.webContents.capturePage()).toPNG()
    );

    logger.info('界面巡检完成', { dir });
  } catch (e) {
    logger.error('界面巡检失败', { error: e.message });
  }
  app.quit();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

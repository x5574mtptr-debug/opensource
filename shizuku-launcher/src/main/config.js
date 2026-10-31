'use strict';
/**
 * 配置管理
 * - 存于用户数据目录 config.json
 * - 深合并默认值，字段缺失自动补齐
 * - 原子写入（临时文件 + rename），避免写一半崩溃损坏配置
 */
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  // adb
  adbPath: '',              // 手动指定 adb.exe 绝对路径（留空=自动探测）
  fastbootPath: '',         // 手动指定 fastboot.exe 绝对路径（留空=自动探测）
  autoDetectAdb: true,      // 自动探测 adb
  adbServerPort: 5037,      // adb 服务端口
  // platform-tools
  autoDownloadAdb: true,    // 未找到 adb 时自动下载
  platformToolsMirror: 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
  // 启动参数
  startScriptPaths: [
    '/sdcard/Android/data/moe.shizuku.privileged.api/start.sh',
    '/storage/emulated/0/Android/data/moe.shizuku.privileged.api/start.sh',
    '/data/local/tmp/shizuku_starter'
  ],
  shizukuPackage: 'moe.shizuku.privileged.api',
  // 无线调试
  wireless: {
    connectPort: 5555,       // 无线调试连接端口（设备上"无线调试"主界面显示的端口）
    pairPort: 37129,         // 配对端口（"使用配对码配对设备"弹窗显示的端口）
    pairCodeLength: 6
  },
  // 日志
  logLevel: 'INFO',
  // 行为
  autoCheckStatus: true,     // 启动后自动检测 Shizuku 状态
  checkIntervalMs: 3000,     // 状态轮询间隔
  minimizeToTray: false,
  theme: 'light',            // light | dark | system
  // 界面
  ui: {
    compactLog: false,
    logPanelHeight: 260
  }
};

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  if (!patch || typeof patch !== 'object') return out;
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    const bv = base[key];
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[key] = deepMerge(bv, pv);
    } else if (pv !== undefined) {
      out[key] = pv;
    }
  }
  return out;
}

class Config {
  constructor(userDataDir) {
    this.file = path.join(userDataDir, 'config.json');
    this.data = deepMerge(DEFAULTS, {});
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = deepMerge(DEFAULTS, parsed);
        return { ok: true };
      }
    } catch (e) {
      // 配置损坏时不致命：保留默认，把坏文件挪走便于排查
      try {
        fs.renameSync(this.file, this.file + '.broken-' + Date.now());
      } catch (_) {}
    }
    this.data = deepMerge(DEFAULTS, {});
    return { ok: false };
  }

  get(key, fallback) {
    if (key === undefined) return this.data;
    const parts = key.split('.');
    let cur = this.data;
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else return fallback;
    }
    return cur;
  }

  set(key, value) {
    const parts = key.split('.');
    const last = parts.pop();
    let cur = this.data;
    for (const p of parts) {
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[last] = value;
    this.save();
    return cur[last];
  }

  /** 批量更新并落盘 */
  update(patch) {
    this.data = deepMerge(this.data, patch);
    this.save();
    return this.data;
  }

  reset() {
    this.data = deepMerge(DEFAULTS, {});
    this.save();
    return this.data;
  }

  save() {
    try {
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.file);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

module.exports = { Config, DEFAULTS };

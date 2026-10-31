'use strict';
/**
 * 预加载脚本：安全地把主进程能力暴露给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, handler) => {
  const wrapped = (_e, payload) => handler(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
};

contextBridge.exposeInMainWorld('api', {
  // 日志
  getLogHistory: () => ipcRenderer.invoke('log:history'),
  listLogFiles: () => ipcRenderer.invoke('log:files'),
  readLogFile: (name) => ipcRenderer.invoke('log:read', name),
  exportLog: () => ipcRenderer.invoke('log:export'),
  setLogLevel: (level) => ipcRenderer.invoke('log:setLevel', level),
  onLogEntry: (cb) => on('log:entry', cb),

  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  resetConfig: () => ipcRenderer.invoke('config:reset'),
  openConfigFolder: () => ipcRenderer.invoke('config:openFolder'),
  openLogFolder: () => ipcRenderer.invoke('config:openLogFolder'),

  // adb
  locateAdb: (opts) => ipcRenderer.invoke('adb:locate', opts),
  downloadAdb: () => ipcRenderer.invoke('adb:download'),
  execAdb: (args) => ipcRenderer.invoke('adb:exec', args),
  onAdbProgress: (cb) => on('adb:progress', cb),

  // 设备
  listDevices: () => ipcRenderer.invoke('device:list'),

  // 无线调试
  pair: (host, port, code) => ipcRenderer.invoke('wireless:pair', { host, port, code }),
  connect: (host, port) => ipcRenderer.invoke('wireless:connect', { host, port }),
  disconnect: (addr) => ipcRenderer.invoke('wireless:disconnect', addr),

  // Shizuku
  activate: (serial) => ipcRenderer.invoke('shizuku:activate', serial),
  getStatus: (serial) => ipcRenderer.invoke('shizuku:status', serial),
  launchApp: (serial) => ipcRenderer.invoke('shizuku:launchApp', serial),
  getAndroidVersion: (serial) => ipcRenderer.invoke('shizuku:androidVersion', serial),
  onStatus: (cb) => on('shizuku:status', cb),

  // 应用
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('app:setAutoLaunch', enabled),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  // 菜单
  onMenuRefresh: (cb) => on('menu:refresh', cb),
  onConfigChanged: (cb) => on('config:changed', cb)
});

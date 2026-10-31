'use strict';
/**
 * 启动包装器
 * 某些 Electron 宿主（如 WorkBuddy）会给子进程注入 ELECTRON_RUN_AS_NODE=1，
 * 使 Electron 退化为纯 Node 模式（app 为 undefined，窗口无法创建）。
 * 这个脚本在 Electron 进程启动之前清除该变量，保证始终以 GUI 模式运行。
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

// 定位 electron 可执行文件
function findElectron() {
  const bin = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  if (fs.existsSync(bin)) return bin;
  const binMac = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app');
  if (fs.existsSync(binMac)) {
    return path.join(binMac, 'Contents', 'MacOS', 'Electron');
  }
  const linux = path.join(root, 'node_modules', 'electron', 'dist', 'electron');
  if (fs.existsSync(linux)) return linux;
  return null;
}

const electronBin = findElectron();
if (!electronBin) {
  console.error('[启动失败] 未找到 Electron 可执行文件，请先执行 npm install');
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = [root, ...process.argv.slice(2)];
const child = spawn(electronBin, args, { env, stdio: 'inherit', windowsHide: false });

child.on('close', (code) => process.exit(code === null ? 0 : code));
child.on('error', (e) => {
  console.error('[启动失败]', e.message);
  process.exit(1);
});

'use strict';
/**
 * UI 巡检 —— 依次切换四个步骤并截图，用于界面回归检查
 * 用法：node scripts/ui-tour.js <输出目录>
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2] || path.join(__dirname, '..', '.cache');
fs.mkdirSync(OUT, { recursive: true });

const STEPS = ['env', 'device', 'activate', 'verify'];

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1180,
    height: 800,
    show: false,
    backgroundColor: '#f4f5f9',
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  await new Promise((r) => setTimeout(r, 1500));

  for (const step of STEPS) {
    await win.webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('.step-item[data-step="${step}"]');
        if (btn) btn.click();
        return true;
      })()
    `);
    await new Promise((r) => setTimeout(r, 700));
    const img = await win.webContents.capturePage();
    const file = path.join(OUT, `ui-${step}.png`);
    fs.writeFileSync(file, img.toPNG());
    console.log('✓', path.basename(file));
  }

  // 深色主题
  await win.webContents.executeJavaScript(`
    document.documentElement.setAttribute('data-theme','dark');
    document.querySelector('.step-item[data-step="verify"]').click();
    true
  `);
  await new Promise((r) => setTimeout(r, 600));
  const dark = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'ui-dark.png'), dark.toPNG());
  console.log('✓ ui-dark.png');

  // 设置弹窗
  await win.webContents.executeJavaScript(`
    document.documentElement.setAttribute('data-theme','light');
    document.getElementById('btnOpenSettings').click();
    true
  `);
  await new Promise((r) => setTimeout(r, 700));
  const modal = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, 'ui-settings.png'), modal.toPNG());
  console.log('✓ ui-settings.png');

  app.quit();
});

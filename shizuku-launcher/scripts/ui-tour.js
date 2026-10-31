'use strict';
/**
 * UI 巡检 —— 遍历界面结构并逐个截图，用于界面回归检查
 * 用法：node scripts/ui-tour.js <输出目录>
 *
 * 界面结构（2026-10 重构后）：
 *   左侧两大区 zone-item → Shizuku 激活 / Fastboot 专区
 *   Shizuku 区内部分段控件 seg-item → 环境准备/设备连接/激活服务/状态确认
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2] || path.join(__dirname, '..', '.cache');
fs.mkdirSync(OUT, { recursive: true });

// Shizuku 区的四个子步骤
const SHIZUKU_STEPS = ['env', 'device', 'activate', 'verify'];

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

  // 注意：executeJavaScript 的代码受页面 CSP 约束，
  // 字符串插值要用 JSON.stringify 包裹成合法 JS 字面量
  const click = async (selector) => {
    return win.webContents.executeJavaScript(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return false; el.click(); return true; })()`
    );
  };

  const shot = async (name) => {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, `ui-${name}.png`), img.toPNG());
    console.log('✓ ui-' + name + '.png');
  };

  // ---- Shizuku 区的四个子步骤 ----
  for (const step of SHIZUKU_STEPS) {
    const clicked = await click(`.seg-item[data-step="${step}"]`);
    if (!clicked) {
      console.log('  ! 未找到分段控件: ' + step);
      continue;
    }
    await new Promise((r) => setTimeout(r, 700));
    await shot(step);
  }

  // ---- Fastboot 专区 ----
  await click('.zone-item[data-zone="fastboot"]');
  await new Promise((r) => setTimeout(r, 900));
  await shot('fastboot');

  // ---- Fastboot 确认弹窗（高风险操作二次确认）----
  await click('.op-btn[data-fb="flashing unlock"]');
  await new Promise((r) => setTimeout(r, 600));
  await shot('fastboot-confirm');

  // 关闭确认框
  await click('.modal [data-act="cancel"]');
  await new Promise((r) => setTimeout(r, 300));

  // ---- 深色主题 ----
  await win.webContents.executeJavaScript(`
    document.documentElement.setAttribute('data-theme','dark');
    document.querySelector('.zone-item[data-zone="fastboot"]').click();
    true
  `);
  await new Promise((r) => setTimeout(r, 600));
  await shot('dark');

  // ---- 设置弹窗 ----
  await win.webContents.executeJavaScript(`
    document.documentElement.setAttribute('data-theme','light');
    document.querySelector('.zone-item[data-zone="shizuku"]').click();
    document.getElementById('btnOpenSettings').click();
    true
  `);
  await new Promise((r) => setTimeout(r, 700));
  await shot('settings');

  app.quit();
});

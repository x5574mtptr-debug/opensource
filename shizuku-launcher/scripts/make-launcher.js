'use strict';
/**
 * 生成启动器 .bat
 *
 * 坑：cmd.exe 按系统 ANSI 码页（中文 Windows 是 GBK）读取 .bat，
 * 若文件是 UTF-8，含中文的行会乱码并吞掉后续内容，整条命令失效。
 * 因此这里：
 *   1) 内容全部使用 ASCII（用通配符避开中文 exe 名）
 *   2) 以 GBK 兼容方式落盘
 *
 * 用法：
 *   node make-launcher.js <输出路径> [--sub <相对子目录>]
 *   --sub 默认 "shizuku-launcher"，项目内使用 "."
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const outputs = [];
let sub = 'shizuku-launcher';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sub') {
    sub = args[i + 1];
    i++;
  } else {
    outputs.push(args[i]);
  }
}

if (!outputs.length) {
  console.error('用法: node make-launcher.js <输出路径> [--sub <相对子目录>]');
  process.exit(1);
}

const targetExpr =
  sub === '.' ? '%~dp0dist\\win-unpacked' : '%~dp0' + sub + '\\dist\\win-unpacked';

const content = [
  '@echo off',
  'rem Shizuku Launcher - direct start, no self-extraction.',
  'rem NOTE: keep this file ASCII-only. cmd.exe reads .bat using the',
  'rem system ANSI code page (GBK on Chinese Windows), so non-ASCII',
  'rem characters here can corrupt the following lines.',
  'setlocal',
  'set "TARGET=' + targetExpr + '"',
  'if not exist "%TARGET%" (',
  '  echo.',
  '  echo [ERROR] Folder not found:',
  '  echo   %TARGET%',
  '  echo.',
  '  pause',
  '  exit /b 1',
  ')',
  'pushd "%TARGET%"',
  'for %%f in (*.exe) do (',
  '  start "" "%%~f"',
  '  goto :launched',
  ')',
  ':launched',
  'popd',
  'endlocal',
  ''
].join('\r\n');

for (const t of outputs) {
  fs.mkdirSync(path.dirname(t), { recursive: true });
  // 内容全 ASCII，latin1 写入可保证无 BOM、无中文、GBK/UTF-8 解析一致
  fs.writeFileSync(t, Buffer.from(content, 'latin1'), 'binary');
  console.log('✓ ' + t);
}

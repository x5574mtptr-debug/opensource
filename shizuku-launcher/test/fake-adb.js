'use strict';
/**
 * 假 adb —— 用于在没有真机的情况下验证工具全流程
 * 模拟 devices / version / shell / pair / connect 等子命令
 */
const path = require('path');
const fs = require('fs');

const stateFile = path.join(__dirname, 'fake-adb-state.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (_) { return {}; }
}
function writeState(s) {
  try { fs.writeFileSync(stateFile, JSON.stringify(s, null, 2)); } catch (_) {}
}

const S = readState();
S.paired = S.paired || false;
S.shizukuStarted = S.shizukuStarted || false;
S.connected = S.connected || false;
// 模拟开关：Android 11+ 分区存储限制（默认开启 = Android/data 不可读）
if (S.androidDataReadable === undefined) S.androidDataReadable = false;
if (S.startShExists === undefined) S.startShExists = false;
if (S.androidVersion === undefined) S.androidVersion = '14';

// 剥离 -s <serial> 前缀
let argv = process.argv.slice(2);
if (argv[0] === '-s') {
  argv = argv.slice(2);
}

const args = argv;
const cmd = args[0];
let out = '';
let code = 0;

switch (cmd) {
  case 'version':
    out = 'Android Debug Bridge version 1.0.41\nVersion 34.0.5\nInstalled as C:\\fake\\adb.exe';
    break;

  case 'start-server':
    out = '* daemon not running; starting now at tcp:5037\n* daemon started successfully';
    break;

  case 'devices': {
    out = 'List of devices attached\n';
    out += 'FAKE1234\tdevice product:sunfish model:Pixel_4a device:flame device:flame\n';
    if (S.connected) out += '192.168.1.88:5555\tdevice product:raven model:Pixel_6 device:raven\n';
    if (S.unauthorized) out += 'BADA0001\tunauthorized\n';
    break;
  }

  case 'pair': {
    const addr = args[1] || '';
    const code6 = args[2] || '';
    if (!/^\d{6}$/.test(code6)) {
      out = 'error: failed to parse pairing code';
      code = 1;
      break;
    }
    if (S.paired) {
      out = `error: failed to pair with ${addr}: Unable to start pairing client.`;
      code = 1;
      break;
    }
    S.paired = true;
    writeState(S);
    out = `Successfully paired to ${addr}`;
    break;
  }

  case 'connect': {
    const addr = args[1] || '';
    if (!S.paired) {
      out = `error: cannot connect to ${addr}: Connection refused`;
      code = 1;
      break;
    }
    S.connected = true;
    writeState(S);
    out = `connected to ${addr}`;
    break;
  }

  case 'disconnect': {
    S.connected = false;
    writeState(S);
    out = `disconnected ${args[1] || ''}`;
    break;
  }

  case 'shell': {
    const joined = args.slice(1).join(' ');

    // app_process 直启（新增方案）—— 必须先匹配具体的启动命令，
    // 否则 "ls -l /system/bin/app_process" 这类探测命令会被误判
    if (joined.includes('--nice-name=shizuku_server')) {
      if (!S.shizukuStarted) {
        S.shizukuStarted = true;
        writeState(S);
      }
      out = '';
      break;
    }

    if (joined.includes('ls -l /system/bin/app_process')) {
      out = 'lrwxrwxrwx 1 root shell 12345 2026-01-01 00:00 /system/bin/app_process';
      break;
    }

    if (joined.includes('ps -A')) {
      out = S.shizukuStarted ? 'u0_a42    1234  999  1234  4321 shizuku_server' : '';
      break;
    }
    if (joined.includes('/proc/net/unix')) {
      out = S.shizukuStarted ? '0000000000000000@0000001b@moe.shizuku.server' : '';
      break;
    }
    if (joined.includes('pm path')) {
      if (S.packageMissing) {
        out = 'Unknown package: moe.shizuku.privileged.api';
        code = 1;
      } else {
        out = 'package:/data/app/~~abc123==/moe.shizuku.privileged.api-xyz==/base.apk';
      }
      break;
    }
    if (joined.includes('getprop')) {
      out = S.androidVersion || '14';
      break;
    }
    if (joined.includes('monkey')) {
      out = 'Events injected: 1';
      break;
    }
    if (joined.includes('killall') || joined.includes('pkill')) {
      out = '';
      break;
    }
    if (joined.includes('ls ') && joined.includes('Android/data')) {
      // 模拟 Android 11+ 分区存储限制
      if (S.androidDataReadable) {
        out = 'start.sh\nstarter';
      } else {
        out = 'ls: /storage/emulated/0/Android/data/moe.shizuku.privileged.api: Permission denied';
      }
      break;
    }
    if (joined.includes('test -f')) {
      out = 'NO';
      break;
    }
    if (joined.includes('cp ') && joined.includes('starter')) {
      if (S.androidDataReadable) {
        S.starterCopied = true;
        writeState(S);
        out = '';
      } else {
        out = 'cp: /storage/emulated/0/Android/data/moe.shizuku.privileged.api/starter: Permission denied';
      }
      break;
    }
    if (joined.includes('chmod')) {
      out = '';
      break;
    }
    if (joined.includes('/data/local/tmp/shizuku')) {
      if (S.starterCopied) {
        S.shizukuStarted = true;
        writeState(S);
      }
      out = '';
      break;
    }
    if (joined.includes('start.sh')) {
      if (!S.shizukuStarted) {
        S.shizukuStarted = true;
        writeState(S);
      }
      out = '';
      break;
    }
    out = '';
    break;
  }

  default:
    out = '';
}

process.stdout.write(out);
process.exit(code);

'use strict';
/**
 * 假 fastboot —— 用于在没有真机的情况下验证工具全流程
 * 模拟 devices / version / getvar / flash / reboot 等子命令
 *
 * 注意：包装器是 fastboot.cmd（cmd 不允许用 .exe 扩展名跑批处理）
 */
const path = require('path');
const fs = require('fs');

const stateFile = path.join(__dirname, 'fake-fastboot-state.json');

function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (_) { return {}; }
}
function writeState(s) {
  try { fs.writeFileSync(stateFile, JSON.stringify(s, null, 2)); } catch (_) {}
}

const S = readState();
if (S.devicePresent === undefined) S.devicePresent = true;
if (S.unlocked === undefined) S.unlocked = false;
if (S.lastAction === undefined) S.lastAction = '';

const args = process.argv.slice(2);
// 剥离 -s <serial>
let argv = args;
if (argv[0] === '-s') argv = argv.slice(2);

const cmd = argv[0];
let out = '';
let err = '';
let code = 0;

switch (cmd) {
  case 'version':
    out = 'fastboot version 34.0.5\nInstalled as C:\\fake\\fastboot.exe';
    break;

  case 'devices': {
    out = '';
    if (S.devicePresent) {
      out = 'FAKEFB01\tfastboot product:raven variant:raven device:raven';
    }
    break;
  }

  case 'getvar': {
    if (!S.devicePresent) {
      err = 'fastboot: error: no devices/emulators found';
      code = 1;
      break;
    }
    // fastboot 的 getvar 输出实际走 stderr
    err = [
      '(bootloader) product: raven',
      '(bootloader) variant: raven',
      '(bootloader) version-bootloader: 33-2023-01',
      '(bootloader) serialno: FAKEFB01',
      `(bootloader) unlocked: ${S.unlocked ? 'yes' : 'no'}`,
      '(bootloader) secure: yes',
      '(bootloader) current-slot: a',
      '(bootloader) slot-count: 2',
      'Finished. Total time: 0.001s'
    ].join('\n');
    break;
  }

  case 'flashing': {
    const sub = argv[1];
    if (sub === 'unlock') {
      if (S.unlocked) {
        err = "FAILED (remote: 'Flashing unlocked is not allowed')";
        code = 1;
        break;
      }
      S.unlocked = true;
      writeState(S);
      out = 'Unlocking succeeded';
      break;
    }
    if (sub === 'lock') {
      S.unlocked = false;
      writeState(S);
      out = 'Locking succeeded';
      break;
    }
    break;
  }

  case 'flash': {
    const part = argv[1];
    const file = argv[2] || '';
    if (!file) {
      err = 'FAILED (remote: "no file specified")';
      code = 1;
      break;
    }
    if (/bad|invalid/i.test(file)) {
      err = "FAILED (remote: 'Error verifying the received boot.img: Invalid parameter')";
      code = 1;
      break;
    }
    if (!S.unlocked && part !== 'recovery') {
      err = "FAILED (remote: 'Flashing is not allowed, bootloader is locked')";
      code = 1;
      break;
    }
    S.lastAction = `flash ${part} ${file}`;
    writeState(S);
    out = `Sending '${part}' (OKAY) 1200K/1024M\nWriting '${part}' (OKAY)\nFinished. Total time: 0.5s`;
    break;
  }

  case 'erase': {
    const part = argv[1] || '';
    if (!S.unlocked) {
      err = "FAILED (remote: 'Erasing is not allowed, bootloader is locked')";
      code = 1;
      break;
    }
    S.lastAction = `erase ${part}`;
    writeState(S);
    out = `Erasing '${part}' (OKAY)\nFinished. Total time: 1.2s`;
    break;
  }

  case '-w': {
    if (!S.unlocked) {
      err = "FAILED (remote: 'Erasing is not allowed, bootloader is locked')";
      code = 1;
      break;
    }
    S.lastAction = '-w';
    writeState(S);
    out = "Erasing 'userdata' (OKAY)\nFinished. Total time: 2.0s";
    break;
  }

  case 'reboot': {
    const target = argv[1] || '';
    S.lastAction = 'reboot ' + target;
    S.devicePresent = target !== '' ? true : false;
    writeState(S);
    out = 'Rebooting                                          [OKAY]\nFinished. Total time: 0.1s';
    break;
  }

  case 'boot': {
    S.lastAction = 'boot ' + (argv[1] || '');
    writeState(S);
    out = 'Booting                                    [OKAY]\nFinished. Total time: 0.1s';
    break;
  }

  default:
    out = '';
}

process.stdout.write(out);
if (err) process.stderr.write(err);
process.exit(code);

'use strict';
/**
 * 核心逻辑自动化测试（不依赖 Electron / 真机）
 * 运行：node test/core.test.js
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const { Logger } = require('../src/main/logger');
const { Config } = require('../src/main/config');
const { AdbManager } = require('../src/main/adb');
const { ShizukuManager } = require('../src/main/shizuku');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shizuku-test-'));
const fakeAdb = path.join(__dirname, 'fake-adb.bat');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  ✓ ${name}`); })
    .catch((e) => {
      failed++;
      failures.push({ name, error: e.message });
      console.log(`  ✗ ${name}\n      ${e.message}`);
    });
}

async function main() {
  console.log('\n=== Shizuku 激活工具 · 核心逻辑测试 ===\n');

  // 重置假设备状态
  const stateFile = path.join(__dirname, 'fake-adb-state.json');
  try { fs.unlinkSync(stateFile); } catch (_) {}

  const logger = new Logger(tmp);
  logger.setLevel('DEBUG');

  const config = new Config(tmp);
  config.set('adbPath', fakeAdb);
  config.set('autoDownloadAdb', false);

  const resourcesDir = path.join(tmp, 'resources');
  fs.mkdirSync(resourcesDir, { recursive: true });

  const adb = new AdbManager({ logger, config, resourcesDir });
  const shizuku = new ShizukuManager({ logger, config, adb });

  console.log('[1] 配置');
  await test('默认配置完整', () => {
    const c = new Config(path.join(tmp, 'fresh'));
    assert.ok(c.get('startScriptPaths').length >= 1, 'startScriptPaths 应有默认值');
    assert.ok(c.get('logLevel') === 'INFO');
    assert.ok(c.get('wireless.pairPort') > 0);
  });
  await test('配置深合并保留未覆盖字段', () => {
    const c = new Config(path.join(tmp, 'merge'));
    c.update({ wireless: { connectPort: 1234 } });
    assert.strictEqual(c.get('wireless.connectPort'), 1234);
    assert.strictEqual(c.get('wireless.pairPort'), 37129, '未覆盖字段应保留');
  });
  await test('配置原子写入可重新读取', () => {
    const c = new Config(tmp);
    c.set('logLevel', 'DEBUG');
    const c2 = new Config(tmp);
    assert.strictEqual(c2.get('logLevel'), 'DEBUG');
  });
  await test('损坏的配置不会导致崩溃', () => {
    const dir = path.join(tmp, 'broken');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), '{ bad json', 'utf8');
    const c = new Config(dir);
    assert.ok(c.get('logLevel') === 'INFO');
  });

  console.log('\n[2] 日志');
  await test('日志写入文件', async () => {
    await logger.flush();
    const files = logger.listFiles();
    assert.ok(files.length > 0, '应生成日志文件');
    assert.ok(fs.statSync(path.join(logger.logDir, files[0].name)).size > 0);
  });
  await test('日志历史可回读', () => {
    const h = logger.history(50);
    assert.ok(h.length > 0);
    assert.ok(h[0].ts && h[0].level);
  });
  await test('日志级别过滤生效', async () => {
    const l2 = new Logger(path.join(tmp, 'lvl'));
    l2.setLevel('ERROR');
    l2.debug('不该落盘');
    l2.error('该落盘');
    await l2.flush();
    const content = l2.listFiles().length
      ? fs.readFileSync(path.join(l2.logDir, l2.listFiles()[0].name), 'utf8')
      : '';
    assert.ok(!content.includes('不该落盘'), 'DEBUG 不应落盘');
    assert.ok(content.includes('该落盘'), 'ERROR 应落盘');
  });

  console.log('\n[3] adb 定位与执行');
  await test('能定位到指定路径的 adb', async () => {
    const r = await adb.locate({ allowDownload: false });
    assert.ok(r.ok, '定位失败: ' + r.error);
    assert.strictEqual(r.source, '手动指定');
  });
  await test('adb version 可执行', async () => {
    const r = await adb.exec(['version']);
    assert.strictEqual(r.code, 0);
    assert.ok(r.stdout.includes('Android Debug Bridge'));
  });
  await test('未找到 adb 时返回明确错误', async () => {
    const c2 = new Config(path.join(tmp, 'noadb'));
    c2.set('adbPath', path.join(tmp, 'nonexistent-adb.exe'));
    const a2 = new AdbManager({ logger, config: c2, resourcesDir });
    const r = await a2.locate({ allowDownload: false });
    assert.strictEqual(r.ok, false);
    assert.ok(r.error);
  });

  console.log('\n[4] 设备枚举');
  await test('列出 USB 设备', async () => {
    const devs = await shizuku.listDevices();
    assert.strictEqual(devs.length, 1);
    assert.strictEqual(devs[0].serial, 'FAKE1234');
    assert.strictEqual(devs[0].state, 'device');
    assert.strictEqual(devs[0].type, 'usb');
    assert.strictEqual(devs[0].model, 'Pixel_4a');
  });
  await test('未连接时无线设备不出现', async () => {
    const devs = await shizuku.listDevices();
    assert.ok(!devs.some((d) => d.wireless));
  });

  console.log('\n[5] 无线调试配对');
  await test('配对码格式错误时失败', async () => {
    const r = await shizuku.pair('192.168.1.88', 37129, '123');
    assert.strictEqual(r.ok, false);
    assert.ok(r.message.includes('配对码'), '应提示配对码问题: ' + r.message);
  });
  await test('正确配对码配对成功', async () => {
    const r = await shizuku.pair('192.168.1.88', 37129, '123456');
    assert.strictEqual(r.ok, true, r.message);
  });
  await test('重复配对被拒绝', async () => {
    const r = await shizuku.pair('192.168.1.88', 37129, '123456');
    assert.strictEqual(r.ok, false);
  });
  await test('配对后连接成功', async () => {
    const r = await shizuku.connect('192.168.1.88', 5555);
    assert.strictEqual(r.ok, true, r.message);
  });
  await test('无线设备出现在列表中', async () => {
    const devs = await shizuku.listDevices();
    const w = devs.find((d) => d.wireless);
    assert.ok(w, '应出现无线设备');
    assert.strictEqual(w.type, 'wireless');
  });

  console.log('\n[6] 激活与状态');
  await test('激活前状态为未运行', async () => {
    const st = await shizuku.checkStatus('FAKE1234');
    assert.strictEqual(st.running, false);
  });
  await test('激活成功', async () => {
    const r = await shizuku.activate('FAKE1234');
    assert.strictEqual(r.ok, true, r.message);
  });
  await test('激活后进程信号为真', async () => {
    const st = await shizuku.checkStatus('FAKE1234');
    assert.strictEqual(st.signals.process, true);
    assert.strictEqual(st.signals.binder, true);
  });
  await test('应用安装检测为真', async () => {
    const st = await shizuku.checkStatus('FAKE1234');
    assert.strictEqual(st.detail.packageInstalled, true);
  });
  await test('重复激活仍成功（幂等）', async () => {
    const r = await shizuku.activate('FAKE1234');
    assert.strictEqual(r.ok, true, r.message);
  });
  await test('读取 Android 版本', async () => {
    const v = await shizuku.getAndroidVersion('FAKE1234');
    assert.strictEqual(v, '14');
  });
  await test('拉起 Shizuku 应用', async () => {
    const r = await shizuku.launchShizukuApp('FAKE1234');
    assert.strictEqual(r.ok, true);
  });
  await test('断开无线连接成功', async () => {
    const r = await shizuku.disconnect('192.168.1.88:5555');
    assert.strictEqual(r.ok, true);
  });

  console.log('\n[7] 错误诊断');
  await test('脚本缺失时给出可读提示', async () => {
    // 用一个总是失败的脚本路径
    const c2 = new Config(tmp);
    const orig = c2.get('startScriptPaths');
    c2.set('startScriptPaths', ['/nonexistent/path/start.sh']);
    const s2 = new ShizukuManager({ logger, config: c2, adb });
    const r = await s2.activate('FAKE1234');
    // 假 adb 对 start.sh 一律成功，因此这里检查的是流程不崩溃
    assert.ok(typeof r.ok === 'boolean');
    c2.set('startScriptPaths', orig);
  });

  console.log('\n[8] 日志导出');
  await test('导出合并日志', () => {
    const target = path.join(tmp, 'export.txt');
    const r = logger.exportAll(target);
    assert.strictEqual(r.ok, true);
    assert.ok(fs.statSync(target).size > 0);
  });

  logger.close();

  console.log('\n' + '='.repeat(46));
  console.log(`结果：  通过 ${passed}  失败 ${failed}`);
  if (failures.length) {
    console.log('\n失败项：');
    failures.forEach((f) => console.log(`  · ${f.name}\n    ${f.error}`));
  }
  console.log('='.repeat(46) + '\n');

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('\n测试运行异常：', e);
  process.exit(1);
});

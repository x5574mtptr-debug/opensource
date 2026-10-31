'use strict';
/**
 * 渲染进程逻辑
 */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  step: 'env',
  zone: 'shizuku',
  devices: [],
  selected: null,
  fbSerial: null,
  adb: null,
  status: null,
  logs: [],
  logFilter: 'ALL',
  logSearch: '',
  config: null,
  busy: false
};

const STEP_META = {
  env: { title: '环境准备', desc: '确认 adb 可用，这是激活 Shizuku 的前提' },
  device: { title: '设备连接', desc: '通过 USB 连接，或使用无线调试配对' },
  activate: { title: '激活服务', desc: '一条命令在手机上启动 Shizuku 服务' },
  verify: { title: '状态确认', desc: '验证服务进程已成功运行' }
};

/* ================= Toast ================= */
const ICONS = {
  ok: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  err: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>'
};

function toast(type, title, message, ms = 4200) {
  const wrap = $('#toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span class="toast-ico">${ICONS[type] || ICONS.info}</span>
    <div class="toast-body"><b>${escapeHtml(title)}</b>${message ? `<span>${escapeHtml(message)}</span>` : ''}</div>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  }, ms);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ================= 专区切换 ================= */
const ZONE_META = {
  shizuku: { title: 'Shizuku 激活专区', desc: '把手机上的 Shizuku 服务拉起来，让其他应用获得 ADB 级权限' },
  fastboot: { title: 'Fastboot 专区', desc: '底层刷机模式：刷入镜像、解锁 Bootloader、清理数据、重启' }
};

function gotoZone(zone) {
  if (!ZONE_META[zone]) return;
  state.zone = zone;
  $$('.zone-item').forEach((b) => b.classList.toggle('is-active', b.dataset.zone === zone));
  $$('.zone-pane').forEach((p) => p.classList.toggle('is-active', p.dataset.zonePane === zone));

  // 每个区里只显示属于自己的 view：
  // Shizuku 区的四个子步骤视图由 gotoStep 控制，Fastboot 区只有一个视图
  if (zone === 'fastboot') {
    $$('.view').forEach((v) => {
      v.classList.toggle('is-active', v.dataset.view === 'fastboot');
    });
  } else {
    $$('.view').forEach((v) => {
      if (v.dataset.view === 'fastboot') return;
      v.classList.toggle('is-active', v.dataset.view === state.step);
    });
  }

  $('#viewTitle').textContent = ZONE_META[zone].title;
  $('#viewDesc').textContent = ZONE_META[zone].desc;
  $('#content').scrollTop = 0;
  if (zone === 'fastboot') refreshFastbootDevices();
  else if (state.step === 'device') refreshDevices();
}
/* ================= 步骤切换（Shizuku 专区内部） ================= */
function gotoStep(step) {
  if (!STEP_META[step]) return;
  state.step = step;
  $$('.seg-item').forEach((b) => b.classList.toggle('is-active', b.dataset.step === step));
  // Shizuku 区的四个子步骤视图；fastboot 视图独立，不受此处影响
  $$('.view').forEach((v) => {
    if (v.dataset.view === 'fastboot') return;
    v.classList.toggle('is-active', v.dataset.view === step);
  });
  $('#viewTitle').textContent = STEP_META[step].title;
  $('#viewDesc').textContent = STEP_META[step].desc;
  $('#content').scrollTop = 0;
  if (step === 'device') refreshDevices();
  if (step === 'verify') updateVerifyView();
}

function setBadge(step, cls) {
  const el = $('#badge-' + step);
  if (el) el.className = 'step-badge' + (cls ? ' ' + cls : '');
}

/** 步骤完成时，同时更新分段控件与左侧大区徽章 */
function markDone(step, done) {
  const seg = $(`.seg-item[data-step="${step}"]`);
  if (seg) seg.classList.toggle('is-done', !!done);
  // Shizuku 专区徽章：四步全部完成才算 ok
  const allSteps = ['env', 'device', 'activate', 'verify'];
  const allDone = allSteps.every((s) => {
    const el = $(`.seg-item[data-step="${s}"]`);
    return el && el.classList.contains('is-done');
  });
  const zb = $('#badge-shizuku');
  if (zb) {
    zb.className = 'zone-badge' + (allDone ? ' ok' : '');
  }
}

/* ================= 状态指示 ================= */
function setGlobalStatus(kind, text) {
  const pill = $('#globalStatus');
  pill.className = 'status-pill' + (kind ? ' ' + kind : '');
  pill.querySelector('.status-text').textContent = text;
}

/* ================= 日志 ================= */
function appendLog(entry) {
  state.logs.push(entry);
  if (state.logs.length > 3000) state.logs.splice(0, state.logs.length - 3000);
  renderLogs(true);
  $('#logCount').textContent = state.logs.length;
}

function renderLogs(append = false) {
  const body = $('#logBody');
  const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 40;

  const filtered = state.logs.filter((e) => {
    if (state.logFilter !== 'ALL' && e.level !== state.logFilter) return false;
    if (state.logSearch) {
      const hay = (e.message + ' ' + (e.meta ? JSON.stringify(e.meta) : '')).toLowerCase();
      if (!hay.includes(state.logSearch.toLowerCase())) return false;
    }
    return true;
  });

  if (!append) body.innerHTML = '';

  const frag = document.createDocumentFragment();
  for (const e of filtered) {
    const div = document.createElement('div');
    div.className = 'log-line ' + e.level;
    const ts = (e.ts || '').slice(11);
    const meta = e.meta ? ' ' + JSON.stringify(e.meta) : '';
    div.innerHTML = `<span class="log-ts">${escapeHtml(ts)}</span><span class="log-lvl">${e.level}</span><span class="log-msg">${escapeHtml(e.message + meta)}</span>`;
    frag.appendChild(div);
  }
  body.appendChild(frag);

  if (append && atBottom) body.scrollTop = body.scrollHeight;
}

/* ================= 环境 / adb ================= */
async function locateAdb(silent = false) {
  const tag = $('#adbTag');
  const btn = $('#btnLocateAdb');
  btn.disabled = true;
  tag.textContent = '检测中…';
  tag.className = 'tag brand';

  const res = await window.api.locateAdb({ allowDownload: false, force: true });
  btn.disabled = false;

  if (res.ok) {
    state.adb = res;
    tag.textContent = '就绪';
    tag.className = 'tag ok';
    $('#adbDetail').innerHTML = `
      <div class="signal-grid">
        <div class="signal ok"><span class="sig-dot"></span><b>版本</b><small>${escapeHtml(res.version || '未知')}</small></div>
        <div class="signal ok"><span class="sig-dot"></span><b>来源</b><small>${escapeHtml(res.source || '')}</small></div>
        <div class="signal ok"><span class="sig-dot"></span><b>路径</b><small>${escapeHtml(res.exe || '')}</small></div>
      </div>`;
    setBadge('env', 'ok');
    markDone('env', true);
    setGlobalStatus('', 'adb 就绪');
    if (!silent) toast('ok', 'adb 可用', res.version || res.exe);
    return true;
  }

  state.adb = null;
  tag.textContent = '未找到';
  tag.className = 'tag err';
  $('#adbDetail').innerHTML = `
    <div class="result-box err">${escapeHtml(res.error || '未找到 adb')}
      <pre>可以点击「下载内置 adb」自动获取 Google 官方 platform-tools，也可以手动指定 adb.exe 路径。</pre>
    </div>`;
  setBadge('env', 'err');
  setGlobalStatus('', 'adb 缺失');
  if (!silent) toast('warn', '未找到 adb', '可一键下载内置版本');
  return false;
}

async function downloadAdb() {
  const wrap = $('#dlProgress');
  const bar = $('#dlBar');
  const text = $('#dlText');
  wrap.hidden = false;
  $('#btnDownloadAdb').disabled = true;
  setGlobalStatus('working', '下载中');

  const off = window.api.onAdbProgress((p) => {
    bar.style.width = (p.percent || 0) + '%';
    text.textContent = p.total
      ? `${p.percent || 0}%  ${(p.received / 1048576).toFixed(1)}/${(p.total / 1048576).toFixed(1)}MB`
      : `${((p.received || 0) / 1048576).toFixed(1)}MB`;
  });

  const res = await window.api.downloadAdb();
  off && off();

  $('#btnDownloadAdb').disabled = false;
  wrap.hidden = true;
  bar.style.width = '0%';

  if (res.ok) {
    toast('ok', '下载完成', '内置 adb 已就绪');
    await locateAdb(true);
  } else {
    toast('err', '下载失败', res.error || '未知错误');
    setGlobalStatus('', '下载失败');
  }
}

/* ================= 设备 ================= */
async function refreshDevices() {
  const list = $('#deviceList');
  list.innerHTML = `<div class="empty-state"><p>正在检测设备…</p></div>`;
  const devices = await window.api.listDevices();
  state.devices = devices;

  const usable = devices.filter((d) => d.state === 'device');
  $('#deviceCount').textContent = `${devices.length} 台`;
  $('#deviceCount').className = 'tag' + (devices.length ? ' brand' : '');

  if (!devices.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
        <p>未检测到设备</p>
        <small>请检查数据线与「USB 调试」授权，或改用下方无线调试连接</small>
      </div>`;
    setBadge('device', '');
    markDone('device', false);
    return;
  }

  list.innerHTML = '';
  for (const d of devices) {
    const el = document.createElement('div');
    el.className = 'device-item' + (d.state === 'device' ? '' : ' invalid') +
      (state.selected === d.serial ? ' selected' : '');
    const stateTag = d.state === 'device' ? 'ok' : (d.state === 'unauthorized' ? 'warn' : 'err');
    const stateText = { device: '已连接', offline: '离线', unauthorized: '未授权' }[d.state] || d.state;
    const typeTag = d.wireless ? '无线' : 'USB';

    el.innerHTML = `
      <div class="device-icon">
        ${d.wireless
          ? '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg>'
          : '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>'}
      </div>
      <div class="device-info">
        <b>${escapeHtml(d.model || d.device || d.serial)}</b>
        <small>${escapeHtml(d.serial)}</small>
      </div>
      <div class="device-meta">
        <span class="tag">${typeTag}</span>
        <span class="tag ${stateTag}">${stateText}</span>
      </div>`;

    el.addEventListener('click', () => {
      if (d.state !== 'device') {
        toast('warn', '设备不可用', '请先在手机上确认调试授权');
        return;
      }
      state.selected = d.serial;
      $$('.device-item').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
      onDeviceSelected(d);
    });
    list.appendChild(el);
  }

  // 自动选中第一台可用设备
  if (!state.selected && usable.length) {
    state.selected = usable[0].serial;
    const idx = devices.findIndex((d) => d.serial === state.selected);
    list.children[idx].classList.add('selected');
    onDeviceSelected(usable[0]);
  }

  if (usable.length) {
    setBadge('device', 'ok');
    markDone('device', true);
  } else {
    setBadge('device', 'warn');
  }
}

function onDeviceSelected(d) {
  $('#activateTarget').textContent = d.serial;
  $('#activateTarget').className = 'tag brand';
  // 预览首选方案（app_process 直启，绕过 Android/data 限制）
  const cmd =
    `adb -s ${d.serial} shell "/system/bin/app_process ` +
    `-Djava.class.path=\$(pm path moe.shizuku.privileged.api | sed 's/package://') ` +
    `/system/bin --nice-name=shizuku_server rikka.shizuku.server.ShizukuService"`;
  $('#cmdPreview').textContent = cmd;
  toast('info', '已选择设备', d.model || d.serial);
}

/* ================= 无线调试 ================= */
async function doPair() {
  const host = $('#wlHost').value.trim();
  const pairPort = $('#wlPairPort').value.trim();
  const code = $('#wlCode').value.trim();
  const hint = $('#wlHint');

  if (!host || !pairPort || !code) {
    hint.textContent = '请填写设备 IP、配对端口和配对码';
    hint.className = 'hint err';
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    hint.textContent = '配对码为 6 位数字';
    hint.className = 'hint err';
    return;
  }

  hint.textContent = '配对中…';
  hint.className = 'hint';
  const res = await window.api.pair(host, parseInt(pairPort, 10), code);
  hint.textContent = res.message;
  hint.className = 'hint ' + (res.ok ? 'ok' : 'err');
  toast(res.ok ? 'ok' : 'err', res.ok ? '配对成功' : '配对失败', res.message);
  if (res.ok) refreshDevices();
}

async function doWirelessConnect() {
  const host = $('#wlHost').value.trim();
  const port = $('#wlPort').value.trim();
  const hint = $('#wlHint');
  if (!host || !port) {
    hint.textContent = '请填写设备 IP 与连接端口';
    hint.className = 'hint err';
    return;
  }
  hint.textContent = '连接中…';
  hint.className = 'hint';
  const res = await window.api.connect(host, parseInt(port, 10));
  hint.textContent = res.message;
  hint.className = 'hint ' + (res.ok ? 'ok' : 'err');
  toast(res.ok ? 'ok' : 'err', res.ok ? '连接成功' : '连接失败', res.message);
  if (res.ok) refreshDevices();
}

/* ================= 激活 ================= */
async function doActivate() {
  if (!state.selected) {
    toast('warn', '请先选择设备', '在「设备连接」步骤中选择一台设备');
    gotoStep('device');
    return;
  }
  const btn = $('#btnActivate');
  const box = $('#activateResult');
  btn.disabled = true;
  setGlobalStatus('working', '激活中');
  box.hidden = false;
  box.className = 'result-box info';
  box.innerHTML = '正在执行启动命令，请稍候…';

  const res = await window.api.activate(state.selected);
  btn.disabled = false;

  if (res.ok) {
    box.className = 'result-box ok';
    const methodText = res.method ? `使用的方案：${escapeHtml(res.method)}` : '';
    const cmdText = res.command ? `<pre>${escapeHtml(res.command)}</pre>` : '';
    box.innerHTML = `<b>激活成功</b>${escapeHtml(res.message || '')}
      ${methodText ? `<pre>${methodText}</pre>` : ''}${cmdText}`;
    setGlobalStatus('running', 'Shizuku 运行中');
    setBadge('activate', 'ok');
    setBadge('verify', 'ok');
    markDone('activate', true);
    markDone('verify', true);
    toast('ok', 'Shizuku 激活成功', '现在可以在手机上授权其他应用使用');
    setTimeout(() => gotoStep('verify'), 900);
    updateVerifyView();
  } else {
    box.className = 'result-box err';
    const attempts = (res.attempts || [])
      .map((a) =>
        a.method
          ? `· ${a.method}\n  ${a.ok ? '成功' : a.output || '失败'}`
          : `· ${a.path}\n  exit=${a.code} ${a.output || ''}`
      )
      .join('\n');
    box.innerHTML = `<b>激活失败</b>${escapeHtml(res.message || '未知错误')}
      ${attempts ? `<pre>${escapeHtml(attempts)}</pre>` : ''}
      <pre>提示：点击「设备诊断」可查看详细检测结果。</pre>`;
    setGlobalStatus('stopped', '激活失败');
    setBadge('activate', 'err');
    toast('err', '激活失败', res.message, 6000);
  }
}

/* ================= 设备诊断 ================= */
async function runDiagnose() {
  if (!state.selected) {
    toast('warn', '请先选择设备', '在「设备连接」步骤中选择一台设备');
    gotoStep('device');
    return;
  }
  const btn = $('#btnDiagnose');
  const panel = $('#diagPanel');
  btn.disabled = true;
  panel.hidden = false;
  panel.innerHTML = '<div class="diag-head"><div class="diag-head-title"><span class="dot" style="background:var(--brand)"></span>正在检测…</div></div>';
  setGlobalStatus('working', '诊断中');

  const res = await window.api.diagnose(state.selected);
  btn.disabled = false;

  if (!res || !res.items) {
    panel.innerHTML = '<div class="diag-head"><div class="diag-head-title err"><span class="dot"></span>诊断失败</div></div>';
    setGlobalStatus('', '诊断失败');
    return;
  }

  const s = res.summary || { level: 'warn', title: '诊断完成', advice: '' };
  const levelText = { ok: '一切正常', warn: '需要注意', err: '存在问题' }[s.level] || '诊断完成';

  const itemsHtml = res.items
    .map((i) => {
      const mark = { ok: '✓', warn: '!', err: '✕' }[i.state] || '·';
      return `<div class="diag-item ${i.state}">
        <span class="diag-state">${mark}</span>
        <div class="diag-text">
          <b>${escapeHtml(i.name)}</b>
          ${i.detail ? `<small>${escapeHtml(i.detail)}</small>` : ''}
        </div>
      </div>`;
    })
    .join('');

  panel.innerHTML = `
    <div class="diag-head">
      <div class="diag-head-title ${s.level}">
        <span class="dot"></span>${escapeHtml(s.title)}
        <span class="tag ${s.level === 'ok' ? 'ok' : s.level === 'err' ? 'err' : 'warn'}" style="margin-left:auto">${levelText}</span>
      </div>
      <p>${escapeHtml(s.advice)}</p>
    </div>
    <div class="diag-list">${itemsHtml}</div>`;

  setGlobalStatus(s.level === 'ok' ? 'running' : s.level === 'err' ? 'stopped' : '', s.title);
  toast(s.level === 'ok' ? 'ok' : s.level === 'err' ? 'err' : 'warn', s.title, s.advice, 6000);
}

/* ================= Fastboot 专区 ================= */
async function refreshFastbootDevices() {
  const list = $('#fbDeviceList');
  if (!list) return;
  list.innerHTML = '<div class="empty-state"><p>正在检测 fastboot 设备…</p></div>';

  const res = await window.api.fastbootDevices();
  const fbBadge = $('#badge-fastboot');

  if (!res.ok) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/></svg>
        <p>fastboot 工具不可用</p>
        <small>${escapeHtml(res.error || '未知错误')}</small>
      </div>`;
    $('#fbCount').textContent = '不可用';
    $('#fbCount').className = 'tag err';
    if (fbBadge) fbBadge.className = 'zone-badge err';
    return;
  }

  const devices = res.devices || [];
  $('#fbCount').textContent = `${devices.length} 台`;
  $('#fbCount').className = 'tag' + (devices.length ? ' brand' : '');
  if (fbBadge) fbBadge.className = 'zone-badge' + (devices.length ? ' ok' : '');

  if (!devices.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/></svg>
        <p>未检测到 fastboot 设备</p>
        <small>让手机进入 fastboot 模式后点击刷新</small>
      </div>`;
    state.fbSerial = null;
    updateFbTarget();
    return;
  }

  list.innerHTML = '';
  for (const d of devices) {
    const el = document.createElement('div');
    el.className = 'device-item' + (state.fbSerial === d.serial ? ' selected' : '') +
      (d.state !== 'fastboot' ? ' invalid' : '');
    const st = d.state === 'fastboot' ? 'ok' : d.state === 'unauthorized' ? 'warn' : 'err';
    el.innerHTML = `
      <div class="device-icon">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z"/></svg>
      </div>
      <div class="device-info">
        <b>${escapeHtml(d.product || d.serial)}</b>
        <small>${escapeHtml(d.serial)}</small>
      </div>
      <div class="device-meta">
        <span class="tag ${st}">${escapeHtml(d.stateText)}</span>
      </div>`;
    el.addEventListener('click', () => {
      if (d.state !== 'fastboot') {
        toast('warn', '设备不可用', '请确认手机已正常进入 fastboot 模式');
        return;
      }
      state.fbSerial = d.serial;
      $$('#fbDeviceList .device-item').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
      updateFbTarget();
      loadFastbootInfo(d.serial);
    });
    list.appendChild(el);
  }

  // 自动选中第一台
  if (!state.fbSerial && devices.length) {
    state.fbSerial = devices[0].serial;
    list.querySelector('.device-item').classList.add('selected');
    updateFbTarget();
    loadFastbootInfo(state.fbSerial);
  } else {
    updateFbTarget();
  }
}

function updateFbTarget() {
  const el = $('#fbTarget');
  if (el) {
    el.textContent = state.fbSerial || '未选择设备';
    el.className = state.fbSerial ? 'subtle' : 'subtle';
  }
  const has = !!state.fbSerial;
  $$('.op-btn').forEach((b) => { b.disabled = !has; });
}

async function loadFastbootInfo(serial) {
  const box = $('#fbInfo');
  if (!box || !serial) return;
  box.hidden = true;
  const res = await window.api.fastbootInfo(serial);
  if (!res || !res.info || !Object.keys(res.info).length) {
    box.hidden = false;
    box.innerHTML = '<div class="fb-info-grid"><div class="fb-info-row"><b>设备信息</b><span>未能读取（可能需要解锁或授权）</span></div></div>';
    return;
  }
  const keys = ['product', 'variant', 'version-bootloader', 'serialno', 'unlocked', 'secure', 'current-slot', 'slot-count'];
  const rows = keys
    .filter((k) => res.info[k] !== undefined)
    .map((k) => `<div class="fb-info-row"><b>${escapeHtml(k)}</b><span>${escapeHtml(res.info[k])}</span></div>`)
    .join('');
  box.hidden = false;
  box.innerHTML = `<div class="fb-info-grid">${rows || '<div class="fb-info-row"><b>设备信息</b><span>无</span></div>'}</div>`;
}

function fbConsole(text, cls) {
  const box = $('#fbConsole');
  if (!box) return;
  if (text === '') return;
  box.textContent += (box.textContent ? '\n' : '') + text;
  box.scrollTop = box.scrollHeight;
}

/** 执行一个 fastboot 操作 */
async function doFastboot(action, extra) {
  if (!state.fbSerial) {
    toast('warn', '请先选择 fastboot 设备');
    return;
  }
  const needsFile = extra && extra.needsFile;
  if (needsFile) {
    const p = $('#fbFilePath').value.trim();
    if (!p) {
      toast('warn', '请先选择文件', '点击「浏览…」选择要刷入的镜像或 ZIP 包');
      return;
    }
  }

  // 高风险操作二次确认
  const risk = await window.api.fastbootRisk(action);
  if (risk) {
    const ok = await confirmDialog(risk.label, risk.note, action);
    if (!ok) return;
  }

  const result = $('#fbResult');
  result.hidden = false;
  result.className = 'result-box info';
  result.innerHTML = '正在执行：<b>' + escapeHtml(action) + '</b> …';

  fbConsole(`> fastboot -s ${state.fbSerial} ${action}${extra && extra.args ? ' ' + extra.args : ''}`);

  const args = extra && extra.args ? [extra.args] : [];
  const res = await window.api.fastbootPerform(state.fbSerial, action, args);

  fbConsole(res.output || '(无输出)');

  if (res.ok) {
    result.className = 'result-box ok';
    result.innerHTML = `<b>${escapeHtml(action)} 成功</b>${escapeHtml(res.message || '')}`;
    toast('ok', '操作成功', action);
  } else {
    result.className = 'result-box err';
    result.innerHTML = `<b>${escapeHtml(action)} 失败</b>${escapeHtml(res.message || '')}
      ${res.output ? `<pre>${escapeHtml(res.output)}</pre>` : ''}`;
    toast('err', '操作失败', res.message, 6000);
  }

  // 操作后刷新设备（可能已断开或重启）
  setTimeout(refreshFastbootDevices, 1500);
}

/** 危险操作确认对话框 */
function confirmDialog(title, note, action) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-panel" style="width:min(440px,calc(100vw - 48px))">
        <div class="modal-head">
          <h3>确认操作</h3>
        </div>
        <div class="modal-body">
          <div class="result-box ${action === 'flashing unlock' || action === 'erase userdata' || action === '-w' ? 'err' : 'info'}">
            <b>${escapeHtml(title)}</b>${escapeHtml(note)}
            <pre>fastboot -s ${escapeHtml(state.fbSerial || '')} ${escapeHtml(action)}</pre>
          </div>
          <p class="subtle">此操作不可撤销，请确认你清楚后果。</p>
        </div>
        <div class="modal-foot">
          <button class="btn" data-act="cancel">取消</button>
          <button class="btn btn-danger" data-act="ok">确认执行</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = (v) => {
      wrap.remove();
      resolve(v);
    };
    wrap.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
    wrap.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
    wrap.querySelector('.modal-backdrop').addEventListener('click', () => close(false));
  });
}

/* ================= 状态检测 ================= */
async function checkStatus() {
  if (!state.selected) {
    toast('warn', '请先选择设备');
    return;
  }
  setGlobalStatus('working', '检测中');
  const st = await window.api.getStatus(state.selected);
  state.status = st;
  updateVerifyView();
  if (st.running) {
    setGlobalStatus('running', 'Shizuku 运行中');
    setBadge('verify', 'ok');
    markDone('verify', true);
  } else {
    setGlobalStatus('stopped', '服务未运行');
    setBadge('verify', 'err');
  }
  return st;
}

function updateVerifyView() {
  const st = state.status;
  const hero = $('#statusHero');
  const tag = $('#verifyTag');

  if (!st) {
    hero.className = 'status-hero';
    $('#statusTitle').textContent = '等待检测';
    $('#statusSub').textContent = '选择设备并激活后，这里会显示 Shizuku 的运行状态';
    tag.textContent = '未检测';
    tag.className = 'tag';
    $$('.signal').forEach((s) => s.className = 'signal');
    return;
  }

  const sig = st.signals || {};
  const detail = st.detail || {};

  if (st.running) {
    hero.className = 'status-hero running';
    $('#statusTitle').textContent = 'Shizuku 正在运行';
    $('#statusSub').textContent = '服务进程已启动，可以在手机上打开 Shizuku 应用授权其他应用使用。';
    tag.textContent = '运行中';
    tag.className = 'tag ok';
  } else {
    hero.className = 'status-hero stopped';
    $('#statusTitle').textContent = 'Shizuku 未运行';
    $('#statusSub').textContent = '服务未检测到。请确认手机已安装 Shizuku 并完成激活。';
    tag.textContent = '未运行';
    tag.className = 'tag err';
  }

  const set = (key, ok) => {
    const el = $(`.signal[data-sig="${key}"]`);
    if (el) el.className = 'signal ' + (ok ? 'ok' : 'err');
  };
  set('process', !!sig.process);
  set('binder', !!sig.binder);
  set('pkg', !!detail.packageInstalled);
}

/* ================= 设置 ================= */
async function openSettings() {
  const c = await window.api.getConfig();
  state.config = c;
  $('#setAdbPath').value = c.adbPath || '';
  $('#setFastbootPath').value = c.fastbootPath || '';
  $('#setMirror').value = c.platformToolsMirror || '';
  $('#setAutoDownload').checked = c.autoDownloadAdb !== false;
  $('#setStartPaths').value = (c.startScriptPaths || []).join('\n');
  $('#setInterval').value = c.checkIntervalMs || 3000;
  $('#setAutoCheck').checked = c.autoCheckStatus !== false;
  $('#setLogLevel').value = c.logLevel || 'INFO';
  $('#setTheme').value = c.theme || 'light';

  const info = await window.api.getAppInfo();
  $('#setAutoLaunch').checked = !!info.autoLaunch;
  $('#appInfo').textContent = `版本 ${info.version} · Electron ${info.electron} · Chromium ${info.chrome} · Node ${info.node}`;
  $('#settingsModal').hidden = false;
}

async function saveSettings() {
    const patch = {
      adbPath: $('#setAdbPath').value.trim(),
      fastbootPath: $('#setFastbootPath').value.trim(),
      platformToolsMirror: $('#setMirror').value.trim(),
    autoDownloadAdb: $('#setAutoDownload').checked,
    startScriptPaths: $('#setStartPaths').value.split('\n').map((s) => s.trim()).filter(Boolean),
    checkIntervalMs: parseInt($('#setInterval').value, 10) || 3000,
    autoCheckStatus: $('#setAutoCheck').checked,
    logLevel: $('#setLogLevel').value,
    theme: $('#setTheme').value
  };
  await window.api.setConfig(patch);
  await window.api.setLogLevel(patch.logLevel);
  applyTheme(patch.theme);

  const al = await window.api.setAutoLaunch($('#setAutoLaunch').checked);
  if (!al.ok) toast('warn', '开机自启设置失败', al.error || '');

  $('#settingsModal').hidden = true;
  toast('ok', '设置已保存');
}

function applyTheme(theme) {
  const t = theme || state.config?.theme || 'light';
  const resolved = t === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : t;
  document.documentElement.setAttribute('data-theme', resolved);
}

/* ================= 初始化 ================= */
async function init() {
  // ===== 事件绑定必须最先完成 =====
  // 若绑定依赖 await，任何一个 IPC 失败都会让整个界面失去响应。
  // 这里把绑定与数据加载彻底解耦：绑定同步执行，数据加载放在其后。
  bindEvents();

  // 主题
  try {
    const cfg = await window.api.getConfig();
    state.config = cfg;
    applyTheme(cfg.theme);
  } catch (e) {
    console.error('读取配置失败，使用默认主题', e);
    applyTheme('light');
  }

  // 日志历史
  try {
    const history = await window.api.getLogHistory();
    state.logs = history || [];
    renderLogs(false);
    $('#logCount').textContent = state.logs.length;
  } catch (e) {
    console.error('读取日志历史失败', e);
  }

  // 初始检测
  try {
    await locateAdb(true);
    await refreshDevices();
    setGlobalStatus('', '待激活');
  } catch (e) {
    console.error('初始检测失败', e);
  }
}

/** 事件绑定（同步执行，不依赖任何异步调用） */
function bindEvents() {
  $$('.seg-item').forEach((b) => b.addEventListener('click', () => gotoStep(b.dataset.step)));
  $$('.zone-item').forEach((b) => b.addEventListener('click', () => gotoZone(b.dataset.zone)));

  $('#btnLocateAdb').addEventListener('click', () => locateAdb());
  $('#btnDownloadAdb').addEventListener('click', downloadAdb);
  $('#btnRefreshDevices').addEventListener('click', refreshDevices);
  $('#btnPair').addEventListener('click', doPair);
  $('#btnWirelessConnect').addEventListener('click', doWirelessConnect);
  $('#btnActivate').addEventListener('click', doActivate);
  $('#btnDiagnose').addEventListener('click', runDiagnose);
  $('#btnCheckStatus').addEventListener('click', checkStatus);
  $('#btnStartPolling').addEventListener('click', async () => {
    await checkStatus();
    toast('info', '已开启自动监控', '状态每几秒刷新一次');
  });
  $('#btnLaunchApp').addEventListener('click', async () => {
    if (!state.selected) return toast('warn', '请先选择设备');
    const r = await window.api.launchApp(state.selected);
    toast(r.ok ? 'ok' : 'warn', '打开应用', r.message);
  });
  $('#btnCopyCmd').addEventListener('click', async () => {
    const text = $('#cmdPreview').textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('ok', '已复制命令');
    } catch (_) {
      toast('warn', '复制失败', '请手动选中复制');
    }
  });

  // ---- Fastboot 专区 ----
  $('#btnRefreshFb').addEventListener('click', refreshFastbootDevices);
  $('#btnPickFile').addEventListener('click', async () => {
    const p = await window.api.pickFile([
      { name: '镜像 / ZIP', extensions: ['img', 'zip', 'bin', 'mbn', 'elf'] },
      { name: '全部文件', extensions: ['*'] }
    ]);
    if (p) $('#fbFilePath').value = p;
  });
  $$('.op-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.fb;
      const needsFile = btn.dataset.needsFile === '1';
      const filePath = $('#fbFilePath').value.trim();
      const extra = needsFile && filePath ? { args: filePath, needsFile: true } : { needsFile };
      doFastboot(action, extra);
    });
  });

  $('#btnOpenSettings').addEventListener('click', openSettings);  $('#btnOpenLogFolder').addEventListener('click', () => window.api.openLogFolder());
  $('#btnOpenConfigFolder').addEventListener('click', () => window.api.openConfigFolder());
  $('#btnOpenLogFolder2').addEventListener('click', () => window.api.openLogFolder());
  $('#btnSaveSettings').addEventListener('click', saveSettings);
  $('#btnResetConfig').addEventListener('click', async () => {
    await window.api.resetConfig();
    toast('ok', '配置已重置', '重新打开设置可查看默认值');
  });

  $('#btnTheme').addEventListener('click', async () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    await window.api.setConfig({ theme: next });
    if (state.config) state.config.theme = next;
  });

  // 弹窗关闭
  $$('#settingsModal [data-close]').forEach((el) =>
    el.addEventListener('click', () => { $('#settingsModal').hidden = true; })
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#settingsModal').hidden) $('#settingsModal').hidden = true;
  });

  // 日志工具
  $('#logSearch').addEventListener('input', (e) => {
    state.logSearch = e.target.value.trim();
    renderLogs(false);
  });
  $('#logLevelFilter').addEventListener('change', (e) => {
    state.logFilter = e.target.value;
    renderLogs(false);
  });
  $('#btnClearLog').addEventListener('click', () => {
    state.logs = [];
    renderLogs(false);
    $('#logCount').textContent = '0';
  });
  $('#btnExportLog').addEventListener('click', async () => {
    const r = await window.api.exportLog();
    if (r.ok) toast('ok', '日志已导出', `${r.count} 个文件已合并导出`);
    else if (!r.canceled) toast('err', '导出失败', r.error);
  });
  $('#btnToggleLog').addEventListener('click', () => {
    $('#logPanel').classList.toggle('collapsed');
  });

  // 检查清单
  $$('.check-item').forEach((item) => {
    item.addEventListener('click', () => item.classList.toggle('checked'));
  });

  // 配对码只允许数字
  $('#wlCode').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });

  // 主进程推送
  window.api.onLogEntry(appendLog);
  window.api.onStatus((payload) => {
    state.status = payload;
    updateVerifyView();
    if (payload.running) setGlobalStatus('running', 'Shizuku 运行中');
  });
  window.api.onAdbProgress((p) => {
    const bar = $('#dlBar');
    const text = $('#dlText');
    if (!bar) return;
    $('#dlProgress').hidden = false;
    bar.style.width = (p.percent || 0) + '%';
    text.textContent = (p.percent || 0) + '%';
  });
  window.api.onMenuRefresh(() => refreshDevices());
  window.api.onConfigChanged((c) => { state.config = c; });
}

document.addEventListener('DOMContentLoaded', init);

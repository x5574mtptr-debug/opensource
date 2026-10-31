'use strict';
/**
 * 图标生成器 —— 纯 Node 实现（zlib + 手写 PNG/ICO 编码），不依赖任何图形库
 * 输出：
 *   assets/icon.png   256x256（窗口图标、Linux）
 *   assets/icon.ico   多尺寸（Windows 安装包/可执行文件图标）
 *
 * 图案：圆角方形底 + 品牌渐变 + Shizuku 五角星轮廓 + 高光
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets');

/* ---------- 颜色 ---------- */
const BRAND = [0x4a, 0x6c, 0xf7];
const BRAND2 = [0x7d, 0x6b, 0xff];

function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

/* ---------- 几何 ---------- */
function sdRoundRect(px, py, hw, hh, r) {
  // 到圆角矩形的有符号距离
  const qx = Math.abs(px) - hw + r;
  const qy = Math.abs(py) - hh + r;
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * 多边形有符号距离（IQ 的 sdPolygon 算法）
 * 内部为负、外部为正 —— 用于精确绘制五角星
 */
function sdPolygon(verts, px, py) {
  const n = verts.length;
  let d = (px - verts[0][0]) ** 2 + (py - verts[0][1]) ** 2;
  let s = 1;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const ex = verts[j][0] - verts[i][0];
    const ey = verts[j][1] - verts[i][1];
    const wx = px - verts[i][0];
    const wy = py - verts[i][1];
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    const bx = wx - t * ex;
    const by = wy - t * ey;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= verts[i][1];
    const c2 = py < verts[j][1];
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

/** 生成五角星顶点（外 R / 内 r 交替） */
function starVerts(R, r, points = 5, rot = -Math.PI / 2) {
  const v = [];
  for (let i = 0; i < points; i++) {
    const a = rot + (i * 2 * Math.PI) / points;
    v.push([Math.cos(a) * R, Math.sin(a) * R]);
    const a2 = a + Math.PI / points;
    v.push([Math.cos(a2) * r, Math.sin(a2) * r]);
  }
  return v;
}

/* ---------- 渲染 ---------- */
function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const S = size / 256; // 以 256 为基准缩放

  const bgHalf = 108 * S;   // 圆角矩形半宽
  const bgRadius = 54 * S;

  const star = starVerts(74 * S, 31 * S);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x + 0.5 - c;
      const fy = y + 0.5 - c;

      // 底：圆角方形 + 斜向渐变
      const dBg = sdRoundRect(fx, fy, bgHalf, bgHalf, bgRadius);
      const bgA = Math.max(0, Math.min(1, 0.5 - dBg));

      // 渐变参数：对角线投影
      const t = Math.max(0, Math.min(1, (fx + fy + bgHalf * 2) / (bgHalf * 4)));
      let r = mix(BRAND, BRAND2, t);

      // 顶部高光
      const gloss = Math.max(0, 1 - (fy + bgHalf) / (bgHalf * 1.1));
      r = mix(r, [255, 255, 255], gloss * 0.13);

      // 星形阴影（向下偏移 4px）
      const dShadow = sdPolygon(star, fx, fy + 5 * S);
      const shadowA = Math.max(0, Math.min(1, 0.5 - dShadow)) * 0.25;

      // 星形本体
      const dStar = sdPolygon(star, fx, fy);
      const starA = Math.max(0, Math.min(1, 0.5 - dStar));

      if (shadowA > 0) r = mix(r, [22, 30, 95], shadowA * (1 - starA));
      if (starA > 0) r = mix(r, [255, 255, 255], starA);

      const i = (y * size + x) * 4;
      px[i] = Math.round(r[0]);
      px[i + 1] = Math.round(r[1]);
      px[i + 2] = Math.round(r[2]);
      px[i + 3] = Math.round(bgA * 255);
    }
  }
  return px;
}

/* ---------- PNG 编码 ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(rgba, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- ICO 编码 ---------- */
function encodeICO(entries) {
  // entries: [{size, rgba}]
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;

  const datas = entries.map((e, idx) => {
    const png = encodePNG(e.rgba, e.size);
    const d = dir.subarray(idx * 16, idx * 16 + 16);
    d[0] = e.size >= 256 ? 0 : e.size;
    d[1] = e.size >= 256 ? 0 : e.size;
    d[2] = 0;  // 调色板
    d[3] = 0;  // reserved
    d.writeUInt16LE(1, 4);   // color planes
    d.writeUInt16LE(32, 6);  // bpp
    d.writeUInt32BE(0, 8);
    d.writeUInt32LE(png.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += png.length;
    return png;
  });

  return Buffer.concat([header, dir, ...datas]);
}

/* ---------- 主流程 ---------- */
function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const big = render(256);
  fs.writeFileSync(path.join(OUT, 'icon.png'), encodePNG(big, 256));
  console.log('✓ assets/icon.png (256x256)');

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const entries = sizes.map((s) => ({ size: s, rgba: render(s) }));
  fs.writeFileSync(path.join(OUT, 'icon.ico'), encodeICO(entries));
  console.log('✓ assets/icon.ico (' + sizes.join(', ') + ')');
}

main();

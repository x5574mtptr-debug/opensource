'use strict';
/**
 * 日志系统
 * - 分级：DEBUG / INFO / WARN / ERROR
 * - 落盘：logs/shizuku-launcher-YYYY-MM-DD.log，按天切分，超限滚动
 * - 实时推送：主进程 -> 渲染进程（IPC 广播）
 * - 全量内存环形缓冲，UI 可随时回看历史
 */
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 单文件上限 8MB
const MAX_MEMORY_LINES = 5000; // 内存保留行数

class Logger extends EventEmitter {
  constructor(baseDir) {
    super();
    this.setMaxListeners(50);
    this.logDir = path.join(baseDir, 'logs');
    this.level = LEVELS.INFO;
    this.buffer = [];
    this.stream = null;
    this.currentFile = null;
    this.currentDate = '';
    this.ready = this._ensureDir();
  }

  _ensureDir() {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
      return true;
    } catch (e) {
      console.error('[logger] 无法创建日志目录:', e.message);
      return false;
    }
  }

  setLevel(level) {
    if (LEVELS[level]) {
      this.level = LEVELS[level];
      this.info(`日志级别已设置为 ${level}`);
    }
  }

  getLevel() {
    return Object.keys(LEVELS).find((k) => LEVELS[k] === this.level) || 'INFO';
  }

  _fileFor(dateStr) {
    return path.join(this.logDir, `shizuku-launcher-${dateStr}.log`);
  }

  _openStream(dateStr) {
    if (this.currentDate === dateStr && this.stream) return this.stream;
    this._closeStream();
    const file = this._fileFor(dateStr);
    try {
      // 超过上限则滚动为 .1
      if (fs.existsSync(file) && fs.statSync(file).size > MAX_FILE_BYTES) {
        let i = 1;
        let rolled = `${file}.${i}`;
        while (fs.existsSync(rolled)) {
          i += 1;
          rolled = `${file}.${i}`;
        }
        fs.renameSync(file, rolled);
      }
      this.stream = fs.createWriteStream(file, { flags: 'a' });
      this.currentFile = file;
      this.currentDate = dateStr;
      this.stream.on('error', (e) => {
        console.error('[logger] 写入失败:', e.message);
        this._closeStream();
      });
    } catch (e) {
      console.error('[logger] 无法打开日志文件:', e.message);
      this.stream = null;
    }
    return this.stream;
  }

  _closeStream() {
    if (this.stream) {
      try {
        this.stream.end();
      } catch (_) {}
      this.stream = null;
      this.currentFile = null;
      this.currentDate = '';
    }
  }

  _stamp() {
    const d = new Date();
    const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
  }

  /**
   * @param {string} level  DEBUG|INFO|WARN|ERROR
   * @param {string} message
   * @param {object} meta 附加结构化信息
   */
  log(level, message, meta) {
    const lvl = LEVELS[level] || LEVELS.INFO;
    const entry = {
      ts: this._stamp(),
      level,
      message: String(message),
      meta: meta && Object.keys(meta).length ? meta : undefined,
      pid: process.pid
    };

    // 内存缓冲
    this.buffer.push(entry);
    if (this.buffer.length > MAX_MEMORY_LINES) {
      this.buffer.splice(0, this.buffer.length - MAX_MEMORY_LINES);
    }

    // 控制台
    const line = `[${entry.ts}] ${level.padEnd(5)} ${entry.message}`;
    if (level === 'ERROR') console.error(line, meta || '');
    else if (level === 'WARN') console.warn(line, meta || '');
    else console.log(line, meta || '');

    // 落盘
    if (this.ready && lvl >= this.level) {
      const dateStr = new Date().toISOString().slice(0, 10);
      const stream = this._openStream(dateStr);
      if (stream) {
        const metaStr = entry.meta ? ' ' + JSON.stringify(entry.meta) : '';
        try {
          stream.write(`${entry.ts} [${level}] ${entry.message}${metaStr}\n`);
        } catch (_) {}
      }
    }

    // 推送 UI
    this.emit('entry', entry);
    return entry;
  }

  debug(m, meta) { return this.log('DEBUG', m, meta); }
  info(m, meta) { return this.log('INFO', m, meta); }
  warn(m, meta) { return this.log('WARN', m, meta); }
  error(m, meta) { return this.log('ERROR', m, meta); }

  /** 取历史（渲染进程启动时回填） */
  history(limit = 1000) {
    return this.buffer.slice(-limit);
  }

  /** 等待缓冲落盘（测试与导出前调用） */
  flush() {
    return new Promise((resolve) => {
      if (!this.stream) return resolve();
      try {
        this.stream.write('', () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }

  /** 列出日志文件 */
  listFiles() {
    try {
      return fs
        .readdirSync(this.logDir)
        .filter((f) => f.endsWith('.log') || /\.log\.\d+$/.test(f))
        .map((f) => {
          const st = fs.statSync(path.join(this.logDir, f));
          return { name: f, size: st.size, mtime: st.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
    } catch (_) {
      return [];
    }
  }

  /** 读取某个日志文件内容 */
  readFile(name) {
    const safe = path.basename(name);
    const p = path.join(this.logDir, safe);
    try {
      return fs.readFileSync(p, 'utf8');
    } catch (e) {
      return `[无法读取 ${safe}: ${e.message}]`;
    }
  }

  /** 导出全部日志到指定位置 */
  exportAll(targetPath) {
    try {
      const files = this.listFiles();
      const chunks = files
        .slice()
        .reverse()
        .map((f) => `\n===== ${f.name} =====\n${this.readFile(f.name)}`);
      fs.writeFileSync(targetPath, chunks.join('\n'), 'utf8');
      return { ok: true, count: files.length, path: targetPath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  close() {
    this._closeStream();
  }
}

module.exports = { Logger, LEVELS };

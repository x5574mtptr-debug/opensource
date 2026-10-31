# Shizuku 激活工具 构建与运行说明

基于 **Electron** 的 Windows 桌面工具，用于在本机激活 Android 设备上的 Shizuku
（通过无线调试 / ADB 等方式），免去传统 root 限制即可管理应用权限。详见 [README.md](./README.md)。

## 1. 环境准备

| 依赖 | 要求 |
|------|------|
| Node.js | >= 18（Electron 32 要求） |
| 系统 | Windows 10 / 11 |
| 手机端 | 已安装并打开过 Shizuku 应用 |

## 2. 安装依赖

```bash
npm install
# 会触发 postinstall 脚本，按 .npmrc 镜像下载 Electron
```

## 3. 本地运行

```bash
npm start        # 启动应用（scripts/launch.js）
npm run dev      # 开发模式（开 DevTools）
npm test         # 运行核心测试（test/core.test.js，无需真机）
```

## 4. 构建发布

```bash
npm run build      # 产出 NSIS 安装包 + 便携版（dist/）
npm run build:dir  # 仅打包目录（不生成安装器）
```

构建结果位于 `dist/`，包含 `.exe` 安装包与便携版。注意不要将 `dist/`、`node_modules/`、
`.cache/` 提交到仓库（见 `.gitignore`）。

## 5. 工程结构

```
shizuku-launcher/
├── src/
│   ├── main/      主进程：main.js / adb.js / shizuku.js / logger.js / config.js
│   ├── preload/   预加载脚本（contextBridge 安全桥）
│   └── renderer/  界面：index.html / renderer.js / styles.css
├── scripts/       启动、图标生成、安装后处理、UI 引导
├── assets/        应用图标
├── test/          测试与模拟 adb（fake-adb）
├── package.json   Electron + electron-builder 配置
└── QUICKSTART.md 三步激活速查卡
```

## 6. 许可证

见仓库根目录 [LICENSE](../../LICENSE)（MIT）。

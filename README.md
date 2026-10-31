# 小米手环 / Xiaomi Vela 开源项目

关于 **小米手环（米环）** 与 **Xiaomi Vela** wearable OS 的实验与项目源码集合。

本仓库收录了我折腾米环 / Vela 过程中沉淀的代码：从快应用 Demo、语音助手，
到分析 Vela 包结构的探索脚本。所有子项目均基于小米官方的 `aiot-toolkit` 工具链。

## 目录

- [子项目一览](#子项目一览)
- [构建与运行](#构建与运行)
- [目录说明](#目录说明)
- [开源说明](#开源说明)
- [License](#license)

## 子项目一览

| 子项目 | 说明 | 构建文档 |
|--------|------|----------|
| [`米环测试demo/`](米环测试demo/) | 米环全能测试快应用，含蓝牙、定位、网络、录音、传感器、系统、振动等页面 | [BUILD.md](米环测试demo/BUILD.md) |
| [`伪装软件v1/`](伪装软件v1/) | 手表端「伪装配件 / 隐私隐身」类快应用，仅声明 router/app/battery 三项基础能力 | [BUILD.md](伪装软件v1/BUILD.md) |
| [`67 语音助手/`](67%20语音助手/) | 基于 Vela 的语音助手项目，含 `manifest.json`、页面与公共资源 | — |
| `explore.js` / `list_files.js` / `list_pages.js` / `list_src.js` | 用于分析 Vela 包结构的探索脚本 | — |
| [`test/`](test/) | 测试项目的构建产物与资源 | — |

## 构建与运行

各子项目均为 Xiaomi Vela 快应用，使用官方 `aiot-toolkit` 工具链：

```bash
npm install        # 安装 @aiot-toolkit / aiot-toolkit
npm run start      # 本地预览（热更新）
npm run build      # 构建调试包
npm run release    # 构建签名发布包（.rpk）
```

详细的目录结构、真机运行与权限说明，见各子项目内的 `BUILD.md`
（如 [米环测试demo/BUILD.md](米环测试demo/BUILD.md)、[伪装软件v1/BUILD.md](伪装软件v1/BUILD.md)）。
更多参考见 [小米 Vela 快应用官方文档](https://iot.mi.com/vela/quickapp)。

## 目录说明

- `米环测试demo/` —— 小米手环测试 Demo（Xiaomi Vela 快应用），含蓝牙、定位、网络、录音、传感器、系统、振动等页面的源码（`src/`）与构建产物（`build/`、`dist/`）。
- `伪装软件v1/` —— 手表端「伪装配件 / 隐私隐身」类快应用；`manifest.json` 仅声明 `system.router`、`system.app`、`system.battery` 三项基础能力，不含网络、定位、录音等敏感权限。
- `67 语音助手/` —— 基于 Vela 的语音助手项目，含 `manifest.json`、页面（`src/pages`）与公共资源。
- `explore.js` / `list_files.js` / `list_pages.js` / `list_src.js` —— 用于分析 Vela 包结构的探索脚本。
- `test/build/` —— 测试项目的构建产物与资源。

## 开源说明

- 已排除 `node_modules`、`dist/`、`*.zip`（含超过 GitHub 单文件 100MB 限制的大包）等，
  仅保留可读源码与必要的配置。
- 部分内部 / 空目录未包含在本公开仓库中。
- 本仓库内容仅供学习与个人研究使用，请遵守小米 Vela 平台相关协议与规范。

## License

本项目以 [MIT License](LICENSE) 开源。

Copyright © 2026 linkshu (x5574mtptr-debug)

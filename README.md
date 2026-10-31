# 小米手环 / Xiaomi Vela 开源项目

本分支（`小米手环`）整理了我关于 **小米手环（米环）** 与 **Xiaomi Vela** wearable OS 的实验与项目源码。

## 目录说明

- `米环测试demo/` —— 小米手环测试 Demo（Xiaomi Vela 快应用），含蓝牙、定位、网络、录音、传感器、系统、振动等页面的源码（`src/`）与构建产物（`build/`）。
- `67 语音助手/` —— 基于 Vela 的语音助手项目，含 `manifest.json`、页面（`src/pages`）与公共资源。
- `explore.js` / `list_files.js` / `list_pages.js` / `list_src.js` —— 用于分析 Vela 包结构的探索脚本。
- `test/build/` —— 测试项目的构建产物与资源。

## 说明

- 已排除 `node_modules`、体积超过 GitHub 限制的大文件压缩包等，仅保留可读源码。
- 部分内部文件夹未包含在本公开分支中。

## 构建与运行

各子项目可配合 Xiaomi Vela 工具链（如 `@aiot-toolkit/aiotpack`）进行构建；具体步骤待补充。

# 版本说明 · Shizuku 激活工具

本仓库的 shizuku 分支是 Shizuku 激活工具的源码；下面区分介绍**已发布的构建版本**与**源码版**，以及 **1.0.0 便携版** 与 **旧版** 的差异。

## 一、两种获取方式

| 方式 | 说明 | 适合谁 |
| --- | --- | --- |
| 便携版（Release 资产） | 解压即用，内置 adb，双击 `启动 Shizuku.bat` 或 `Shizuku 激活工具.exe` | 只想用、不想装环境的用户 |
| 源码版（本分支 shizuku-launcher/） | `npm install && npm start` 自行构建，可改代码、提 PR | 开发者 / 想参与的人 |

## 二、1.0.0 便携版 vs 旧版

> 旧版 = 你此前使用的那一份 Shizuku 激活工具（更早的构建）。以下为 1.0.0 便携版相对旧版的新增 / 改进。

| 项目 | 旧版 | 1.0.0 便携版 |
| --- | --- | --- |
| 安装方式 | 旧版形态 | 免安装，解压即用 |
| ADB | 视旧版而定 | 内置 platform-tools，无 adb 也能一键下载 |
| 激活方式 | start.sh 直跑（Android 11+ 易失败） | app_process 直启，自动避开分区存储限制 |
| Fastboot 线刷 | 无 | 新增：解锁 / 刷 boot·recovery·OTA 等，高风险操作带二次确认 |
| 无线调试 | 视旧版而定 | 支持（Android 11+）配对 + 连接 |
| 设备诊断 | 无 | 逐项检测并给处置建议 |
| 日志 | 视旧版而定 | 分级落盘 + 一键导出 |

旧版（搞机工具箱 1.0.0 便携版）已作为历史版本发布：[以前的 Shizuku 激活工具（旧版）](https://github.com/x5574mtptr-debug/opensource/releases/tag/old-shizuku-gaoji-1.0.0)。

## 三、使用前提（不变）
- 手机先装好 Shizuku 应用并打开一次
- 开发者选项 / USB 调试已开
- 部分国产 ROM 需把 Shizuku 加入电池优化白名单

> 最新便携版下载见仓库 **Releases**（基于 shizuku 分支发布）。

## 四、历史版本（旧版）下载
- **以前的 Shizuku 激活工具（搞机工具箱 1.0.0 便携版）** → [Release: old-shizuku-gaoji-1.0.0](https://github.com/x5574mtptr-debug/opensource/releases/tag/old-shizuku-gaoji-1.0.0)
  - 即上文「旧版」所指的那一份；主程序 `搞机工具箱.exe`，解压即用。
  - 仅作历史留存，新用户请用 1.0.0 便携版（v1.0.0-portable）。
### 旧版 vs 1.0.0 便携版（打包实测差异）
> 以下差异基于两个 zip 包的实际内容比对。旧版即「搞机工具箱 1.0.0 便携版」压缩包，1.0.0 便携版即 `Shizuku 激活工具 1.0.0 便携版`。

| 项目 | 旧版（搞机工具箱 1.0.0） | 1.0.0 便携版（Shizuku 激活工具） |
| --- | --- | --- |
| 主程序 | `搞机工具箱.exe` | `Shizuku 激活工具.exe` |
| 名称 / 品牌 | 搞机工具箱 | Shizuku 激活工具 |
| 内置 ADB | 压缩包内**不含** `platform-tools/adb.exe`，需自备 ADB 环境 | 内置 `platform-tools`，无 adb 也能一键拉取 |
| 便捷启动器 | 无 `启动 Shizuku.bat` | 附带 `启动 Shizuku.bat` |
| app_process 直启 | 旧版实现 | 支持（自动避开分区存储限制） |
| Fastboot 线刷 | 未包含（1.0.0 新增） | 支持解锁 / 刷 boot·recovery·OTA，高风险带二次确认 |
| 无线调试 | 旧版未含 | 支持（Android 11+ 配对 + 连接） |
| 设备诊断 / 分级日志 | 旧版未含 | 新增逐项检测与一键导出 |


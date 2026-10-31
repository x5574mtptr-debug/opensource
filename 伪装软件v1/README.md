# 伪装软件 v1

> 运行在 **小米 Vela（手表 / watch）** 上的快应用（QuickApp）。包名 `com.fakeapp.linkshu`，版本 `2.0.0`。

## 这是什么

「伪装软件」是一个安装在智能手表上的轻量应用。它平时显示为一个极简的全屏时钟，
通过隐藏手势退出——适合需要"把手表表面伪装成普通时钟"的场景。

整个应用**只申请了三项最基础的系统能力**：

- `system.router` —— 页面跳转
- `system.app` —— 应用生命周期
- `system.battery` —— 电池信息

**不申请**网络、定位、录音、通讯录等任何敏感权限，也**不发起任何网络请求**——
你的数据不会离开设备。

## 功能与页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `pages/index` | 应用入口：两个入口卡片——「进入伪装模式」「关于」 |
| 伪装页 | `pages/detail` | 全屏黑色背景 + 时钟；伪装态下拦截系统右滑返回手势 |
| 关于 | `pages/about` | 作者信息、致谢与退出方法说明 |

## 退出伪装（重要）

在伪装页（`pages/detail`）中：

1. **连续点击时间 4 次** -> 时间下方开始出现数字；
2. 在数字出现后的 3 秒内 **长按 1 秒** -> 显示「即将退出伪装模式」并自动返回首页。

> 设计意图：避免误触退出，同时让本人能通过约定手势随时还原。

## 隐私与安全

- 无网络权限，无后台上传；
- 仅使用 `router / app / battery` 三个基础接口；
- 不收集、不上传任何个人信息。

## 本地化

内置 `zh-CN` / `en` / `defaults` 三套 `i18n`，随系统语言切换。

## 构建与运行

技术栈：[小米 Vela 快应用](https://iot.mi.com/vela/quickapp)，工具链 `aiot-toolkit`。

```bash
npm install
npm run start     # 本地热更新预览（需 Vela 模拟器或开发者模式真机）
npm run build     # 调试包 .rpk（build/）
npm run release   # 签名发布包（dist/）
```

完整步骤见 [BUILD.md](./BUILD.md)。

## 在手表上安装

1. 手表开启 **开发者模式 / USB 调试**（一般「设置 -> 关于 -> 版本号」连点开启）；
2. 经 adb 或小米调试工具将 `dist/*.rpk` 推送到设备并安装；
3. 通过调试器打开即可。

## 代码规范

仓库内置 ESLint / Stylelint / Prettier / commitlint 配置，并附带 husky 钩子。
关联 git 后执行 `sh husky.sh`（Windows 用 `./husky.sh`）启用。

## 许可证

见仓库根目录 [LICENSE](../../LICENSE)（MIT）。

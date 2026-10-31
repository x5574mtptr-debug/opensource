# 伪装软件v1 构建与运行说明

本项目是一个运行在 **小米 Vela（手表 / watch）** 上的快应用（QuickApp），使用官方
`aiot-toolkit` 工具链开发与打包。其定位是一个「伪装配件 / 隐私隐身」类手表应用：
`manifest.json` 中仅声明 `system.router`、`system.app`、`system.battery` 三项基础能力，
不包含网络、定位、录音等敏感权限。

---

## 1. 环境准备

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 8.10 | 建议 LTS 版本 |
| npm | 随 Node 自带 | 用于安装工具链 |

依赖声明见 `package.json`：

```json
"devDependencies": {
  "@aiot-toolkit/jsc": "^1.0.3",
  "aiot-toolkit": "^2.0.5"
}
```

---

## 2. 安装依赖

```bash
npm install
```

---

## 3. 本地开发（热更新预览）

```bash
npm run start
# 等价于 aiot start --watch
```

`--watch` 会在源码改动后自动重新编译，配合 **Vela 模拟器** 或 **已开启开发者模式的真机** 实时预览。

---

## 4. 构建与发布

```bash
# 调试包（未签名，用于开发验证）
npm run build
# 等价于 aiot build

# 正式发布包（签名后的 .rpk，可分发安装）
npm run release
# 等价于 aiot release
```

产物位于 `build/`（编译中间产物）与 `dist/`（最终可分发包）。

---

## 5. 在真机上运行（手表）

1. 在手表上开启 **开发者模式 / USB 调试**（入口随固件版本不同，一般在「设置 → 关于 → 版本号」连点开启）。
2. 通过 adb 或小米配套调试工具将 `dist/` 下的 `.rpk` 推送到设备并安装。
3. 在设备上通过调试器打开该快应用。

> 不同 Vela 固件版本的调试入口与安装方式略有差异，请以
> [小米 Vela 快应用官方文档](https://iot.mi.com/vela/quickapp) 为准。

---

## 6. 工程结构

```
伪装软件v1/
├── src/
│   ├── app.ux              # 应用入口（生命周期）
│   ├── manifest.json       # 应用配置：包名 com.fakeapp.linkshu、设备类型、权限、路由
│   ├── common/             # 公共资源（图标等）
│   ├── i18n/               # 多语言（zh-CN / en / defaults）
│   ├── config-watch.json   # 调试配置
│   └── pages/              # 页面
│       ├── index/         # 首页
│       ├── detail/         # 详情
│       └── about/          # 关于
├── build/                  # 编译产物
├── dist/                   # 发布包
├── package.json            # 工具链脚本
└── BUILD.md                # 本说明
```

`manifest.json` 中声明的 `features` 当前仅包含 `system.router`、`system.app`、
`system.battery`，可按需增删对应的 `system.*` 接口以调整能力范围。

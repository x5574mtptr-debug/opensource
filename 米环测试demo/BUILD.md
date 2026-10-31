# 米环测试demo 构建与运行说明

本工程是一个运行在 **小米 Vela（手表 / watch）** 上的快应用（QuickApp），使用官方
`aiot-toolkit` 工具链开发与打包。下面是从零到运行的完整步骤。

---

## 1. 环境准备

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 8.10 | 建议 LTS 版本 |
| npm | 随 Node 自带 | 用于安装工具链 |
| 小米 Vela 开发者工具 / 真机 | —— | 调试与安装 `.rpk` 包用 |

安装 Node 后，工程依赖已经在 `package.json` 的 `devDependencies` 中声明：

```json
"devDependencies": {
  "@aiot-toolkit/jsc": "^1.0.3",
  "aiot-toolkit": "^2.0.5"
}
```

---

## 2. 安装依赖

在工程根目录执行：

```bash
npm install
```

会安装 `aiot-toolkit` 及其编译器，之后即可使用 `npm run` 里的脚本。

---

## 3. 本地开发（热更新预览）

```bash
npm run start
# 等价于 aiot start --watch
```

- `--watch` 会在源码改动后自动重新编译
- 工具会启动一个本地调试服务，配合 **Vela 模拟器** 或 **已开启开发者模式的真机** 即可实时预览

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

产物位于工程根目录的 `build/` 与 `dist/` 下：

```
build/        # 编译中间产物（app.js、manifest、各页面）
dist/         # 最终可分发包
```

---

## 5. 在真机上运行（手表）

1. 在手表上开启 **开发者模式 / USB 调试**（具体入口随固件版本不同，一般在「设置 → 关于 → 版本号」连点开启）。
2. 通过 adb 或小米配套调试工具将 `dist/` 下的 `.rpk` 推送到设备：
   ```bash
   # 示例（实际命令以 Vela 开发者工具为准）
   adb push dist/xxx.rpk /sdcard/
   ```
3. 在设备上通过调试器安装并打开该快应用。

> 不同 Vela 固件版本的调试入口与安装方式略有差异，请以
> [小米 Vela 快应用官方文档](https://iot.mi.com/vela/quickapp) 为准。

---

## 6. 代码规范（可选）

提交前做代码校验 / 格式化 / commit 信息校验：

```bash
# macOS / Linux
sh husky.sh
# Windows
./husky.sh
```

需要先在工程目录关联 git（`git init` 或已在仓库内）。

---

## 7. 工程结构

```
米环测试demo/
├── src/
│   ├── app.ux              # 应用入口（生命周期）
│   ├── manifest.json       # 应用配置：包名、设备类型、权限、路由
│   ├── common/             # 公共资源（图标等）
│   ├── i18n/               # 多语言（zh-CN / en）
│   └── pages/              # 各功能页面
│       ├── index/         # 首页
│       ├── bluetooth/      # 蓝牙
│       ├── sensor/         # 传感器
│       ├── system/         # 系统信息
│       ├── vibrator/       # 振动
│       ├── geo/            # 定位
│       ├── network/        # 网络
│       ├── recorder/       # 录音
│       └── detail/         # 详情
├── build/                  # 编译产物
├── dist/                   # 发布包
├── package.json            # 工具链脚本
└── BUILD.md                # 本说明
```

`manifest.json` 中声明的能力（`features`）按需裁剪即可，仅保留用到的
`system.*` 接口，可减少包体与权限申请。

# 67 语音助手 构建与运行说明

本工程是一个运行在 **小米 Vela（手表 / watch）** 上的快应用（QuickApp），
是一个**离线 AI 对话助手**——内置问答库 `src/common/qa.js`，不联网也能陪你聊天。
使用官方 `aiot-toolkit` 工具链开发与打包。下面是从零到运行的完整步骤。

---

## 1. 工程特点

| 项 | 值 |
|----|----|
| 包名 | `com.ai67.assistant` |
| 设备类型 | `watch`（手表） |
| 声明权限 | `system.router`（仅路由，无网络/定位/录音等敏感权限） |
| 入口页面 | `pages/index/index` |
| 离线问答库 | `src/common/qa.js`（关键词 → 多候选回复） |

> 与「米环测试demo」「伪装软件v1」不同，本工程的 `package.json` 仅声明了
> `@aiot-toolkit/aiotpack` 作为开发依赖，且 `scripts` 里**只有 `test`**。
> 因此下面会直接用 `aiot-toolkit` 的 `aiot` CLI 来构建/预览（也可按
> 第 4 节补上 `start/build/release` 脚本后改用 `npm run`）。

---

## 2. 环境准备

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 8.10（建议 LTS） | 用于运行工具链 |
| npm | 随 Node 自带 | 安装依赖 |
| 小米 Vela 开发者工具 / 真机 | —— | 调试与安装 `.rpk` 包 |

---

## 3. 安装依赖

在工程根目录执行：

```bash
npm install
```

会安装 `@aiot-toolkit/aiotpack`（包含编译器）。随后可直接用 `aiot` CLI：

```bash
# 全局可用（可选，避免每次 npx）
npm install -g aiot-toolkit
```

---

## 4. 本地开发（热更新预览）

```bash
# 方式 A：用 aiot CLI（推荐，无需改 package.json）
npx aiot-toolkit start --watch
# 等价于 aiot start --watch

# 方式 B：先在 package.json 的 scripts 补上（可选）
#   "start":   "aiot start --watch",
#   "build":   "aiot build",
#   "release": "aiot release"
# 之后即可：
npm run start
```

- `--watch` 会在源码改动后自动重新编译
- 工具会启动本地调试服务，配合 **Vela 模拟器** 或 **已开启开发者模式的真机** 即可实时预览

---

## 5. 构建与发布

```bash
# 调试包（未签名，用于开发验证）
npx aiot-toolkit build
# 或（若已补脚本）npm run build

# 正式发布包（签名后的 .rpk，可分发安装）
npx aiot-toolkit release
# 或（若已补脚本）npm run release
```

产物位于工程根目录的 `build/` 与 `dist/` 下：

```
build/        # 编译中间产物（app.js、manifest、各页面）
dist/         # 最终可分发包
```

---

## 6. 在真机上运行（手表）

1. 在手表上开启 **开发者模式 / USB 调试**（一般在「设置 → 关于 → 版本号」连点开启）。
2. 通过 adb 或小米配套调试工具将 `dist/` 下的 `.rpk` 推送到设备：
   ```bash
   adb push dist/xxx.rpk /sdcard/
   ```
3. 在设备上通过调试器安装并打开该快应用。

> 不同 Vela 固件版本的调试入口与安装方式略有差异，请以
> [小米 Vela 快应用官方文档](https://iot.mi.com/vela/quickapp) 为准。

---

## 7. 工程结构

```
67 语音助手/
├── src/
│   ├── manifest.json       # 应用配置：包名、设备类型、权限、路由
│   ├── common/
│   │   ├── logo.png        # 应用图标（manifest 中引用）
│   │   └── qa.js           # 离线问答库（关键词 → 多候选回复）
│   └── pages/
│       └── index/
│           └── index.ux    # 对话主界面
├── build/                  # 编译产物
├── dist/                   # 发布包
├── package.json            # 依赖（aiotpack）
├── package-lock.json
└── BUILD.md                # 本说明
```

### 扩展问答库

编辑 `src/common/qa.js`，往数组里追加对象即可新增话题：

```js
{
  keywords: ['你的关键词列表'],
  answers:  ['候选回复1', '候选回复2']
}
```

修改后会话会在 `--watch` 模式下自动热更新。

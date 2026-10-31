# Shizuku 激活工具 · Windows 版

一个把「装 Shizuku、连手机、跑命令」这套繁琐流程压缩成几步点击的 Windows 桌面工具。

![界面](assets/icon.png)

---

## 界面结构

左侧两个大区：

| 专区 | 内容 |
|---|---|
| **Shizuku 激活** | 四步向导（环境准备 → 设备连接 → 激活服务 → 状态确认），顶部用分段控件切换 |
| **Fastboot 专区** | 底层刷机模式：设备列表、刷入镜像、解锁 Bootloader、清理数据、重启 |

---

## 它解决什么问题

手动激活 Shizuku 要做这些事：

1. 装好 `adb`（还要装驱动）
2. 手机开「开发者选项」「USB 调试」
3. 手机上装 Shizuku 并打开一次
4. 电脑上敲 `adb shell sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh`
5. 出错了还得自己查日志

这个工具把上面每一步都变成界面上的一个按钮，并且：

- **没有 adb 也能用** —— 一键下载 Google 官方 platform-tools
- **日志完整** —— 每条 adb / fastboot 命令、返回码、stderr 全部落盘可导出
- **配置好调** —— 所有参数（脚本路径、端口、轮询间隔、镜像源、fastboot 路径）都能在设置里改，也能在 `config.json` 里直接编辑

---

## 快速开始

### 方式一：直接用打包好的 exe

到 `dist/` 目录取：

- `Shizuku 激活工具-1.0.0-x64.exe` —— 安装版（NSIS，可选安装路径、创建快捷方式）
- `Shizuku 激活工具-1.0.0-便携版.exe` —— 免安装，双击即用

### 方式二：从源码跑

```bash
npm install
npm start
```

### 便捷启动器

项目根目录有 `启动 Shizuku.bat`，双击即可直接启动已打包好的版本
（跳过便携版每次的自解压，启动更快）。

> 注意：`.bat` 文件必须保持纯 ASCII。cmd.exe 按系统 ANSI 码页（中文 Windows 是 GBK）
> 读取批处理，文件里若有中文，乱码会吞掉后续行导致整条命令失效。
> 改这个文件请用 `node scripts/make-launcher.js` 重新生成。

### 打包

```bash
npm run build
```

产物在 `dist/`。

---

## 使用流程

界面分四步，每步完成会在左侧打勾：

### 1. 环境准备

点「检测 adb」。工具按优先级依次查找：

| 顺序 | 来源 |
|---|---|
| 1 | 设置里手动指定的路径 |
| 2 | `ANDROID_HOME` / `ANDROID_SDK_ROOT` |
| 3 | 系统 `PATH` |
| 4 | 常见安装目录（SDK、Program Files、各家模拟器目录…） |
| 5 | 工具内置的 platform-tools |

都找不到就点「下载内置 adb」，从 Google 官方源拉取 platform-tools 解压使用。

### 2. 设备连接

**USB**：插上数据线，手机上勾「允许 USB 调试」→「刷新」。

**无线调试**（Android 11+）：手机「开发者选项 → 无线调试」里能看到 IP 和两个端口：

- **连接端口** —— 无线调试主界面顶部显示的那个
- **配对端口** —— 点「使用配对码配对设备」弹窗里显示的那个

把 IP、两个端口、6 位配对码填进去 → 先「配对」再「连接」。配对只需做一次。

> 也可以先填好连接端口直接点「直接连接」—— 如果之前已经配对过，这一步会秒成。

### 3. 激活服务

选好设备后点「立即激活」。工具会自动按顺序尝试三种启动方式，第一个成功的即采用：

| 顺序 | 方案 | 适用 | 说明 |
|---|---|---|---|
| 1 | **app_process 直启** | Android 10/11+，任意版本 | 用 `pm path` 定位 APK，再直接拉起服务进程。**完全绕开文件系统限制** |
| 2 | **start.sh 直跑** | Android 10 及以下、旧版 Shizuku | 官方经典方案，Android 11+ 会被系统拒绝（属预期） |
| 3 | **starter 复制执行** | Shizuku v13.6 | 官方推荐把 native starter 复制到 `/data/local/tmp` 再跑 |

**为什么 app_process 直启是首选**

Android 11 起，系统收紧了分区存储，`/sdcard/Android/data/<包名>/` 对 adb shell（UID 2000）返回 **Permission denied**——官方的 `adb shell sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh` 在 Android 11+ 上**必然失败**。而 Shizuku v13.7.0（2026-10-26）起更是彻底移除了 `start.sh`，改用 native starter。

`app_process` 直启完全不需要读那个目录：

```bash
# 1) 用 pm path 拿到 APK 路径（系统命令，不受分区存储限制）
adb shell pm path moe.shizuku.privileged.api
# package:/data/app/~~xxx==/moe.shizuku.privileged.api-yyy==/base.apk

# 2) 直接以 shell 身份拉起服务进程
adb shell "/system/bin/app_process \
  -Djava.class.path=/data/app/~~xxx==/.../base.apk \
  /system/bin --nice-name=shizuku_server \
  rikka.shizuku.server.ShizukuService"
```

这正是 Shizuku 内部 native starter 干的事，只是省掉了「拷贝 starter 文件」这一步。

**点「设备诊断」** 可以看到每一环的检测结果：应用是否安装、Android 版本、Android/data 是否可读、start.sh 是否存在、app_process 是否可用、服务是否在跑，并给出对应的行动建议。

### 4. 状态确认

三个信号交叉验证，避免误判：

| 信号 | 检测方式 |
|---|---|
| 服务进程 | `ps -A \| grep shizuku_server` |
| Binder 注册 | `cat /proc/net/unix \| grep shizuku` |
| 应用已安装 | `pm path moe.shizuku.privileged.api` |

激活成功后会自动开始轮询监控。

---

## 手机端必做设置

不在手机上看这几步，十有八九会失败：

**通用**
- 「关于手机」连点「版本号」7 次 → 开「开发者选项」
- 开「USB 调试」
- USB 用途选「仅充电」（避免数据模式中断 ADB）
- 允许 Shizuku 应用后台运行（否则容易被系统杀掉）
- Android 11+ 可开「停用 adb 授权超时功能」

**厂商定制**

| 品牌 | 需要额外做的 |
|---|---|
| MIUI / 小米 / POCO | 开发者选项里开「USB 调试（安全设置）」；通知样式改「原生」；别用「手机管家」的扫描功能（会禁用开发者选项） |
| ColorOS / OPPO / 一加 | 开发者选项里关「权限监控」 |
| Flyme / 魅族 | 关「Flyme 支付保护」 |
| EMUI / 华为 | 开「仅充电模式下允许 ADB 调试」 |
| Sony | 不要点连接 USB 后的弹窗（会切到数据模式） |
| GrapheneOS | 关闭「设置 → 安全 → Secure app spawning」 |

---

## 常见问题

**找不到 start.sh 脚本**
Android 11+ 上这是**正常现象**，不是工具坏了。分区存储限制让 adb 读不到 `Android/data`，而 Shizuku v13.7+ 连该脚本都移除了。工具会自动改用 app_process 直启，你什么都不用做。

**Permission denied**
同样是分区存储限制（不是权限没开）。工具会自动换方案。只有 app_process 直启也失败时，才需要查手机端设置（MIUI 的「USB 调试（安全设置）」、ColorOS 的「权限监控」）。

**提示未安装 Shizuku 应用**
手机上确实没装，或装的是修改版导致包名不对。从官方渠道安装后打开一次即可。

**设备显示 unauthorized**
手机上的授权弹窗没确认。撤销 USB 调试授权 → 重新插线 → 重新勾选。

**激活成功但过一会儿失效**
手机重启后 ADB 会话结束，Shizuku 随之停止。这是系统限制，重启手机后重新激活一次。

**无线调试一直「正在搜索配对服务」**
Shizuku 被系统限制后台联网了。到电池优化/后台管理里把它设为「不优化」。

---

## Fastboot 专区

Fastboot 是 Android 的底层刷机模式，功能比 adb 更底层（直接和 bootloader 通信）。

### 进入方式

- 关机状态下按住「音量下 + 电源」开机
- 或已连 adb 时执行 `adb reboot bootloader`
- 部分机型是「音量上 + 音量下 + 电源」

进入后回到工具的 Fastboot 专区点「刷新」。

### 支持的操作

| 分组 | 操作 |
|---|---|
| 重启 | 重启系统 / 重启到 Bootloader / 重启到 Recovery |
| 刷入镜像 | 刷入 boot / recovery / vbmeta / ZIP 包 / 临时启动镜像 |
| Bootloader | 解锁 / 锁定 |
| 清理数据 | 清除缓存 / 清除用户数据 / 格式化并恢复出厂 |

刷入类操作需要先在界面上「浏览…」选择镜像文件（`.img` / `.zip` / `.bin` 等）。

### 安全设计

高风险操作会弹出**二次确认**，并明确告知后果：

- **解锁 Bootloader** —— 会清除全部数据，且可能导致银行/支付类应用无法使用
- **清除用户数据 / 格式化** —— 等同恢复出厂，资料全丢
- **刷入镜像** —— 镜像必须与机型、版本完全匹配，否则可能变砖

确认框里会显示即将执行的完整命令原文，方便核对。

### 注意

- `fastboot.exe` 随 Google SDK Platform-Tools 一起分发，**通常与 adb.exe 同目录**，工具会自动找到；找不到时可在设置里手动指定路径。
- 操作期间不要拔数据线。
- 如果只是想给应用授权系统 API，**不需要 fastboot**，用 Shizuku 激活专区就够了。

---

## 配置

配置在 `%APPDATA%\shizuku-launcher\config.json`，设置界面和这个文件是同一份，改哪个都生效。

```jsonc
{
  "adbPath": "",                    // 手动指定 adb.exe；留空自动探测
  "fastbootPath": "",               // 手动指定 fastboot.exe；留空自动探测
  "autoDownloadAdb": true,          // 没 adb 时自动下载
  "platformToolsMirror": "https://dl.google.com/android/repository/platform-tools-latest-windows.zip",
  "startScriptPaths": [             // 启动脚本路径，按顺序尝试
    "/sdcard/Android/data/moe.shizuku.privileged.api/start.sh",
    "/storage/emulated/0/Android/data/moe.shizuku.privileged.api/start.sh",
    "/data/local/tmp/shizuku_starter"
  ],
  "checkIntervalMs": 3000,          // 状态轮询间隔
  "autoCheckStatus": true,          // 激活后自动监控
  "logLevel": "INFO",               // DEBUG / INFO / WARN / ERROR
  "theme": "light",                 // light / dark / system
  "wireless": {
    "connectPort": 5555,
    "pairPort": 37129
  }
}
```

---

## 日志

日志写在 `%APPDATA%\shizuku-launcher\logs\`，按天切分，单文件超 8MB 自动滚动。

界面上可以实时看、搜、过滤级别、一键导出成合并文本文件。调不通的时候，把导出的日志发出来基本能定位。

每条日志都带命令原文、返回码、结构化的附加信息：

```
[2026-10-31 21:45:48.543] DEBUG 执行 adb 命令 {
  cmd: 'D:\\platform-tools\\adb.exe -s FAKE1234 shell sh /sdcard/.../start.sh'
}
```

---

## 开发

```
shizuku-launcher/
├── src/
│   ├── main/
│   │   ├── main.js       Electron 主进程、窗口、IPC 注册
│   │   ├── adb.js        adb 定位 / 下载 / 命令执行
│   │   ├── shizuku.js    设备、配对、激活、状态探测、诊断
│   │   ├── fastboot.js   fastboot 定位 / 设备枚举 / 操作封装 / 风险分级
│   │   ├── logger.js     日志系统（分级 / 落盘 / 轮转 / 推送）
│   │   └── config.js     配置读写（原子写入 + 深合并）
│   ├── preload/
│   │   └── preload.js    contextBridge 安全桥
│   └── renderer/
│       ├── index.html    界面结构（两大区）
│       ├── styles.css    样式（浅色 / 深色）
│       └── renderer.js   界面逻辑
├── scripts/
│   ├── make-icon.js      纯 Node 生成 PNG / ICO 图标
│   ├── make-launcher.js  生成纯 ASCII 的启动器 .bat
│   ├── refactor-nav.js   导航结构重构脚本（一次性）
│   ├── ui-tour.js        UI 巡检（逐屏截图）
│   └── postinstall.js    Electron 下载镜像探测
└── test/
    ├── core.test.js      核心逻辑测试（48 项）
    ├── fake-adb.js       假 adb 实现
    ├── fake-adb.bat      假 adb 包装器
    ├── fake-fastboot.js  假 fastboot 实现
    └── fastboot.bat      假 fastboot 包装器
```

### 跑测试

不需要真机，也不需要 Electron：

```bash
node test/core.test.js
```

用假 adb / 假 fastboot 桩覆盖配置、日志、adb 与 fastboot 定位、设备枚举、无线配对、激活、状态探测、设备诊断、fastboot 刷入/解锁/清理、错误诊断、导出等 48 个场景。

### 调 UI

```bash
npm run dev
```

会打开 DevTools，改 `styles.css` 直接看效果。

---

## 已知限制

- **Shizuku 应用本身必须先装在手机上** —— 这个工具负责的是「启动服务」，不是「安装应用」。
- **手机重启后需要重新激活** —— Android 系统限制，无法绕过。
- **无线调试仅 Android 11+** —— Android 10 及以下只能用 USB。
- **部分 ROM 会杀后台** —— 需要把 Shizuku 加入电池优化白名单，见上面的厂商表格。

---

## 许可

MIT

# 快速上手（速查卡）

## 三步激活

```
① 手机装好 Shizuku 应用（打开过一次）
② 电脑上打开本工具 → 选设备 → 点「立即激活」
③ 手机上 Shizuku 显示「已启动」→ 去「设置」授权其他应用
```



---

## 手机端必做（一次配好长期有效）

| 步骤     | 路径                          |
| ------ | --------------------------- |
| 开发者选项  | 设置 → 关于手机 → 连点「版本号」7 次      |
| USB 调试 | 开发者选项 → 开启                  |
| USB 用途 | 开发者选项 → USB 配置 → 仅充电        |
| 后台运行   | 电池优化 → Shizuku → 不优化 / 允许后台 |

**厂商额外项**

- 小米/MIUI：开发者选项 → 开「USB 调试（安全设置）」；通知样式改「原生」
- OPPO/ColorOS：开发者选项 → 关「权限监控」
- 魅族/Flyme：关「Flyme 支付保护」
- 华为/EMUI：开「仅充电模式下允许 ADB 调试」

---

## 无线调试（Android 11+，免数据线）

手机：**开发者选项 → 无线调试** 页面能看到

```
IP 地址        192.168.1.100     ← 填「设备 IP」
端口           5555              ← 填「连接端口」（主界面顶部那个）
配对端口       37129             ← 点「使用配对码配对设备」弹窗里的
配对码         123456            ← 弹窗里的 6 位数字
```

操作顺序：**先「配对」→ 再「连接」**。配对只需做一次。

---

## 状态对照

| 界面显示        | 含义                             |
| ----------- | ------------------------------ |
| 服务进程 ✓      | `shizuku_server` 进程在跑          |
| Binder 注册 ✓ | `/proc/net/unix` 里有 shizuku 服务 |
| 应用已安装 ✓     | `pm path` 能查到包名                |

三个都 ✓ = 完全可用。

---

## 出问题了

**看日志**：界面底部日志面板 → 右上角「导出」按钮 → 把 txt 发出来。

**日志在哪**：`%APPDATA%\shizuku-launcher\logs\`

**提高日志详细度**：设置 → 日志级别 → `DEBUG` → 再操作一次，日志里会记录每条 adb 命令原文和返回码。

---

## 关键命令（手动备用）

```powershell
# 看设备
adb devices -l

# ★ 推荐：app_process 直启（Android 11+ 唯一可靠方案）
adb shell "pm path moe.shizuku.privileged.api"
adb shell "/system/bin/app_process -Djava.class.path=/data/app/~~xxx==/moe.shizuku.privileged.api-yyy==/base.apk /system/bin --nice-name=shizuku_server rikka.shizuku.server.ShizukuService"

# 老方案：start.sh（Android 10 及以下可用，Android 11+ 会被分区存储拒绝）
adb -s <设备序列号> shell sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh

# 查状态
adb shell ps -A | grep shizuku_server

# 无线配对
adb pair 192.168.1.100:37129 123456
adb connect 192.168.1.100:5555
```

---

## 记住这四条

1. **手机重启后必须重新激活** —— 系统限制，无法绕过
2. **「找不到 start.sh」是正常的** —— Android 11+ 分区存储限制 + Shizuku v13.7 已移除该脚本。工具会自动改用 app_process 直启
3. **MIUI 必须开「USB 调试（安全设置）」** —— 九成失败都是这个
4. **adb 没有就点「下载内置 adb」** —— 不用自己装 SDK

---

## 卡住了怎么办

点工具里的 **「设备诊断」** 按钮，它会逐项告诉你：

- Shizuku 应用装了没
- Android 版本（是否触发分区存储限制）
- Android/data 能不能读
- start.sh 在不在
- app_process 在不在
- 服务跑没跑

每项都会给出原因和下一步建议，比自己猜快得多。

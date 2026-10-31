# 工具脚本说明

本目录下的脚本是开发期用来**快速查看本地 Vela 工程目录结构**的小工具，不是任何项目的构建步骤，也不会被 CI 调用。它们用 Node.js 运行，路径硬编码在作者本机 `C:\Users\Administrator\Desktop\xiaomi vela`，换机器运行前需先修改脚本里的 `baseDir` / `dir` / `srcPages` / `srcDir` 等路径变量。

## 脚本清单

### explore.js
递归打印 `伪装软件 v1` 工程的目录骨架：先定位 `src/`，再列出 `src/` 与 `src/pages/` 下的文件与文件夹，一眼看清工程有哪些页面与源文件。

### list_files.js
列出 `xiaomi vela` 目录下的所有子目录；对名称含「伪装」的目录，再往里展开一层（子目录及其子项），方便核对伪装软件工程的内部结构。

### list_pages.js
只列出 `伪装软件 v1\src\pages` 目录内容（页面清单），用于确认手表应用的各个页面文件夹。

### list_src.js
只列出 `伪装软件 v1\src` 目录内容，查看源文件顶层结构。

## 运行

```bash
node explore.js
node list_files.js
node list_pages.js
node list_src.js
```

> 注意：脚本依赖本机绝对路径，clone 到别的机器运行前请先改路径。

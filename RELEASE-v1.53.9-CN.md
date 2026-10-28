## 📈 v1.53.9-CN Release Notes

> 上一个版本：[v1.53.8-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.8-CN)
>
> 🚀 这个版本修好了一个**沉默的严重故障**：图谱后端在 macOS（以及其它平台）上一直初始化失败、静默退回内存模式，导致 Cypher 搜索全不可用——现在图谱引擎真正跑起来了。同时把整条图谱表面的报错统一成英文、状态机不再往 `AGENTS.md` 里塞副本、文档预览能正常显示手写的 HTML 表格，终端里的重扫心跳也不再一行行往上堆。

### 🐞 修复

- 🩺 **图谱引擎恢复可用（关键）**：v1.53.8 上，启动日志会出现 `[graph] RyuGraph (WASM) 后端初始化失败，回退到 memory 降级模式（Cypher 检索不可用）`，缓存目录里只有锁文件和指纹文件、没有数据库本体——于是 Web 图谱页的放大镜搜索、`backlog graph query`、图谱 MCP 查询工具**全部失效**。根因是数据库路径传了宿主的绝对路径，而 WASM 引擎的文件系统（MEMFS）根本看不见它。现在改为交给引擎一个内存文件系统内的句柄路径（宿主缓存目录仍保留锁与指纹），Cypher 检索恢复，冷启动指纹缓存也重新生效（BACK-823）。
- 📊 **文档里的 HTML 表格能正常渲染**：手写 `<table>` 此前被当成纯文本显示成一堆尖括号标签。现在原始 HTML 表格与 Markdown 管道表格一样正常渲染，且**行高一致**；XSS 面由白名单 sanitizer 挡住（`script`、`onerror`、危险链接仍会被剥掉）（BACK-821）。
- 💓 **重扫心跳不再刷屏**：`backlog browser` 运行时的周期对账心跳原先会不断追加新行，把终端刷满。现在它**钉在终端最后一行原地刷新**，其它日志（watcher 警告、请求日志）出现时会先把心跳推进历史、不破坏原地重写；Windows 的 Git Bash / MSYS2（winpty 下 `isTTY` 为假）会在 `backlog browser` 里自动启用，重定向到文件或 CI 环境保持纯文本、不带 ANSI（BACK-815.01）。

### 🧹 行为调整

- 🈶 **图谱相关提示统一为英文**：`backlog graph` / `graph legend` 的全部输出与 `--help` 文案、图谱库与图谱 MCP 工具的错误、以及 `/api/graph/*`、`/api/sqlite/*`、`/api/duckdb/*` 返回的 `error` 字段都改为英文。此前这些位置混用中文，而 Web 界面会把服务端的 `error.message` 原样显示在本地化界面里（BACK-823）。
- 📄 **状态机不再写进代理指令文件**：`backlog init`、`backlog agents --update-instructions` 与服务端保存状态机三处，过去都会把渲染好的状态机复制进 `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`，等于给 `config.yml` 造一份会漂移的副本。现在写入路径全删，**已有的旧区块会被自动移除**；状态机仍然由 `backlog instructions overview` 按当前配置现场渲染。顺带把 `AGENTS.md` 的指南清单补齐（新增 `decisions`、`graph`、`memos`），与 `overview` 对齐（BACK-822）。

### 🧩 怎么用

**确认图谱真的起来了**：

```bash
backlog graph query default "MATCH (n) RETURN count(n) AS n"
```

- 有正常计数返回 = 走的是 RyuGraph 引擎；此时缓存目录里只有 `*.kuzu.lock` 与 `*.kuzu.meta.json`，**看不到 `.kuzu` 是正常的**（数据库本体在 WASM 的内存文件系统里，Markdown 仍是唯一真源）。
- 若终端仍出现 `[graph] RyuGraph (WASM) backend init failed ...`，告警末尾会给出原因：`database path not visible to the WASM filesystem` 属于路径不可见，`engine error` 才是引擎故障。

**清掉旧版本留下的状态机区块**（可选，升级后会自动执行）：

```bash
backlog agents --update-instructions
```

**关掉终端心跳状态行**（如需干净日志）：

```bash
backlog browser --no-status-line
```

### ⚠️ 需要注意

- 🧾 **图谱缓存目录里没有 `.kuzu` 文件**：这是修正后的正常形态。图谱是可丢弃的派生缓存，进程重启后会重建（指纹与快照让它很快），不是数据丢失。
- 🈶 **若有脚本在解析图谱的中文报错文案**，需要改为匹配英文；退出码、选项名与消息结构未变。
- 📄 **代理指令文件里不会再出现状态机**：习惯从 `AGENTS.md` 读状态机的流程，请改用 `backlog instructions overview`（该输出随 `config.yml` 实时渲染）。

### ⬆️ 升级说明

- ✅ **直接升级，无需迁移**：没有配置文件与缓存格式变更；旧版本写进代理指令文件的 `state-machine` 区块会在下次 `backlog init` 或 `backlog agents --update-instructions` 时自动移除，原有的 `.lock` / `.meta.json` 无需手动清理。
- 🚑 **此前「图谱搜索没结果」的用户升级后即可恢复**：该缺陷与平台无关——宿主路径对 WASM 的 MEMFS 不可达，在 macOS / Windows / Linux 上一致存在，六个发布目标（darwin/linux/windows × arm64/x64）全部受影响，本次一并修复，无需迁移任何数据（宿主上从未生成过图谱数据库文件）。
- 💓 终端状态行默认在真实终端与 Git Bash 下启用，可用 `--status-line` / `--no-status-line` 显式覆盖，或用 `BACKLOG_STATUS_LINE=1` 强制开启。

### 🐞 已知问题

- 无新增已知问题。v1.53.8 中「macOS 上 RyuGraph (WASM) 后端初始化失败、Cypher 检索不可用」已由本版本修复（BACK-823）。

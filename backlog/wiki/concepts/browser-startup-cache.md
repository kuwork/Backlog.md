---
title: 浏览器启动缓存体系
labels: [concept, cli, core, server, performance, cache]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
---

# 浏览器启动缓存体系

`backlog browser` 的启动时间由五段彼此独立的成本叠加而成，BACK-843 逐一处置后有浏览器附着的首屏从 85~175s 降到约 1.5s 热启动。理解这套体系的关键是：**最贵的那一段不是业务代码，而是 Bun 自己**。

## 五段成本

| 成本 | 处置 |
|---|---|
| 阻塞式远端 refs fetch（~70s） | 一次性 `skipInitialRemoteRefresh`，首载跳过，后台 `refreshTasksForTaskRead()` 追平 |
| 跨分支扫描（~10.7s / 12 refs / 3481 记录） | 按 **commit** 内容寻址落盘缓存；同一 tip 的本地与远端 ref 共享一次 git 读 |
| 本地任务文件 read+parse（~2.7s） | stat 签名快路径，未变文件零读取 |
| bind 时 eager graph 冷启动（~100s WASM） | 延迟到首个 `/api/graph` 请求 |
| Bun 对 HTML 入口的惰性 `Bun.build`（123~159s / 24MB JS） | UI 包按内容指纹落盘缓存 + 子进程构建 |

第五段解释了「有浏览器 175s、无浏览器 1.5s」的反直觉现象：`import indexHtml from "../web/index.html"` 让 Bun 在服务器线程上编译 24MB JS，饿死所有待执行 continuation —— 包括 wiki 扫描和阶段日志，所以终端才在 merge 行之后彻底沉默。

## 缓存分层

- **branch-cache**：`<cache>/backlog.md/branch-cache/<sha256(repoRoot)>/`，一个 commit 一个 index + 一个 task bundle。按 commit 而非分支名做键，因为 tip 不可变。首版每任务一个 JSON 文件，在 Windows 上 ~1.7k 次 await mkdir/write/rename 加 readdir prune 卡了约 4 分钟，改成单 bundle + 批量 prune 才收住。空的 index 也要缓存，否则纯 docs 分支每次重启都重跑 git。
- **web-bundle**：`<cache>/backlog.md/web-bundle/<fingerprint>/`。指纹 = 包格式版本 + `package.json` 的**依赖映射**（改脚本 / 描述不该丢弃两分钟的构建）+ lockfile 内容 + `src/web` 全部文件内容哈希。用内容而非时间戳，checkout / touch 不该触发重建；刻意不含 Bun 版本，否则 `bun run`（`node_modules/bun`）与全局 bun 会把同一源码树劈成两份缓存。命中时 shell `no-store`、资源 `immutable`；每个槽约 24MB，只留当前槽 + 最新一个回退槽。
- **content-cache**：documents / decisions / wiki pages 的签名缓存（size/mtime/ctime → 已解析值）。仍枚举文件以发现增删，但只 stat 不 read，快照仅在扫描确实有变化时重写。
- **统一根** `src/utils/cache-dir.ts`：显式 `$XDG_CACHE_HOME` 全局优先 → Windows `%LOCALAPPDATA%`（回退 `~/AppData/Local`）→ macOS `~/Library/Caches` → Linux `~/.cache`。此前五个模块各写各的，macOS 上两份落到 `~/.cache`，graph 那份还只在 Linux 尊重 `XDG_CACHE_HOME`。

## 冷路径与 --no-cache

未命中时**不阻塞**：shell 立即回一个自刷新进度页（或继续服务上一份构建），`scripts/build-web.ts` 在**子进程**里跑，事件循环保持空闲，构建落地后无需重启即生效。编译后的二进制仍用内嵌 HTML 包，因为那次构建在打包时已经做过。

`--no-cache` 只有一个 env 开关 `BACKLOG_NO_CACHE`（`src/utils/cache-policy.ts`），所有缓存层自查，**只跳过读、保留写**：该次冷启动重建的正是它忽略的条目，下一次普通启动又回到热路径。这也让它兼作可疑缓存的修复手段。用 env 而非逐层透传参数，是为了以后新增缓存层不会因为没人接线而继续读盘。

## 可观测性

`log.ts` 统一 `HH:MM:SS.mmm [tag]`；原本只走 WebSocket 的 loading 状态镜像到终端，新增 `[startup]` 阶段耗时、`[cache]` 每 ref restored/building（分支 + local|remote + 短哈希）、`[merge]` 三步。`ensureServicesReady()` 在 bind 后 `setTimeout(0)` 立刻启动。进度日志由 `enableProgressLogs()` 显式开启，**只有 browser 命令与 Web server 打开**，否则 `[cache] ...` 会污染 `backlog task list` / `decision list` 的纯文本断言。

## 两处回归（改动路由/缓存时必查）

1. **socket 开机即死**：shell 改成路由 handler 后，SPA 路由抢在 websocket handler 之前匹配；客户端在 origin root 开的 `WebSocket` 本质是带 `Upgrade` 的 GET，被回成 HTML 而不是 101。`serveAppShell` 必须先判 `Upgrade: websocket` 并把请求交回 `handleRequest`。这也直接影响 [[concepts/corpus-digest]] 的连接时摘要播种。
2. **身份索引隐藏 800ms**：`path.relative` 占 CPU profile 21.6%（3481 记录 × 最多两次 × 78µs）。`createRecordPathNormalizer` 把只依赖上下文的部分提到循环外、`relativeToRoot` 用大小写不敏感前缀剥离，816ms → 70ms。

## Related Concepts

- [[concepts/web-server]] — 子进程构建、shell 路由与 upgrade 让回
- [[concepts/browser-loading]] — 首载状态与进度日志
- [[concepts/corpus-digest]] — 连接时 corpus-state 播种
- [[concepts/kuzu-graph]] — 延迟启动的 graph 服务

## Related Sources

- [[sources/back-843-browser-startup-cache]] — 主实现与全部实测数据
- [[sources/back-841-corpus-digest-gap-fixes]] — 连接时序
- [[sources/back-553-modernize-browser-bundling]] — 更早的打包现代化

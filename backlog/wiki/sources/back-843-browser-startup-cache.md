---
title: BACK-843 - 浏览器启动提速、UI 包缓存与 --no-cache
labels: [source, cli, core, server, performance, cache, high-priority]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/tasks/back-843 - Speed-up-browser-startup-cache-the-UI-bundle-and-add-no-cache.md
---

# BACK-843 - 浏览器启动提速、UI 包缓存与 --no-cache

Web UI 首屏曾空白 85~175 秒且终端一声不吭。本任务把整条启动链路拆成五项成本逐一消除或推迟，从 85-175s 降到约 1.5s 热启动。

## 五项成本与对应手段

| 成本 | 实测 | 手段 |
|---|---|---|
| 阻塞式远端 refs fetch | ~70s | `skipInitialRemoteRefresh` 一次性旗标，首载跳过；后台 `refreshTasksForTaskRead()` 追平并打日志 |
| 未缓存的跨分支扫描 | ~10.7s（12 refs / 3481 记录） | 按 **commit** 内容寻址落盘缓存（`<cache>/backlog.md/branch-cache/<sha256(repoRoot)>/`），同一 tip 的本地与远端 ref 共享一次 git 读 |
| 本地任务文件全量 read+parse | ~2.7s | `ParsedTaskFile` 带 size/mtime/ctime 签名，未变文件 **stat 即返回、零读取**；touch 但字节相同只刷新签名 |
| bind 时 eager 起 graph 服务 | ~100s WASM 构建 | 改为首个 `/api/graph` 请求时才启动 |
| Bun 对 HTML 入口的惰性构建 | 123~159s，24MB JS，跑在服务器线程上 | UI 包按内容指纹落盘缓存，命中即静态服务；未命中用**子进程**构建 |

第五项是此前无人归因的隐形冠军：有浏览器附着时 175s、无浏览器时 1.5s，差别全在 `import indexHtml from "../web/index.html"` 触发的 `Bun.build` 霸占事件循环，饿死了包括 wiki 扫描与阶段日志在内的所有 continuation。

## 缓存体系

- **UI 包**：`src/server/web-bundle.ts`，指纹 = 包格式版本 + `package.json` 的依赖映射（**只取依赖**，改脚本/描述不该丢弃两分钟的构建）+ lockfile 内容 + `src/web` 全部文件内容哈希。刻意**不含 Bun 版本**，否则 `bun run`（`node_modules/bun`）与全局 bun 会把同一源码树劈成两份缓存。命中时 shell `no-store`、资源 `immutable`；未命中先服务上一份构建或自刷新进度页，构建在子进程里跑完即生效、无需重启。编译后的二进制仍用内嵌包。
- **内容集合**：`content-cache.ts` 把任务解析缓存的签名法推广到 documents / decisions / wiki pages；仍枚举文件以发现增删，但只 stat 不 read，快照仅在扫描确实有变化时重写。
- **统一根**：`src/utils/cache-dir.ts` 是唯一答案 —— 显式 `$XDG_CACHE_HOME` 全局优先，Windows `%LOCALAPPDATA%`（回退 `~/AppData/Local`）、macOS `~/Library/Caches`、Linux `~/.cache`。此前五个模块各自解析，其中两个在 macOS 落到 `~/.cache`、graph 那份还只在 Linux 尊重 `XDG_CACHE_HOME`。
- **`--no-cache`**：`BACKLOG_NO_CACHE` 一个 env 开关，所有缓存层自查；**只跳过读、保留写**，因此该次冷启动重建的正是它忽略的那些条目，下一次普通启动又回到热路径，同时兼作可疑缓存的修复手段。

## 可观测性与两处回归

`log.ts` 输出 `HH:MM:SS.mmm [tag]`，把原本只走 WebSocket 的 loading 状态镜像到终端，新增 `[startup]` 阶段耗时、`[cache]` 每 ref restored/building（分支 + local|remote + 短哈希）、`[merge]` 三步。`ensureServicesReady()` 在 bind 后 `setTimeout(0)` 立刻启动。进度日志改成 `enableProgressLogs()` 显式开启，只有 `browser` 命令与 Web server 打开，避免 `[cache] ...` 污染 `backlog decision list` 的纯文本断言。

- **socket 开机即死**：shell 改成路由 handler 后，SPA 路由抢在 websocket handler 之前匹配；客户端在 origin root 开的 `WebSocket` 本质是带 `Upgrade` 的 GET，被回成 HTML 而非 101。`serveAppShell` 先判 `Upgrade: websocket` 并把请求交回 `handleRequest`。
- **identity merge 隐藏 800ms**：CPU profile 显示 `path.relative` 占 21.6%，3481 条记录每条约 78µs 且最多调两次。`createRecordPathNormalizer` 把只依赖上下文的部分提到循环外、`relativeToRoot` 用大小写不敏感前缀剥离，816ms → 70ms。

## 结果

| 场景 | 之前 | 之后 |
|---|---|---|
| 冷启动 `--no-cache` | — | 10.5~10.9s（重建缓存） |
| 热启动 | 85~175s | 1.5~2.3s，零文件读取 |
| 缓存命中首屏 | 79~175s | shell 0.32s，`services ready 1537ms` |
| 无缓存首屏 | 空白 79~175s | shell 0.07s，真实 UI 待后台构建落地（约 160s），无需重启 |
| wiki 页 722 个 | 713ms / 722 读 | 442ms / 722 stat / 0 读 |

## 验证

`tsc --noEmit`、Biome 干净；branch loader 29、filesystem task cache 12、cache-policy 2、content-store 16、web-bundle 7、content-cache 6、cache-dir 7 等套件通过，另含 doc/decision/wiki/MCP/TUI 相关套件。两种启动模式在活跃服务端实测；路由改动后重验 socket（能收到初始 `corpus-state`）、`/api/config`、`/tasks`。`server-port.test.ts` 在本机 EADDRINUSE 失败，stash 后复跑确认为既有问题。

## Related Concepts

- [[concepts/browser-startup-cache]] — 缓存分层、指纹与冷/热路径
- [[concepts/web-server]] — 子进程构建、shell 路由与 upgrade 让回
- [[concepts/browser-loading]] — 首载状态与进度日志
- [[concepts/corpus-digest]] — 连接时 corpus-state 播种依赖 services ready

## Related Sources

- [[sources/back-841-corpus-digest-gap-fixes]] — WebSocket open 时序
- [[sources/back-553-modernize-browser-bundling]] — 更早的打包现代化
- [[sources/back-823-ryugraph-wasm-memfs-handle]] — graph WASM 冷启动背景

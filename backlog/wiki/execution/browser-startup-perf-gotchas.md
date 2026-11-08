---
title: 浏览器启动性能排查陷阱集
labels: [execution, performance, cache, server, bun, windows]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
extracted_from:
  - BACK-843
  - BACK-841
  - BACK-840
---

# 浏览器启动性能排查陷阱集

从 BACK-843 的 Implementation Notes 提炼的跨任务可复用陷阱。适用场景：任何「启动慢」「首屏空白」「终端无输出」「缓存命中但依然慢」的排查。

## 1 先分有无浏览器附着，再归因

同一份代码有浏览器附着时 175s、无浏览器（`--no-open`）时 1.5s，差别不在语料而在 **Bun 的 HTML 入口惰性构建**：`import indexHtml from "../web/index.html"` 让 `Bun.serve` 在**服务器线程**上跑 `Bun.build`（24MB JS，123~159s），饿死所有待执行 continuation。所以「wiki 扫描慢」「阶段日志没打印」都可能只是被 CPU 霸占的假象。

> 测量顺序：分别计时 `--no-open` 启动、services ready 后的单次 `GET /`、以及独立 `Bun.build` HTML 入口。三者一比就能把成本隔离到构建而非语料。

## 2 零读取不等于零枚举

签名缓存（size/mtime/ctime）能省掉 read，但仍需枚举文件才能发现增删。722 个 wiki 页从 713ms/722 读降到 442ms/722 stat/0 读；想再降就得改发现机制，不是继续优化 stat。快照只在扫描确实有变化时重写，否则热启动每次写 2MB JSON 反而变慢。

## 3 Windows 上的小文件写入会放大成分钟级

首版 branch cache 每任务一个 JSON：~1.7k 次 await mkdir + write + rename，每次后面还跟一次 readdir prune，冷启动挂了约 4 分钟。改成一个 commit 一个 bundle + 批量 prune 才收住。**批量落盘优先于逐条落盘**，尤其 Windows。

## 4 缓存键要选不可变的东西

- 分支 tip 解析成 commit，按 **commit** 而非分支名缓存：本地与远端 ref 在同一 tip 共享一次 git 读。空 index 也要缓存，否则纯 docs 分支每次重启都重跑 git。
- UI 包指纹用**内容**（依赖映射 + lockfile + `src/web` 全文件哈希），不用时间戳（checkout/touch 不该触发两分钟重建），也不要含 Bun 版本（`bun run` 走 `node_modules/bun`、全局 bun 是另一个二进制，会把同一源码树劈成两份缓存）。
- 内存里的 promise 必须**同步注册再 await**：先 `await resolveRepoCacheRoot()` 会让同 tip 的两个 ref 各走一次 git。缓存命中路径也要同步登记 read generation，否则落到旧 epoch。

## 5 启动日志默认别写 stdout

把 `[cache] ...` 加进 `listWikiPages` 会破坏 `backlog decision list` 的纯文本断言（stdout 被精确比较）。进度日志必须 opt-in（`enableProgressLogs()`），只有 `browser` 命令和 Web server 打开；一次性 CLI 保持干净。

## 6 改 SPA 路由 handler 必查 WebSocket upgrade

客户端在 origin root 开的 `WebSocket` 本质是带 `Upgrade` 的 GET。用路由 handler 替换 `"/": spaIndexHtml` 后，SPA 通配路由会抢在 websocket handler 前匹配，socket 拿到 HTML 而不是 101，表现为连接立刻断开并无限重试；连带的 `corpus-state` 摘要播种也收不到。shell handler 必须先判 `Upgrade: websocket` 并把请求交回 `handleRequest`。改完后重验三件事：socket 能收到初始 `corpus-state`、`/api/config` 返回 JSON 而不是被 `/*` 吞成 HTML、`/tasks` 返回 200。

## 7 隐藏的 CPU 热点要 profile，不要凭直觉

身份索引 merge 的 816ms 里，`path.relative` 占 21.6%（3481 记录 × 最多两次 × 约 78µs，Windows Bun）。把只依赖上下文的部分提到循环外做成 per-index normalizer、用大小写不敏感前缀剥离代替 relative，降到 70ms。

## 8 让 --no-cache 只跳读不跳写

一个 env 开关（`BACKLOG_NO_CACHE`）供所有缓存层自查，**忽略磁盘读但照常写**：这次冷启动重建的正是它忽略的条目，下一次普通启动自然回到热路径，同时兼作可疑缓存的修复手段。用 env 而非逐层透传参数，新增缓存层不会因为没人接线而继续读盘。

## Related Concepts

- [[concepts/browser-startup-cache]] — 完整缓存体系
- [[concepts/web-server]] / [[concepts/browser-loading]] — 受影响的服务端与首载路径

## Related Sources

- [[sources/back-843-browser-startup-cache]] — 全部实测数据与 P1~P13 步骤
- [[sources/back-841-corpus-digest-gap-fixes]] — 连接时摘要播种的时序依赖

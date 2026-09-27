---
title: Kuzu 图谱的后端、生命周期与存储治理设计推理
created_date: '2026-09-26 22:05'
updated_date: '2026-09-26 22:05'
labels: [reasoning, graph, kuzu, storage]
---

# Kuzu 图谱的后端、生命周期与存储治理设计推理

为什么任务依赖图谱长成现在这样：一个可切换的双后端、以文件路径为主键的节点表、带指纹的冷启动、三层兜底的热更新，以及自描述的版本守卫。设计依据是 doc-14（冷启动与热更新）与 m-9（Phase 1 范围），落地分布在 BACK-702/703/704/713。

## 原始需求与设计约束

- 要在 **fork 自己的语料**之上回答任务之间的依赖、父子、里程碑归属关系，并给 Web UI 一个可视化面
- Markdown 文件是唯一事实来源，图谱是**可丢弃的派生缓存**——任何时刻删掉图谱必须能从文件重建
- 冷启动要快（不能每次启动全量 frontmatter 解析），热更新要准（CLI/TUI/Web/MCP 四个入口的写入都要被看见）
- 上游没有可参照的图组件，整套是自研；因此每一项选型都要能被本地实测否证

## 问题分解

1. **用什么存图**：嵌入式图库（Cypher 形状、图的多跳能力）还是自己维护内存 Map？
2. **节点主键是什么**：任务 ID 还是文件路径？
3. **冷启动怎么判断"要不要重建"**：全量重解析、文件内容哈希、还是 size+mtime 边车？
4. **热更新怎么接**：改 core 每个出口、挂 watcher、还是轮询？三者如何兜底？
5. **变更怎么通知前端**：新开 SSE 通道还是复用既有 WebSocket？
6. **图谱文件放哪、谁来持锁**：项目树内、还是 OS 缓存目录按槽位分家？
7. **schema 变了怎么办**：写迁移脚本，还是让缓存自描述版本并整体重建？

## 备选方案对比

| 议题 | 方案 A | 方案 B | 选择与理由 |
|---|---|---|---|
| 存储 | kuzu 原生绑定唯一后端 | `GraphStore` 抽象 + 双后端，默认纯 JS `MemoryGraphStore`，`BACKLOG_GRAPH_BACKEND=kuzu` 可选 | **B**。实测否决了 A：kuzu 0.11.3 在 Node 下加载正常，在 Bun 1.3.14/Windows 下 `dlopen` **直接 SEGFAULT**（正是 doc-14 §5 预警的风险）。抽象掉后端后，默认路径不依赖原生绑定 |
| Kuzu 侧的正确性怎么保障 | 只能在 Bun 里跑也就只能在 Bun 里验 | SQL 形状经 **Node 冒烟运行**端到端验证（`tmp/smoke-kuzu.cjs`：DDL、分片批处理写入、REL 表 `COPY FROM`、计数/取点/取元数据查询） | **B**。绑定不能在 Bun 进程内加载，就把「能加载它的运行时」当成唯一能验证它的场所，实现与验证解耦 |
| 节点主键 | `Task(id PRIMARY KEY, filePath)` | `FileNode(path PRIMARY KEY, id, …)`（BACK-713） | **B**。ID + 路径是**两套身份**，前者会撞（归档号码复用、跨分支同名、draft/task 并列），后者天然唯一。改主键后，改名/移动/完成/升降级全部折叠成一次「删旧路径 + 建新路径 + 重建受影响边」的同 ID 迁移 |
| 对外 API | 跟着主键改成路径寻址 | `getPayload` 负责把路径翻译回任务 ID | **B**。ID 降级为属性是实现细节，前端与 `/api/graph` 契约不动；这让 BACK-713 的重命名对调用方零感知 |
| 冷启动判据 | 每次全量重算哈希 | 每文件边车缓存 `{size, mtimeMs, hash}`，size+mtime 命中即复用→只重算变化文件；再算聚合指纹 sha256(PARSER_VERSION + 排序后 relPath\|hash) | **B**。启动只做 **stat 扫描**不读内容；「touch 但内容未变」也能命中。聚合指纹要求 `nodeCount > 0` 才算可复用，避免"空库也算命中" |
| 解析器升级 | 在 fingerprint 里只哈希文件内容 | 把 `PARSER_VERSION` 混进聚合指纹 + 边车记录 `parserVersion` | **B**。解析器或扫描器一升级就强制重建，不必写"什么时候该失效"的规则 |
| 热更新接入口 | 只挂 `Bun.watch` | **core notify 钩子**（沉在 core 变更公共出口：completeTask/archiveTask/moveTasksToStatus/reorderTask/createTaskFromInput/editTaskInTui/updateMilestone/demote/promote）+ watcher 兜底 + 5 分钟 stat 对账 | **B**。钩子让 CLI/TUI/Web/MCP 四个入口零改动全覆盖（默认 no-op 回调），watcher 接住编辑器与 git 的外部改动，定时对账兜住前两者的漏 hole。三条路径汇聚到同一 pending Set，150ms 防抖 + 锁串行化 |
| 变更广播 | 新建 SSE 通道 `broadcastGraphChanged()` | 复用既有 WebSocket 推 `graph-updated` | **B**（偏离计划）。BACK-703 的设计写的是 SSE，落地在 `src/server/index.ts` 走既有 socket 通道发 `graph-updated`，避免为一个订阅者多开一条长连接；前端 `graphVersion` 自增即可原地重取 |
| 图谱文件位置 | `backlog/graph.kuzu`（BACK-702 初版，项目树内） | OS 缓存目录 + slot 键控：`backlog-graph-<sha256-16>.{kuzu,kuzu.meta.json,kuzu.lock}`（BACK-704） | **B**。树内文件会被两条可能撞车的实例争抢，也会污染 `git status`；按 slot 分槽后两个浏览器会话各持一把数据库，Win 下路径大小写归一使 `D:/Repo` 与 `d:/repo` 共享一条目 |
| 持锁 | 抢不到就直接退出 | `O_EXCL` 单持有者 + 死 pid 回收；TTY 下询问 y/N、管道永不阻塞；无 handler 时保持旧的静默 503 | **B**。交互与脚本的代价不同：人在终端里可以决定接管，CI 里多问一句就是挂死。`pid === 自己` 时永不接管，防自我抢占 |
| schema 演进 | 写迁移脚本历史兼容 | `SCHEMA_VERSION` 写进图内 `Meta` 表，版本不符整库擦除重建；`clear()` 用 `CALL show_tables()` 枚举而非硬编码表名 | **B**。图谱是可丢弃缓存，重建成本低于维护迁移矩阵；DDL 变更只需 bump 一个常量（BACK-714 为 Tag 表与知识边表把版本推到 2） |

## 实测反转（计划 vs 落地）

1. **kuzu 单后端 → 双后端默认内存**：doc-14 以 kuzu 为嵌入式数据库设计，实测在 Bun/Windows 下进程内根本加载不了绑定。抽象 + 降级模式救回了整个计划，代价是默认路径没有 Cypher 的多跳能力——这直接决定了 BACK-709 的闭包查询必须走本地语料遍历（[[decisions/local-corpus-closure-over-graph-service]]）。
2. **图谱文件：`backlog/` 内 → OS 缓存槽位**：初版把 `graph.kuzu` 与边车放在项目目录，BACK-704 当天改到缓存目录并按绑定端口/宿主 slot 分家。
3. **SSE → WebSocket**：见上表。
4. **校验清单 vs 惰性检测**：doc-14 §4 要求冷启动后做毫秒级节点/边计数校验；环检测被刻意移出关键路径做成惰性 DFS 查询，`isReady`/`isBlocked` 仍由 `readiness.ts` 单点负责，不在 Cypher 里重实现。

## 任务拆分与实际顺序

`doc-14 §6` 的分期落到 BACK-702（schema + fail-closed 解析 + 指纹冷启动）→ BACK-703（增量重建 + 热更新 + 服务托管）→ BACK-704（D3 页面 + slot 缓存 + 锁接管）→ BACK-713（FileNode 主键 + 自描述版本）→ BACK-714（知识文件入图）。顺序上，只有 713 把主键换成路径后，714 才能在同一张 `FileNode` 表里承载 wiki/decision/document 三类知识节点。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 原生绑定在宿主运行时不可用 | 默认 `MemoryGraphStore`；原生后端显式 opt-in；Node 冒烟覆盖 SQL 形状 |
| "touch 但未改内容"导致误判缓存有效 | 指纹基于内容哈希，size+mtime 只是重算闸门 |
| 空库被当成"可复用命中" | 快速路径额外要求 `nodeCount > 0` |
| 写入未被任何一路探测器看到 | 三层：core notify（一出口全覆盖）+ `Bun.watch` + 5 分钟 stat 对账 |
| 多实例抢同一份图谱文件 | slot 键控 + `O_EXCL` 锁 + 死 pid 回收；宿主决定是否接管 |
| 缓存目录不存在被误读成"锁被持有" | 创建目录先于创建锁；服务端 memoize 启动尝试，避免每次请求重问接管 |
| DDL 变更后旧缓存静默错读 | `SCHEMA_VERSION` + `PARSER_VERSION` 双守卫，不符即整体重建 |
| 解析器或配置变动引发 herd effect | 版本常量单点变更即可触发全重建，无迁移代码 |

## Related Concepts

- [[concepts/kuzu-graph]] — 上述推理落成的事实全景
- [[concepts/task-identity]] — ID 与路径的身份分裂，即 FileNode(path PK) 的动机
- [[concepts/web-server]] — 进程内 Graph Service 与 `graph-updated` 广播宿主
- [[concepts/core-architecture]] — notify 钩子所在的 core 变更层

## Related Sources

- [[sources/doc-14-kuzu-task-graph-cold-start-hot-update-design]] — 冷启动/热更新的设计依据（含 §5 的 kuzu 绑定风险）
- [[sources/m-9-kuzu-task-graph-phase-1]] — Phase 1 范围
- [[sources/back-702-kuzu-graph-foundation]] — 指纹冷启动、fail-closed 解析、双后端抽象
- [[sources/back-703-graph-incremental-sync]] — 增量重建与 notify/watcher/对账三层
- [[sources/back-704-graph-view-web-ui]] — slot 键控缓存、锁接管、D3 视图
- [[sources/back-713-filenode-rename]] — 主键从 `Task(id)` 换成 `FileNode(path PK)`
- [[sources/back-714-knowledge-graph-ingest]] — 知识文件入图与版本推进

## Related Decisions

- [[decisions/memory-graph-store-default-backend]] — 默认后端为何是纯 JS map
- [[decisions/filenode-path-primary-key]] — 路径作主键
- [[decisions/local-corpus-closure-over-graph-service]] — 默认后端没有多跳，闭包查询改走语料

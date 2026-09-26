---
title: Kuzu 任务图谱
labels: [concept, graph, kuzu]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# Kuzu 任务图谱

`src/graph/` 模块在 backlog 语料之上构建依赖图谱，支撑 Web UI 的 `/graph`（任务图谱）与 `/knowledge`（知识图谱）双视图。Markdown 文件是唯一真实来源，图谱是可丢弃的派生缓存。设计见 doc-14（冷启动与热更新）与 doc-15（知识图谱关系），阶段 1 由 m-9 里程碑范围化。

## 数据模型

- **FileNode(path PK)**：节点表以项目相对文件路径为主键（BACK-713 由 `Task(id)` 重命名而来），任务 ID 降级为属性；重命名/移动/完成/归档/升降级折叠为一次同 ID 迁移（删旧路径 + 建新路径 + 重建受影响边）
- **语义边**：`ParentOf` / `BelongsToMilestone` / `DependsOn`（任务层）；知识层（BACK-714，doc-15 阶段 3）新增机械派生边 `TaggedWith`（frontmatter labels → Tag 节点）、`SourcedFrom`（`source_path` 溯源）、`LinksTo`（正文 `[[wikilink]]` 解析，剥离 alias/heading，唯一命中才成边）
- **Fail-closed 解析**：悬空/歧义引用进入 `missingDependencies` / `ambiguousIds` / `invalidRelations` 报告，绝不静默丢弃；节点始终入图
- 节点类型仅由白名单目录决定（`wiki/`、`docs/`、`decisions/`），不从 frontmatter 推断；`wiki/index.md` 与 `wiki/log.md` 扫描时排除

## 后端：MemoryGraphStore 默认

kuzu 0.11.3 原生绑定在 Bun 1.3.14（Windows）下段错误（BACK-702 实测，doc-14 §5 已预警），因此 `GraphStore` 抽象提供双后端：默认纯 JS `MemoryGraphStore`（doc-14 的降级模式），`BACKLOG_GRAPH_BACKEND=kuzu` 可选原生 `KuzuGraphStore`。进程单例按项目根键控。

## 冷启动：指纹校验

- 每文件指纹边车 `graph.kuzu.meta.json`：size+mtime 命中即复用缓存哈希，变化文件才重读；`git checkout` 未改动文件保持缓存温暖
- 聚合指纹 = sha256(PARSER_VERSION + 排序后 relPath|hash)，匹配则零解析直接复用图谱（要求 `nodeCount > 0`）
- `PARSER_VERSION` 混入指纹，解析器/扫描器升级强制重建

## 热更新：core notify + 150ms 防抖

- 可注入的 `FileSystem.onFilesChanged` 钩子沉在 core 变更层（saveTask、drafts、archive/complete、promote/demote、milestone 写入），CLI/TUI/Web/MCP 四个入口零改动全覆盖；编辑器/git 外部改动由 `node:fs` watch 兜底
- 两条路径汇聚到同一 pending Set，150ms 防抖、锁串行化同步；5 分钟 stat 扫描对账为第三层一致性
- 增量引擎按指纹 diff 得出增删改，同 ID 原地更新保留边，删旧节点后批量插入，最后才重建受影响边

## 服务与 API

- `startGraphService(core, {slot, ...})` 是唯一宿主入口；图谱产物存 OS 缓存目录，按 slot 键控（`backlog-graph-<sha256-16>.{kuzu,kuzu.meta.json,kuzu.lock}`），两个浏览器会话互不竞争
- 锁接管协议：`graph.kuzu.lock` O_EXCL 单持有者 + 死 pid 回收；TTY 下询问 y/N，管道从不阻塞；无 handler 时保持旧的静默 503 降级
- `GET /api/graph` 返回 `{status, backend, nodes, edges, reports, nodeCount}`，首次导入期间 `building`，他人持锁时 503；`getPayload` 把路径翻译回任务 ID，前端零改动
- 更新走既有 WebSocket 通道推送 `graph-updated`（非 SSE）；`graphVersion` 线程化到前端组件实现原地重取

## SCHEMA_VERSION 自描述缓存

`SCHEMA_VERSION` 写入图谱自身的 `Meta` 表；`init()` 对版本不符的文件整体擦除重建，`clear()` 通过 `CALL show_tables()` 枚举并先删 REL 再删 NODE（而非硬编码表名）。未来 DDL 变更只需 bump 一个常量，无迁移代码。当前版本 2（Tag 表 + 知识边表），`PARSER_VERSION` 3。

## Web 视图

- `/graph` 任务图谱与 `/knowledge` 知识图谱（BACK-714）读取同一 payload 的两种视图：隐藏 kind 在 force 布局运行前剔除
- `GraphView.tsx`（BACK-704）：选择性 d3 导入、250 tick 预计算布局、**等屏尺寸规则**——所有图空间量（半径、虚线、箭头、标签）除以实时缩放系数 k，从 zoom handler 重应用
- 模态关系图（BACK-710/711）：任务详情 Dependencies 面板切换出以当前任务为根的子图；`GraphLegend.tsx` 为两视图共享的视觉实现（`NODE_FILL`/`EDGE_DASH` 等单一来源）
- 循环检测为惰性 DFS 查询，移出关键路径；`isReady`/`isBlocked` 委托 `readiness.ts`，从不在 Cypher 中重新实现

## Related Concepts

- [[concepts/web-server]] — 进程内 Graph Service 与 `/api/graph` 宿主
- [[concepts/web-ui-features]] — /graph、/knowledge 与模态关系图的 UI 惯例
- [[concepts/wikilink]] — `[[wikilink]]` 解析规则喂给 `LinksTo` 边
- [[concepts/task-identity]] — 路径 PK 与任务 ID 的身份分裂
- [[concepts/task-lifecycle]] — 驱动 notify 钩子的任务变更

## Related Sources

- [[sources/doc-14-kuzu-task-graph-cold-start-hot-update-design]] — 冷启动校验与热更新设计（doc-14）
- [[sources/doc-15-wiki-knowledge-graph-relation-design]] — 知识图谱关系设计（阶段 3）
- [[sources/m-9-kuzu-task-graph-phase-1]] — 阶段 1 里程碑
- [[sources/back-702-kuzu-graph-foundation]] — schema、fail-closed 解析、指纹冷启动
- [[sources/back-703-graph-incremental-sync]] — 增量重建与热更新同步
- [[sources/back-704-graph-view-web-ui]] — D3 图谱页面与 slot 键控缓存/锁接管
- [[sources/back-705-graph-control-cluster-styling]] — 控制簇样式回归
- [[sources/back-710-task-modal-relationship-graph]] — 任务模态框关系图
- [[sources/back-711-modal-graph-alignment]] — 模态图对齐与共享 GraphLegend
- [[sources/back-713-filenode-rename]] — FileNode(path PK) 重命名与自描述版本
- [[sources/back-714-knowledge-graph-ingest]] — wiki/docs/decisions 入图与 /knowledge 视图

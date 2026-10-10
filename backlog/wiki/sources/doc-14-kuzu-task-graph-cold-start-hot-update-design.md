---
title: doc-14 - Kuzu 任务图谱冷启动与热更新设计
labels: [source, graph, kuzu, design]
created_date: 2026-09-26 14:15
updated_date: 2026-10-09 23:30
source_path: backlog/docs/PRDS/kuzu/doc-14 - Kuzu-任务图谱：冷启动校验与热更新设计.md
---

# doc-14 - Kuzu 任务图谱冷启动与热更新设计

设计文档（v1，`KUZU-GRAPH-SYNC.md` 的归档副本）：将 KuzuDB 任务图谱嵌入 Backlog.md——Markdown 文件始终是唯一事实来源，`graph.kuzu` 是可丢弃的派生缓存，由单一长驻 Graph Service 独占持有。第一期覆盖 `tasks/`、`drafts/`、`milestones/`、`completed/`（archive 除外）；第三期（doc-15）加入 wiki/docs/decisions。

设计要点：

- 核心原则：写入方只写 Markdown（永不写数据库）；Kuzu 是单进程嵌入式，因此由唯一 Graph Service 持有 `graph.kuzu`（其他进程走 IPC）；fail-safe 方向永远是全量重建；fail-closed 的关系解析与 `src/utils/readiness.ts` 对齐——悬空依赖 ID 进入 `missingDependencies`，绝不静默丢弃。
- Schema：单张 `FileNode` 表，**以项目相对路径为主键**（而非 `Task(id)`），重命名/移动只需 delete+insert，无身份漂移；三张语义边表 `ParentOf` / `BelongsToMilestone` / `DependsOn`；跨类型父边（任务下的草稿）合法，因为降级保留 `parentTaskId`。
- Schema 版本通过 `Meta` 表一行实现（`SCHEMA_VERSION` 在 `src/graph/store.ts`，改常量即可，无迁移代码）；`CREATE TABLE IF NOT EXISTS` 对过期结构是静默空操作，因此版本不匹配 → 用 `show_tables()` 枚举表、先删 REL 再删 NODE、重建；无版本行即视为过期。
- 冷启动：Merkle 式逐文件指纹边车 `graph.kuzu.meta.json`（size+mtime 复用缓存哈希，变化的文件重读）；快速路径连 gray-matter 解析都跳过；`PARSER_VERSION` 混入指纹，解析器/Schema 变化时强制重建；对 git checkout 友好，因为 git 不改写未变化的文件。
- 增量重建从指纹 diff 推导新增/删除/变更，`DETACH DELETE` 过期节点，批量插入（绝不逐行 await MERGE），所有节点落库后才建边。
- 热更新：一个沉入核心变更层的 `notify(paths)` 钩子覆盖 CLI/TUI/Web/MCP（它们都经由 `core.*` 函数写入）；编辑器/git 回退到 `Bun.watch`；两条路径汇合到同一个去抖（150ms）、锁串行化的同步入口；三层一致性 = notify → watcher → 周期/冷启动对账。
- 特殊迁移：demote/promote 生成新 ID（旧 ID 腾空；核心层清理入站引用，但保留被降级草稿自己的 `dependencies` 和 `parentTaskId`）；任务完成是同 ID 目录移动，被识别为「同 id 迁移」——删除旧节点、加入新节点、同一批内重建边。
- 验证：启动后快速节点/边计数检查、惰性递归 Cypher 查询做环检测、`missingDependencies`/`ambiguousIds` 报告随 `/api/graph` 交付，前端把悬空依赖渲染为灰色虚线；readiness 语义复用 `readiness.ts`，绝不在图查询里重新实现。

## 验证

不适用（设计文档）；阶段计划：第一期 指纹冷启动 + notify/watch 热更新，与 Web UI 同进程；第二期 IPC 加固 + 1 万任务批量导入基准；第三期（已完成）按 doc-15 接入 wiki/decisions/docs，`schemaVersion` 2。

## 更新记录（2026-10-03 同步源文档）

- 源文档已从 `backlog/docs/BRDS/` 移至 `backlog/docs/PRDS/kuzu/`（本页 `source_path` 已修正）；内容保持为根目录 `KUZU-GRAPH-SYNC.md` 的归档副本。
- Schema 版本历史补全：`schemaVersion` 1 = BACK-713 把节点表从 `Task(id)` 改名为 `FileNode(path)` 之后的形状；2 = 三期新增 `Tag` 与三条知识关系边表（当前）。`SCHEMA_VERSION` 常量在 `src/graph/store.ts`，改 DDL 只升常量、不写迁移代码。
- 版本比对验证方式：用 `bun build src/graph/store.ts --target=node --external kuzu` 转译后以 Node 驱动真实 store（Bun 载入 kuzu 原生绑定会崩），覆盖改名前文件被清、当前版本数据不丢、高版本文件重建、全新文件盖章四种输入。
- `PARSER_VERSION`（`src/graph/fingerprint.ts`，管文件解析形状）与 `SCHEMA_VERSION`（管图 DDL 形状）分工互不替代，两者都会触发重建。

## Related Concepts

- [[concepts/core-architecture]] — 核心变更层是全部四个入口面共用的唯一 notify 挂点
- [[concepts/task-identity]] — 路径主键与任务 ID 的身份分裂、歧义 ID 的 fail-closed 处理
- [[concepts/task-lifecycle]] — 图谱镜像的 demote/promote/complete 语义（腾空 ID、引用清理）
- [[concepts/web-server]] — Web UI 与 Graph Service 同进程驻留，接收 `graphChanged` 广播

## Related Sources

- [[sources/doc-15-wiki-knowledge-graph-relation-design]] — 第三期扩展：新增知识文件、Tag 节点与三张机械边表
- [[sources/m-9-kuzu-task-graph-phase-1]] — 该设计第一期交付的里程碑范围

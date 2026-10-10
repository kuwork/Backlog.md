---
title: BACK-713 - 图谱节点表 Task(id) 改名 FileNode(path 主键)
labels: [source, graph, kuzu, refactor]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-713 - Rename-graph-node-table-Taskid-to-FileNodepath-PK.md
---

# BACK-713 - 图谱节点表 Task(id) 改名 FileNode(path 主键)

按 doc-014 §1.2 的设计变更：图谱节点表变为 `FileNode(path PRIMARY KEY, id, type, title, status, updatedDate)`，文件路径成为唯一节点标识，任务 ID 降级为属性——文件移动/改名/归档收敛为一次同 id 迁移操作。

## 实现要点

- schema：`FileNode` 以 path 为主键；REL 表绑定 FileNode 端点；`GraphNode.kind` → `type` 外加 `updatedDate`；删除无用的 `updateNodes`/`deleteNodesByFilePath`；每个 CRUD 调用与边端点都是文件路径
- 两阶段导入：先把一切解析出来构建 id→path map，然后按路径创建节点、把 ID 引用翻译为边（fail-closed 报告保留）；同 id 迁移（rename、complete、demote、promote、archive）= 删旧路径 + 建新路径 + 重建受影响边
- 自描述 schema 版本化：`SCHEMA_VERSION` 写入图谱自己的 `Meta` 表；`init()` 发现其他版本就擦除重建，`clear()` 通过 `CALL show_tables()` 找到并丢弃表（先 rel 表——节点表被引用时无法删除）而不是按名列举——未来任何 DDL 变更只是一次常量 bump，无迁移代码、无退休表名清单
- Kuzu 0.11.3 行为实测而非假设：`CREATE TABLE IF NOT EXISTS` 在过期文件上静默 no-op（导致 rel 表仍绑定旧端点），向这样的表 `COPY` 不抛错，对缺失 Meta 表 `MATCH` 抛 Binder 异常（因此读取要 try 住）
- 外部 API 不变：`getPayload` 把路径翻译回任务 id，因此 `/api/graph` 与 web 图谱视图前端零改动；`PARSER_VERSION` 升到 2 使现有缓存重建
- 通过为 Node 编译 `store.ts` 并驱动真实 store 验证（Bun 无法加载该绑定）：旧版本文件被擦除重建为 FileNode、当前版本文件原样复用、更高版本文件被擦除、新文件盖章；graph-foundation 30 通过，graph-sync 19 通过
- 已知缺口：`KuzuGraphStore` 仍无自动化测试——绑定在 Bun 内无法加载，测试需要真实 node 二进制

## 验收标准

- FileNode DDL 以 path 为主键；边经 id→path map 翻译引用；fail-closed 报告保留
- demote/promote/archive/rename 的同 id 迁移有回归测试覆盖
- `/api/graph` 与 web 视图不变；PARSER_VERSION 升级重建旧缓存

## Related Concepts

- [[concepts/task-identity]] — 本重构在图谱内了断的 id 与 path 标识之分

## Related Sources

- [[sources/back-702-kuzu-graph-foundation]] — 被改名的原始 Task(id) schema（同一批）
- [[sources/back-703-graph-incremental-sync]] — 适配按路径键迁移的增量引擎（同一批）
- [[sources/back-714-knowledge-graph-ingest]] — 建于 FileNode schema 之上的第 3 阶段导入（同一批）

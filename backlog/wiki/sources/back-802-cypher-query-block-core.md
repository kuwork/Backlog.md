---
title: BACK-802 - cypher-query 块核心：解析 / 路由 / 文本视图 / QueryBlock 泛化
labels: [source, web-ui, cypher, graph]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-802 - cypher-query-block-core-parsing-server-route-text-views-QueryBlock-generalization.md
---

# BACK-802 - cypher-query 块核心：解析 / 路由 / 文本视图 / QueryBlock 泛化

**状态**: Done | **里程碑**: m-15 | **负责人**: @kimi

打通 `cypher-query` 的最小闭环：块解析、服务端查询路由、`table`/`list`/`value` 文本三视图，并把 `SqlQueryBlock` 泛化为三个引擎共享的 `QueryBlock`。图视图、`refresh: auto`、`style` 字段留给后续任务。

## 关键实现

- **解析**：新增 `src/graph/block.ts`（`parseCypherQueryBlock`，语句字段 `query`）；`src/sqlite/block.ts` 的 `parseQueryBlock` 把语句字段名参数化（SQL 仍为 `sql`，错误消息逐字节不变）。
- **路由**：新增 `POST /api/graph/cypher-query`（而非复用 `db-cypher`——响应形状与 SQL 块不同形）与 `POST /api/graph/export-csv`（严格两键 `{source, query}`）。`source` 校验 = 必须命中 `registry.json` 的注册名，一切路径形态写法拒绝。
- **类型强制**：新增 `src/graph/coerce.ts`，node 剥掉 `_id/_src/_dst` 后序列化为 JSON、relationship 变 `(src)-[TYPE]->(dst)`、path 为节点关系交替紧凑串（doc-27 §5.4）。
- **共享内核**：`QueryEngineConfig` 扩 `parse` 与 `actions.pagination` 扩展点；`SqliteQueryBlock` / `DuckdbQueryBlock` 退化为薄壳，27 个既有 SQL 测试一字未改通过。
- **行数上限**：无新增常量，走 `queryMaxRows`（默认 500、硬顶 5000），缺省回退 `DEFAULT_CYPHER_ROW_CAP`；Cypher 不做分页（PRD §5.3）。

## 遗留（记录给后续任务）

`loadRyu` 首次并发调用的模块缓存竞态（既有问题）；解析器 `source` 报错文案在 Cypher 块下仍说 "path"。

## Related Concepts

- [[concepts/cypher-live-query-block]] — 本任务建立的块模型与共享内核
- [[concepts/sql-query-blocks]] — 被泛化的 SQL 块与「逐字节不变」验收约束

## Related Sources

- [[sources/doc-27-cypher-live-query-prd]] — 设计依据（§0~6）
- [[sources/m-15-cypher-live-query]] — 所属里程碑
- [[sources/back-803-cypher-query-graph-view]] — 后继：图视图
- [[sources/back-804-cypher-query-refresh-auto]] — 后继：实时刷新

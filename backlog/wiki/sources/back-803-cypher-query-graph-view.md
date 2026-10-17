---
title: BACK-803 - cypher-query 图视图与图例配置集成
labels: [source, web-ui, cypher, graph]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-803 - cypher-query-graph-view-with-legend-config-integration.md
---

# BACK-803 - cypher-query 图视图与图例配置集成

**状态**: Done | **里程碑**: m-15 | **依赖**: BACK-802

`cypher-query` 的差异化视图：`view: graph` 把 node/relationship 结果渲染为力导向图，并按 `source` 库名读 Databases 页同一份图例配置（BACK-794），节点配色与关系线型自动一致。

## 关键实现

- **僅 Cypher 可用**：`parseQueryBlock` 第三参数 `views`——SQL 块仍拒绝 `graph`（有测试锁定）。
- **双数据通道**：同一个 `POST /api/graph/cypher-query`，请求带 `view=graph` 时同时返回强制后的 `rows`（供降级用）与保留 `_id/_src/_dst` 的 `graphRows`；文本视图不传 `view`，响应与 BACK-802 契约逐字节一致。
- **图例**：`CypherResultGraph` 以 `database={source}` 读 `backlog.graph.<source>.legend`，齿轮面板既改即生效；**不新增图例 UI、不引入跨组件广播**。
- **节点上限**：复用 `CypherResultGraph` 导出的 `GRAPH_NODE_LIMIT`（3000），超限降级为强制后的表格并给出四语种提示。

## 过程中的意外

实施期间工作区被外部 stash 两次（`back802-wip` / `back802-wip2`），成果从游离提交 `a92ca689` 找回，另有补丁备份在 `tmp/back-803-backup.patch`。

## Related Concepts

- [[concepts/cypher-live-query-block]] — 图视图与共享内核的扩展点（graph.fromResult / render / nodeLimit）
- [[concepts/graph-legend-persistence]] — 本任务依赖的 localStorage 版图例，后被持久化改造

## Related Sources

- [[sources/back-802-cypher-query-block-core]] — 前置：块核心
- [[sources/back-794-cypher-graph-configurable-legend]] — 被复用的图例系统
- [[sources/back-793-cypher-result-graph-view]] — 图组件的来源（Databases 页）

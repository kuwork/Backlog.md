---
title: BACK-785 - graph_schema MCP 工具
labels: [source, mcp, graph]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-785 - Add-graph_schema-MCP-tool.md
---

# BACK-785 - graph_schema MCP 工具

m-14 的第二个 graph MCP 工具：打印指定数据库的 schema——每个节点表及其属性（名称、类型、主键）与每个关系表及其源/目标端点。复用 CLI `graph schema` 已有的内省（ryu `show_tables` / `table_info`），标注 `readOnlyHint: true`。未知数据库返回清晰错误。

## 目标

- `graph_schema`（`db` 必填）返回 `default` 派生图谱或指定用户数据库的节点表 + 属性与关系表 + 端点；
- 查询不存在的数据库返回清晰错误。

## 实现要点

**方案偏离**：计划与描述说经长驻 `GraphService` 内省；按 [[sources/back-784-graph-mcp-foundation|BACK-784]] 的基础决策，改为复用共享一次性访问层 `src/mcp/tools/graph/graph-access.ts` 新增的 `schemaDatabase(rootDir, db)`——打开 store、prepare（reconcile 派生语料图谱或从快照 hydrate 用户库）、运行 `readSnapshotSchema`、关闭，与 `backlog graph schema` 每次调用的行为完全一致，且避免 MCP 进程内二次持久打开 ryu 数据库。

其他改动：`schemas.ts` 新增 `graphSchemaSchema`（`db` 必填，`additionalProperties: false`）；`handlers.ts` 新增 `schemaGraph(args)` 与 `GraphSchemaArgs` 类型，返回 `JSON.stringify(schema)` 文本；`index.ts` 以 `readOnlyHint: true, destructiveHint: false` 注册。两处修正：`openDatabaseReadonly` / `withUserDatabaseWrite` 抛出的 `resolveDatabase` 错误包装为 `BacklogToolError`（`RESOURCE_NOT_FOUND`），让未知数据库透出清晰的"不存在"信息而非笼统的 "An unexpected error occurred"；返回类型修正为 `Awaited<ReturnType<typeof readSnapshotSchema>>`（计划中的 `GraphSchema` 名字在 `snapshot.ts` 不存在，真实形态是内联 `{ nodeTables, relTables }`）。

## 验证

`src/test/mcp-graph.test.ts` 新增 4 个用例（注册、default schema 形态、具名用户库 schema、未知库清晰错误），套件 8/8 通过；tsc/biome 干净。

## Related Concepts
- [[concepts/kuzu-graph]] — 节点表/关系表的图模型
- [[concepts/mcp-server]] — MCP 工具注册与错误包装

## Related Sources
- [[sources/back-784-graph-mcp-foundation]] — 一次性访问层与 graph_query（本工具的地基）
- [[sources/back-786-graph-list-databases-mcp-tool]] — graph_list_databases
- [[sources/back-787-graph-describe-database-mcp-tool]] — graph_describe_database
- [[sources/back-788-graph-create-database-mcp-tool]] — graph_create_database
- [[sources/back-789-graph-import-csv-mcp-tool]] — graph_import_csv
- [[sources/back-790-mcp-graph-usage-guide]] — 六个 graph MCP 工具的使用指南

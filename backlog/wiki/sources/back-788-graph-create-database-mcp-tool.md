---
title: BACK-788 - graph_create_database MCP 工具
labels: [source, mcp, graph]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-788 - Add-graph_create_database-MCP-tool.md
---

# BACK-788 - graph_create_database MCP 工具

m-14 的第五个 graph MCP 工具，也是 graph 工具集里的**首个写操作**：按名称与描述创建用户数据库，标注 `destructiveHint: true`，并要求调用方显式确认。

## 目标

- 创建用户数据库文件并在 databases 注册表登记；
- 重名或非法名字返回清晰错误且无副作用；
- 工具标注 `destructiveHint: true`。

## 实现要点

委托 `src/graph/databases.ts` 的 `createDatabase()`（计划里称 `createUserDatabase`，实际导出名是 `createDatabase`），写出用户数据库文件并追加注册表条目。由于调用会改变磁盘状态，handler 先校验必填参数并要求 `acknowledged === true`，**先于任何写操作**——缺确认时抛出 `VALIDATION_ERROR` 且不触碰任何内容。`createDatabase` 抛出的错误（重名或非法名）包装为 `BacklogToolError`（`RESOURCE_CONFLICT`），让清晰信息（重名报"已存在"）透传给 agent 而非被通用错误包装吞掉。先校验后写入的顺序保证任一检查失败都不会留下部分状态。`schemas.ts` 新增 `graphCreateDatabaseSchema`（`name`、`description`、`acknowledged` 均必填）；`index.ts` 以 `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false` 注册。

## 验证

`src/test/mcp-graph.test.ts` 新增 5 个用例（注册、确认后创建成功、无确认拒绝、重名"已存在"、非法名错误），套件 18/18 通过；tsc/biome 干净。

## Related Concepts
- [[concepts/kuzu-graph]] — 用户数据库与注册表
- [[concepts/mcp-server]] — MCP 工具注册与错误包装

## Related Sources
- [[sources/back-784-graph-mcp-foundation]] — 一次性访问层与 graph_query（本工具的地基）
- [[sources/back-785-graph-schema-mcp-tool]] — graph_schema
- [[sources/back-786-graph-list-databases-mcp-tool]] — graph_list_databases
- [[sources/back-787-graph-describe-database-mcp-tool]] — graph_describe_database
- [[sources/back-789-graph-import-csv-mcp-tool]] — graph_import_csv（第二个写工具，向所建库导入数据）
- [[sources/back-790-mcp-graph-usage-guide]] — 六个 graph MCP 工具的使用指南

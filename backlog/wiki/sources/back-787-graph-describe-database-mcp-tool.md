---
title: BACK-787 - graph_describe_database MCP 工具
labels: [source, mcp, graph]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-787 - Add-graph_describe_database-MCP-tool.md
---

# BACK-787 - graph_describe_database MCP 工具

m-14 的第四个 graph MCP 工具：返回单个具名数据库的详情——描述、时间戳与逐表行/边计数——标注 `readOnlyHint: true`。

## 目标

- `graph_describe_database`（`db` 必填）返回所请求数据库的 kind、description、创建/更新时间戳与节点/边计数；
- 查询不存在的数据库返回清晰错误。

## 实现要点

复用 `src/graph/browser.ts` 的 `describeDatabases()`（与 `graph_list_databases` 同一 helper），按名字选出所请求的单个数据库，保持数据库元数据单一事实来源，不引入第二条逐库描述路径。`schemas.ts` 新增 `graphDescribeDatabaseSchema`（`db` 必填，`additionalProperties: false`）；`handlers.ts` 新增 `GraphDescribeDatabaseArgs` 与 `describeDatabase` 方法，详情以 JSON 文本返回；未知名字抛出 `BacklogToolError`（`RESOURCE_NOT_FOUND`），错误信息列出可用数据库且含"不存在"。`index.ts` 以 `readOnlyHint: true, destructiveHint: false` 注册。

## 验证

`src/test/mcp-graph.test.ts` 新增 3 个用例（注册、描述 `default` 的 kind/description/nodes/edges、未知库清晰错误），套件 13/13 通过；tsc/biome 干净。

## Related Concepts
- [[concepts/kuzu-graph]] — default 派生图谱与用户数据库
- [[concepts/mcp-server]] — MCP 工具注册与错误包装

## Related Sources
- [[sources/back-784-graph-mcp-foundation]] — 一次性访问层与 graph_query（本工具的地基）
- [[sources/back-785-graph-schema-mcp-tool]] — graph_schema
- [[sources/back-786-graph-list-databases-mcp-tool]] — graph_list_databases（同一 `describeDatabases()` 的列表形态）
- [[sources/back-788-graph-create-database-mcp-tool]] — graph_create_database
- [[sources/back-789-graph-import-csv-mcp-tool]] — graph_import_csv
- [[sources/back-790-mcp-graph-usage-guide]] — 六个 graph MCP 工具的使用指南

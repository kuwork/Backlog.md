---
title: BACK-786 - graph_list_databases MCP 工具
labels: [source, mcp, graph]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-786 - Add-graph_list_databases-MCP-tool.md
---

# BACK-786 - graph_list_databases MCP 工具

m-14 的第三个 graph MCP 工具：列出可用数据库——`default` 派生图谱加全部用户数据库——附名称、kind、规模等元数据，标注 `readOnlyHint: true`。

## 目标

- 无必填参数，返回 `default` 与所有用户数据库及其元数据（name、kind、节点/边计数）。

## 实现要点

复用 `src/graph/browser.ts` 的既有 `describeDatabases()` helper：经 `listDatabases()` 列出每个数据库，并为用户数据库附上快照行/边计数（`snapshotStats`）；派生的 `default` 图谱计数为 null（其数据在图谱服务内存中，不在快照文件）。`schemas.ts` 新增 `graphListDatabasesSchema`（空对象 schema，`additionalProperties: false`）；`handlers.ts` 新增 `GraphListDatabasesArgs`（`Record<string, never>`）与 `listDatabases` 方法，结果以 JSON 文本返回；`index.ts` 以 `readOnlyHint: true, destructiveHint: false` 注册。

## 验证

`src/test/mcp-graph.test.ts` 新增 2 个用例（工具列表注册可见；列出 `default` 与一个新建用户库并校验 `kind` 与数值型 `nodes`/`edges`），套件 10/10 通过；tsc/biome 干净。

## Related Concepts
- [[concepts/kuzu-graph]] — default 派生图谱与用户数据库
- [[concepts/mcp-server]] — MCP 工具注册体系

## Related Sources
- [[sources/back-784-graph-mcp-foundation]] — 一次性访问层与 graph_query（本工具的地基）
- [[sources/back-785-graph-schema-mcp-tool]] — graph_schema
- [[sources/back-787-graph-describe-database-mcp-tool]] — graph_describe_database（同一 `describeDatabases()` 的单库形态）
- [[sources/back-788-graph-create-database-mcp-tool]] — graph_create_database
- [[sources/back-789-graph-import-csv-mcp-tool]] — graph_import_csv
- [[sources/back-790-mcp-graph-usage-guide]] — 六个 graph MCP 工具的使用指南

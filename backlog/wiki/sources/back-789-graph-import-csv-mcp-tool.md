---
title: BACK-789 - graph_import_csv MCP 工具
labels: [source, mcp, graph]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-789 - Add-graph_import_csv-MCP-tool.md
---

# BACK-789 - graph_import_csv MCP 工具

m-14 的第六个 graph MCP 工具，第二个写操作：把 CSV 文件的行导入用户数据库，镜像 CLI 的 `backlog graph import`，标注 `destructiveHint: true`。

## 目标

- 节点 CSV 导入：`node` / `header` / `map` 列映射；
- 关系 CSV 导入：`rel` / `from` / `to` 端点匹配；
- 类型推断与畸形输入的清晰报错。

## 实现要点

调用方传 `db` + `csv`（外加可选 `node`、`map`、`header`）；同时给出 `rel` 与 `from`/`to` 即从节点导入切换为边导入。文件先用 `readCsvFile()` 完整读取并校验，**然后** `withUserDatabaseWrite()` 才打开 store——畸形文件（列数不齐、值超出列类型、引号未闭合）报精确的行列号且数据库原样不动。节点导入走 `importCsvTable`（表缺失时按推断类型建表；重复导入按主键更新行，幂等）；关系导入走 `importCsvRelations`（端点键只匹配不创建，未配成边的行计入 skipped）。MCP 侧输入按 `graphImportCsvSchema` 校验；`map` 在 JSON schema 中不声明 `type`（共享校验器没有 object 类型），在 handler 内归一化（拒绝非 `{ header: property }` 的字符串对象）。错误分层：CSV 错误为 `VALIDATION_ERROR`，写阶段失败为 `OPERATION_FAILED`，未知数据库为 `RESOURCE_NOT_FOUND`（来自共享访问层）；只读的 `default` 库被 `withUserDatabaseWrite` 拒绝。相对路径 `csv` 相对项目根解析，而非 MCP 进程的 cwd。`index.ts` 以 `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false` 注册。

## 验证

`src/test/mcp-graph.test.ts` 新增 5 个用例（注册；节点导入建表与推断类型；关系导入在既有节点间建边；畸形 CSV 清晰报错；拒绝写入只读 `default`），套件 23/23 通过；tsc/biome 干净。

## Related Concepts
- [[concepts/kuzu-graph]] — 用户数据库与快照写回
- [[concepts/mcp-server]] — MCP 工具注册与错误包装

## Related Sources
- [[sources/back-784-graph-mcp-foundation]] — 一次性访问层与 `withUserDatabaseWrite`（本工具的地基）
- [[sources/back-785-graph-schema-mcp-tool]] — graph_schema
- [[sources/back-786-graph-list-databases-mcp-tool]] — graph_list_databases
- [[sources/back-787-graph-describe-database-mcp-tool]] — graph_describe_database
- [[sources/back-788-graph-create-database-mcp-tool]] — graph_create_database（先建库再导入）
- [[sources/back-790-mcp-graph-usage-guide]] — 六个 graph MCP 工具的使用指南

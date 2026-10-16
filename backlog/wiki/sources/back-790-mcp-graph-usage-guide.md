---
title: BACK-790 - MCP graph 使用指南
labels: [source, mcp, graph, docs]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-790 - Add-MCP-graph-usage-guide-mirroring-the-CLI-graph-guide.md
---

# BACK-790 - MCP graph 使用指南

m-14 的收尾文档任务：MCP 指南集（`src/guidelines/mcp/`）覆盖了 graph 之外的每个工具族，六个 graph MCP 工具（graph_query / graph_schema / graph_list_databases / graph_describe_database / graph_create_database / graph_import_csv）的代理用户无指南可读。本任务以 CLI 图谱指南 `src/guidelines/cli-instructions/graph.md` 为蓝本补齐 MCP 对应版本，并接入共享指南注册表，使 `backlog instructions graph` 与 `get_backlog_instructions` 均能取到。

## 问题

1. 六个 graph MCP 工具没有任何 MCP 侧使用指南；
2. 既有 CLI graph 指南是孤儿文件——存在但从未被 `cli-instructions/index.ts` 导入，`backlog instructions graph` 失败报 "Unknown instruction guide: graph"。

## 解决方案

新增 `src/guidelines/mcp/graph.md`：面向 MCP 的六工具指南，仿照 CLI 指南并参照 `src/guidelines/mcp/documents.md` 的结构（工具表、JSON 参数、read-only vs destructive 标注、default vs 用户数据库、Cypher 查询模式、CSV 按节点/边导入）。接线遵循 documents 指南模式：从 `src/guidelines/mcp/index.ts` 导出 `MCP_GRAPH_GUIDE`、从 `src/guidelines/cli-instructions/index.ts` 导出 `CLI_GRAPH_GUIDE`（顺带把孤儿 CLI graph.md 接回）；在 `src/mcp/workflow-guides.ts` 把 `"graph"` 加入 `WORKFLOW_GUIDE_KEYS`、新增 `backlog://workflow/graph` 的 `WORKFLOW_GUIDES` 条目、并在 `CLI_INSTRUCTION_TEXT_BY_KEY` 映射 `graph -> CLI_GRAPH_GUIDE`。指南 key 是共享的，加一次即在 MCP 指令枚举、MCP 资源列表、CLI 指南索引与 `backlog instructions graph` 四处同时可见；`CLI_INSTRUCTION_TEXT_BY_KEY` 是 `Record<WorkflowGuideKey, string>`，加 key 后映射由类型强制补齐。指南同时登记进 MCP overview 列表（`src/guidelines/mcp/overview.md`）。

顺带修复：`src/test/mcp-server.test.ts` 的 "createMcpServer wires stdio-ready instance" 全量工具列表断言自 [[sources/back-784-graph-mcp-foundation|BACK-784]] 注册六个 graph 工具起就一直是红的（本任务之前未更新），此处按注册顺序补上六个工具名。

## 验证

tsc/biome 干净；`src/test/mcp-server.test.ts` 12 通过 0 失败；`src/test/cli.test.ts` 两个受 graph 影响的用例单独运行通过；实测 `backlog instructions --list` 含 graph、`backlog instructions graph` 正常打印指南（此前报 "Unknown instruction guide: graph"）。已知预存问题（非本任务引入）：整个 "backlog instructions command" describe 块连跑会触发测试隔离问题（task-prefix 用例的配置泄漏到下一用例）产生 2 个失败；在干净树上 stash 本任务改动后同样复现，属环境问题。

## Related Concepts
- [[concepts/cli-instructions]] — `backlog instructions` 共享指南注册表
- [[concepts/mcp-workflow]] — MCP 工作流与代理集成
- [[concepts/kuzu-graph]] — 图谱数据模型背景

## Related Sources
- [[sources/back-784-graph-mcp-foundation]] — graph_query 与访问层地基
- [[sources/back-785-graph-schema-mcp-tool]] — graph_schema
- [[sources/back-786-graph-list-databases-mcp-tool]] — graph_list_databases
- [[sources/back-787-graph-describe-database-mcp-tool]] — graph_describe_database
- [[sources/back-788-graph-create-database-mcp-tool]] — graph_create_database
- [[sources/back-789-graph-import-csv-mcp-tool]] — graph_import_csv
- [[sources/back-521.1]] — 共享工作流指令注册表的最初落地

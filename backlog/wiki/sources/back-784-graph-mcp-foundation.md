---
title: BACK-784 - Graph MCP 基础与 graph_query 工具
labels: [source, mcp, graph]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-784 - Add-Graph-MCP-tooling-foundation-and-graph-query-tool.md
---

# BACK-784 - Graph MCP 基础与 graph_query 工具

里程碑 m-14（Graph MCP）的地基任务：建立 Graph MCP 工具域，让 AI 代理通过 MCP server 查询 Backlog.md 知识图谱，镜像 m-13 交付的 CLI `graph` 子命令。遵循 `src/mcp/tools/milestones` 三文件模式与 `createSimpleValidatedTool` 包装，创建 `src/mcp/tools/graph/{index.ts, handlers.ts, schemas.ts}` 并在 `src/mcp/server.ts` 注册 `registerGraphTools`。本任务交付首个工具 `graph_query`。

## 目标

- `graph_query` 接收 `db`（必填，`"default"` 或用户数据库名）与可选 Cypher `statement`，返回节点/边结果行，标注 `readOnlyHint: true`；
- 只读强制：写关键字（CREATE/MERGE/SET/DELETE/DROP/INSERT/UPDATE）以清晰的 `VALIDATION_ERROR` 拒绝，永不执行；
- 输入经 Zod schema 校验（`db` 必填、`statement` 可选）。

## 实现要点

**方案偏离（相对原计划，已记录备查）**：原计划让 `GraphHandlers` 惰性复用长驻单例 `GraphService`，实际改为基于 **CLI 的一次性模型**（每次调用 `open → prepare → query → close`），落在新的 `src/mcp/tools/graph/graph-access.ts`。理由：

- CLI 的 `withGraphDatabase` 正是这套流程且是 m-13 的参考实现，镜像它使 MCP 与 CLI 路径行为一致；
- MCP 进程内驻留 `GraphService` 会在启动时重建整个语料（即便只用用户库工具），且写工具运行时存在同一 ryu 数据库被二次打开的风险；一次性 helper 规避了所有跨调用的 store/锁争用；
- `default` 仍走同一派生图谱：`reconcileGraphStoreOnce(rootDir, store, graphPaths(rootDir, DEFAULT_SLOT), { reuseSnapshot: true })` 复用 Web UI `GraphService` 写出的快照，结果与 UI 保持一致。

文件分工：`graph-access.ts` 提供 `openDatabaseReadonly`（reconcile 派生 / hydrate 用户库）、`queryDatabase`、`withUserDatabaseWrite`（hydrate → fn → `dumpDatabase`+`saveSnapshot`+`recordSnapshot`）与 `isWriteStatement` 守卫（改自 `src/cli.ts` 的 `withGraphDatabase`，去掉 CLI 专属的 `process.exitCode`/`requireProjectRoot`）；三文件工具模块镜像 `milestones`；`registerGraphTools(server)` 接入 `src/mcp/server.ts` 的**两个**注册点（`upgradeToProject` 与 `createMcpServer`），fallback 升级与正常模式均可用。

**测试配置附注**：图谱测试加载 ryu WASM 后端并重建派生语料，超过 bun 默认 hook 超时；`bunfig.toml` 的 `[test] timeout` 提到 `30000`，`package.json` 的 `test` 脚本改为 `bun test --timeout 30000`（该 bun 版本不认 bunfig 的 `[test] timeout`，脚本标志才是生效杠杆）。

## 验证

`bunx tsc --noEmit` 干净；`src/test/mcp-graph.test.ts` 4/4 通过（注册可见性、default 查询返回行、写关键字拒绝、labels 概览）。

## Related Concepts
- [[concepts/kuzu-graph]] — 派生语料图谱与用户数据库模型
- [[concepts/mcp-server]] — MCP server 工具注册体系

## Related Sources
- [[sources/back-785-graph-schema-mcp-tool]] — graph_schema：库结构内省工具
- [[sources/back-786-graph-list-databases-mcp-tool]] — graph_list_databases：列出全部数据库
- [[sources/back-787-graph-describe-database-mcp-tool]] — graph_describe_database：单库详情
- [[sources/back-788-graph-create-database-mcp-tool]] — graph_create_database：首个写工具
- [[sources/back-789-graph-import-csv-mcp-tool]] — graph_import_csv：CSV 导入写工具
- [[sources/back-790-mcp-graph-usage-guide]] — 六个 graph MCP 工具的使用指南
- [[sources/back-740-memo-mcp-tools]] — memo MCP 五工具组（工具域划分先例）

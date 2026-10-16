---
title: BACK-778 - duckdb-query 代码块渲染实时结果
labels: [source, duckdb, web-ui, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-778 - Make-duckdb-query-code-blocks-render-live-results.md
---

# BACK-778 - duckdb-query 代码块渲染实时结果

m-12 第二个任务（镜像 BACK-773），让 `duckdb-query` 围栏代码块端到端可用。做法是**通用化**而非复制：SQLite 的 YAML 子集解析器改为引擎无关，`SqliteQueryBlock` 重构为通用 `SqlQueryBlock`（按引擎配置参数化），`SqliteQueryBlock` 保留为薄包装使 m-11 表面逐字节不变；只读校验、Markdown/CSV 序列化与四道 containment 闸门全部复用，新建的只有 `src/duckdb/` 引擎模块与接线。

## 目标

通用块解析器对 `duckdb-query` 语言接受 `source` / `sql` / `view` / `refresh`；只读校验直接复用 `src/sqlite/validation.ts`（引擎无关），不建新校验文件；`source` 项目相对、四道 fail-closed 闸门同 SQLite，差异仅在扩展名白名单（`.duckdb`）与 DuckDB 存储头检查；`POST /api/duckdb/query` 返回与 SQLite 相同的 `{ columns, rows, truncated, elapsedMs, dbPath }` 形状（共享类型/UI 因此成立），失败 400 中文原因；`GET /api/duckdb/files` 列项目 `.duckdb` 文件（30s 缓存）；通用 `SqlQueryBlock` 渲染 table/list/value + loading/error/empty/truncated + Refresh。

## 实现要点

- 共享核心 + 每引擎薄包装：`src/sqlite/block.ts` 的解析器改为引擎无关 `parseQueryBlock`（返回 `QueryBlock`/`QueryBlockParse`），`parseSqliteQueryBlock` / `parseDuckdbQueryBlock` 是别名；`DUCKDB_BLOCK_LANG = "duckdb-query"`。`src/web/components/SqlQueryBlock.tsx` 是共享渲染核心，按 `QueryEngineConfig = { id, dict, run, exportCsv, actions }` 参数化；`SqliteQueryBlock` / `DuckdbQueryBlock` 只提供文案、端点和哪些动作按钮启用。
- **三个动作按钮按里程碑门控**：`DuckdbQueryBlock` 起始 `actions: { showHide: false, copy: false, export: false }`，由 BACK-779 / 780 / 781 逐个打开；SQLite 三个全 true，m-11 表面逐字节不变。
- `src/duckdb/query.ts`：`{ access_mode: "READ_ONLY" }` 打开实例，**每查询一开一关**（无空闲句柄缓存——DuckDB 的连接模型让缓存比偶尔重开更麻烦）；`toCell` 用 BACK-777 的映射按包装形态分派（BIGINT→string、DECIMAL→定点小数字符串、TIMESTAMP→ISO、DATE→ISO 日期、BLOB→`<blob N 字节>`），对 `@duckdb/node-api` 1.5.6 实测；500 行上限 + 5000 绝对天花板对齐 SQLite。
- `src/duckdb/paths.ts`：四道闸门复用自 `src/sqlite/paths.ts`（`isNonRelativeSource`、`segmentsInsideProject` 现已导出共享），仅扩展名白名单与 magic 检查不同；`hasDuckdbMagic` 读字节偏移 8 处的 `DUCK` 签名（已核实：DuckDB 前 8 字节是版本/校验和头）。
- `validation.ts`、`markdown.ts`、`csv.ts` 原样复用——DuckDB 的 `toCell` 产出的正是它们消费的 `SqliteCell` 联合。
- 接线：服务端 `/api/duckdb/{files,query,export-csv}` 镜像 SQLite 路由，`handleDuckdbQuery` / `handleDuckdbExportCsv` `await` 异步 DuckDB 调用；apiClient 加 `runDuckdbQuery` / `fetchDuckdbFiles` / `exportDuckdbCsv`，结构复用 `SqliteQueryResult` / `SqliteCsvExport` 形状；`MermaidMarkdown.tsx` 的 `PreBlock` 按围栏语言分发；四语言 `duckdbQueryBlock` 命名空间镜像 `sqliteQueryBlock`。

## 验证

新增 `src/test/duckdb.test.ts`（解析、闸门、强制转换、截断、只读拒绝、CSV、发现）与 `src/test/duckdb-query-block.test.tsx`（基础渲染 + 显式"动作按钮未启用前缺席"断言），duckdb 套件 19 个测试加 sqlite 套件全绿；`bunx tsc --noEmit` 与 `bun run check .` 干净。全量 `bun test` 本次未完成（一个无关的既存测试挂起），故只断言 scoped 回归通过。

## Related Concepts

- [[concepts/web-ui-features]] — 浏览器阅读视图的 Markdown 渲染面（查询块类型经通用组件扩展）

## Related Sources

- [[sources/back-777-duckdb-node-api-bun-spike]] — 前置 spike：绑定选型与 toCell 强制映射来源
- [[sources/back-773-sqlite-query-live-blocks]] — SQLite 侧镜像任务（被本任务通用化的原实现）
- [[sources/back-779-duckdb-query-show-hide-toggle]] — 后继：打开 showHide 动作
- [[sources/back-780-duckdb-copy-markdown]] — 后继：打开 copy 动作
- [[sources/back-781-duckdb-export-csv]] — 后继：打开 export 动作
- [[sources/m-12-duckdb-explorer]] — 所属里程碑 DuckDB Explorer
- [[sources/doc-25-duckdb-explorer-prd]] — 设计来源 PRD

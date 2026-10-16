---
title: m-12 - DuckDB Explorer 里程碑
labels: [source, milestone, duckdb, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/milestones/m-12 - duckdb-explorer.md
---

# m-12 - DuckDB Explorer 里程碑

为 Backlog.md 增加 DuckDB 支持的里程碑，镜像 m-11 交付的 SQLite Explorer，但服务端在 `@duckdb/node-api`（官方 N-API 绑定）上执行而非 `bun:sqlite`。两引擎共享一份设计：`duckdb-query` 围栏块在阅读视图实时渲染只读结果（`table` / `list` / `value`），动作 Refresh / Show/Hide Query / Copy Markdown / Export CSV；数据源为项目根下任意 `.duckdb` 文件、一律项目相对路径、每次请求以 `READ_ONLY` 访问模式打开并封顶 500 行。`documentation` 字段指向设计文档 doc-25；验收演示见 doc-26。

核心原则是复用不复制：`src/sqlite/validation.ts`（只读 SQL 形状 + 关键字黑名单，引擎无关）、`markdown.ts` 与 `csv.ts`（只碰通用 `{ columns, rows }` 网格）逐字共享；React 组件 `SqliteQueryBlock` 重构为按引擎配置（块语言、i18n 命名空间、api 方法）参数化的通用 `SqlQueryBlock`，SQLite 侧保留薄包装使 m-11 表面不变。只有驱动相关件是新的：`src/duckdb/` 下的 `block.ts`（语言常量）、`discover.ts`（`.duckdb` 扩展名）、`paths.ts`（解析 + 文件头校验）、`query.ts`（只读执行 + JSON 安全类型强制）、`export.ts`（`buildDuckdbCsv` 包装）。可行性 spike（BACK-777）先行：确认 `@duckdb/node-api` 能在 bun 下导入并跑只读查询、DuckDB 特有类型能强制到共享 `SqliteCell` 契约，否则回退 `@duckdb/duckdb-wasm`。明确不做：独立浏览视图、表选择器 / schema 面板、CLI 子命令、MCP 工具、登记进 `databases/registry.json`；Embed 同 m-11 推迟。

## 验收标准

不适用（里程碑记录）；高层任务分解即完成定义：

1. Spike——Bun 下导入与只读查询、类型强制契约（BACK-777）。
2. Core + Web——`duckdb-query` 块渲染：通用 `SqlQueryBlock` + 引擎配置、`src/duckdb/` 引擎模块、`POST /api/duckdb/query` + `GET /api/duckdb/files`、api client 方法、`MermaidMarkdown` 分支、四语言 `duckdbQueryBlock` 文案、三视图与 loading/error/empty/truncated、Refresh（BACK-778，镜像 BACK-773）。
3. Web——Show/Hide Query 开关（BACK-779，镜像 BACK-774）。
4. Web——Copy Markdown（共享 `markdown.ts`；BACK-780，镜像 BACK-775）。
5. Server + Web——Export CSV（`buildDuckdbCsv` + `POST /api/duckdb/export-csv` + 共享的"保存到用户所选位置"；BACK-781，镜像 BACK-776）。
6. 测试与门禁——解析器、路径守卫、共享只读校验、DuckDB 句柄与类型强制、截断、CSV 引号 / 命名 / 拒建前置；`bunx tsc --noEmit`、`bun run check .`、相关测试全绿。

设计来源：doc-23（只读 + 安全模型原样沿用）与 doc-25（DuckDB 特有设计），引擎差异细节落在任务里。

## Related Concepts

- [[concepts/web-ui-features]] — 通用 `SqlQueryBlock` 与渲染链所在面
- [[concepts/kuzu-graph]] — `databases/registry.json` 只描述图数据库，DuckDB 文件不进注册表

## Related Sources

- [[sources/doc-25-duckdb-explorer-prd]] — 本里程碑的 DuckDB 特有设计文档
- [[sources/m-11-sqlite-explorer]] — 被镜像的 SQLite Explorer 里程碑（设计同源）
- [[sources/doc-26-duckdb-explorer-demo]] — 验收演示文档

---
title: m-11 - SQLite Explorer 里程碑
labels: [source, milestone, sqlite, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/milestones/m-11 - sqlite-explorer.md
---

# m-11 - SQLite Explorer 里程碑

为 Backlog.md 增加只读 SQLite Explorer 的里程碑，仿 Obsidian SQLite Explorer 插件的交互语义、服务端在 `bun:sqlite` 上执行（而非 sql.js/WASM）。`documentation` 字段指向设计文档 doc-23（正文两处写作 doc-16，应为旧编号）；`actual_end` 2026-10-12 19:23。验收演示见 doc-24。

范围：一期只做 markdown 代码块——任意 Backlog 文档阅读视图中的 `sqlite-query` 围栏块实时渲染查询结果（`table` / `list` / `value` 三视图），块头动作 Refresh、Show/Hide Query、Copy Markdown、Export CSV。数据源为项目根下任意 `.sqlite` / `.sqlite3` / `.db` 文件（排除 `node_modules` / `.git` / `dist` / `build` / `.locks` 与 `.backlog` 以外的点目录），一律项目相对路径寻址（拒绝前导 `/`），每个请求强制只读（`readonly` 句柄 + `PRAGMA query_only`）并封顶 500 行。2026-10-13 起 CSV 导出回到一期范围（BACK-774/775/776），但作为块的结果动作而非浏览面：客户端只发 `source` + `sql`，服务端重新过闸门、重跑语句、返回带 `<db stem>-<timestamp>.csv` 建议文件名的 CSV 文本，浏览器用 File System Access API（blob 下载兜底）保存到用户所选位置。明确不做：独立数据库浏览视图、表选择器 / schema 面板、CLI 子命令、MCP 工具、登记进 `databases/registry.json`；Embed 静态快照推迟而非取消。

## 验收标准

不适用（里程碑记录）；高层任务分解即完成定义：

1. Core——块解析器（YAML 子集 `source` / `sql` / `view` / `refresh`）、路径解析 + 四道 fail-closed 闸门（无前导 `/`、无绝对路径、无 `..` 逃逸、realpath 在项目根内、扩展名 + SQLite 魔数）、只读 SQL 校验（SELECT/WITH 形状 + 跳过引号标识符与字符串字面量的关键字黑名单）；排除目录集合落在 `src/utils/project-scan.ts`。
2. Server——`POST /api/sqlite/query` 返回 `{ columns, rows, truncated, elapsedMs, dbPath }`，按 realpath 缓存句柄（多块共享、空闲 60s 关闭）；`GET /api/sqlite/files` 列库（30s 缓存）。
3. Web——`MermaidMarkdown` 渲染链挂 `SqliteQueryBlock`：三视图、loading / error / empty / truncated 状态，Refresh（BACK-773）、Show/Hide Query（BACK-774）、Copy Markdown（BACK-775）、Export CSV（BACK-776）。
4. Server + Web——Export CSV 服务端构建、浏览器保存到用户所选位置。
5. 测试与门禁——解析器、路径守卫、只读校验（含引擎层拒写路径）、句柄复用、截断、CSV 引号 / 命名 / 拒写前置；`bunx tsc --noEmit`、`bun run check .`、相关测试全绿。

## Related Concepts

- [[concepts/web-ui-features]] — 阅读态渲染与块组件所在面
- [[concepts/kuzu-graph]] — `databases/registry.json` 只描述图数据库，SQLite 文件不进注册表

## Related Sources

- [[sources/doc-23-sqlite-explorer-prd]] — 本里程碑的设计文档（§9 含验收标准）
- [[sources/doc-24-sqlite-explorer-demo]] — 验收演示文档
- [[sources/m-12-duckdb-explorer]] — 同设计的 DuckDB 引擎对偶里程碑

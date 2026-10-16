---
title: 文档内实况 SQL 查询块
labels: [concept, sqlite, duckdb, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
---

# 文档内实况 SQL 查询块

`sqlite-query` / `duckdb-query` 围栏代码块让任何 Backlog 文档在阅读视图渲染实况只读 SQL 查询结果（表格/列表/单值三种视图），由里程碑 m-11（SQLite，BACK-773~776）与 m-12（DuckDB，BACK-777~781）交付。设计来源 doc-23 / doc-25；设计蓝本是 Obsidian SQLite Explorer 插件，但执行在服务端（`bun:sqlite` / `@duckdb/node-api`）而非 WASM。

## 块模型

YAML 子集字段：`source`（数据库文件的项目相对路径）、`sql`（查询语句）、`view`（`table` / `list` / `value`）、`refresh`（自动刷新间隔）。块动作四个：Refresh（BACK-773/778）、Show/Hide Query（BACK-774/779）、Copy Markdown（BACK-775/780）、Export CSV（BACK-776/781——服务端重建 CSV，浏览器经 File System Access API 由用户自选保存位置，客户端永远不提供行数据或目标路径）。

## 安全模型

- 路径四重 fail-closed 闸门：拒绝前导 `/`、拒绝绝对路径、拒绝 `..` 逃逸、realpath 必须在项目根内；扩展名白名单 + SQLite magic 头校验；排除目录集在 `src/utils/project-scan.ts`（`node_modules`、`.git`、`dist`、`build`、`.locks` 及除 `.backlog` 外的点目录）
- SQL 只读校验：SELECT/WITH 形状 + 关键字黑名单（忽略带引号标识符与字符串字面量，保留注释）；引擎级兜底——SQLite `readonly` 句柄 + `PRAGMA query_only`，DuckDB 以 `READ_ONLY` 访问模式打开
- 结果默认 500 行上限；BACK-797 起 `query_max_rows` 可配置并支持分页浏览

## 引擎复用结构

`src/sqlite/validation.ts`（只读形状校验，引擎无关）、`markdown.ts`、`csv.ts`（只触碰通用 `{columns, rows}` 网格）被 DuckDB 原样共享；React 侧 `SqliteQueryBlock` 重构为按引擎配置（块语言、i18n 命名空间、API 方法）参数化的通用 `SqlQueryBlock`，`SqliteQueryBlock` 保留为薄封装。驱动特定部分才新建于 `src/duckdb/`（block/discover/paths/query/export）。BACK-777 是先导 spike：验证 `@duckdb/node-api` 能在 Bun 下跑只读查询且 DuckDB 类型可归一到共享 `SqliteCell` 契约，失败则回退 `@duckdb/duckdb-wasm`。BACK-796 起 DuckDB 块经官方 excel 扩展额外支持 `.csv`/`.xlsx` 数据源；BACK-800 修复编译二进制中 DuckDB 原生绑定的打包。

## Related Concepts

- [[concepts/web-ui-features]] — 查询块挂载的 Markdown 渲染链（MermaidMarkdown 围栏分支）
- [[concepts/markdown-pipeline]] — 文档渲染与序列化流水线

## Related Sources

- [[sources/m-11-sqlite-explorer]] — SQLite Explorer 里程碑（范围与安全模型定义）
- [[sources/m-12-duckdb-explorer]] — DuckDB Explorer 里程碑（镜像复用策略）
- [[sources/doc-23-sqlite-explorer-prd]] — SQLite Explorer 设计文档
- [[sources/doc-25-duckdb-explorer-prd]] — DuckDB Explorer 设计文档
- [[sources/back-777-duckdb-node-api-bun-spike]] — DuckDB 原生绑定可行性 spike
- [[sources/back-796-duckdb-csv-excel-sources]] — CSV/Excel 数据源扩展
- [[sources/back-797-query-block-pagination]] — 行上限配置与分页浏览
- [[sources/back-800-duckdb-native-binding-bundling]] — 编译二进制原生绑定打包修复

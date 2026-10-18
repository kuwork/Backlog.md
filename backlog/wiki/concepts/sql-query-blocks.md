---
title: 文档内实况 SQL 查询块
labels: [concept, sqlite, duckdb, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-18 22:00
---

# 文档内实况 SQL 查询块

`sqlite-query` / `duckdb-query` 围栏代码块让任何 Backlog 文档在阅读视图渲染实况只读 SQL 查询结果（表格/列表/单值三种视图），由里程碑 m-11（SQLite，BACK-773~776）与 m-12（DuckDB，BACK-777~781）交付。设计来源 doc-23 / doc-25；设计蓝本是 Obsidian SQLite Explorer 插件，但执行在服务端（`bun:sqlite` / `@duckdb/node-api`）而非 WASM。

## 块模型

YAML 子集字段：`source`（数据库文件的项目相对路径）、`sql`（查询语句）、`view`（`table` / `list` / `value` / `echarts`）、`chart`（`view: echarts` 的图表 JSON）、`id`（供图表 `fromQuery` 引用的名字，m-17）、`refresh`（自动刷新间隔）。块动作四个：Refresh（BACK-773/778）、Show/Hide Query（BACK-774/779）、Copy Markdown（BACK-775/780）、Export CSV（BACK-776/781——服务端重建 CSV，浏览器经 File System Access API 由用户自选保存位置，客户端永远不提供行数据或目标路径）。

## 安全模型

- 路径四重 fail-closed 闸门：拒绝前导 `/`、拒绝绝对路径、拒绝 `..` 逃逸、realpath 必须在项目根内；扩展名白名单 + SQLite magic 头校验；排除目录集在 `src/utils/project-scan.ts`（`node_modules`、`.git`、`dist`、`build`、`.locks` 及除 `.backlog` 外的点目录）
- SQL 只读校验：SELECT/WITH 形状 + 关键字黑名单（忽略带引号标识符与字符串字面量，保留注释）；引擎级兜底——SQLite `readonly` 句柄 + `PRAGMA query_only`，DuckDB 以 `READ_ONLY` 访问模式打开
- 结果默认 500 行上限；BACK-797 起 `query_max_rows` 可配置并支持分页浏览

## 引擎复用结构

`src/sqlite/validation.ts`（只读形状校验，引擎无关）、`markdown.ts`、`csv.ts`（只触碰通用 `{columns, rows}` 网格）被 DuckDB 原样共享；React 侧 `SqliteQueryBlock` 重构为按引擎配置（块语言、i18n 命名空间、API 方法）参数化的通用 `SqlQueryBlock`，`SqliteQueryBlock` 保留为薄封装。驱动特定部分才新建于 `src/duckdb/`（block/discover/paths/query/export）。BACK-777 是先导 spike：验证 `@duckdb/node-api` 能在 Bun 下跑只读查询且 DuckDB 类型可归一到共享 `SqliteCell` 契约，失败则回退 `@duckdb/duckdb-wasm`。BACK-796 起 DuckDB 块经官方 excel 扩展额外支持 `.csv`/`.xlsx` 数据源；BACK-800 修复编译二进制中 DuckDB 原生绑定的打包。

## 第三引擎：Cypher（m-15）

BACK-802 把 `SqlQueryBlock` 进一步泛化为**引擎无关的 `QueryBlock`**，Cypher 成为第三个薄壳，共享同一内核与解析器（语句字段参数化为 `sql` / `query`）。差异集中在 `QueryEngineConfig` 的五个差异项，后续再扩 `graph` 视图、`refresh.auto.subscribe` 与 `highlightLanguage`。验收硬约束是 **SQL 两块表面逐字节不变**——27 个既有测试一字未改通过。

Cypher 侧刻意与 SQL 不同的三点：`source` 是数据库**注册名**而非路径（图库是目录，注册名天然没有逃逸面）、多出 `view: graph` 与 `refresh: auto`（图库有 `graph-updated` 广播）、以及 node/relationship/path 的类型强制。详见 [[concepts/cypher-live-query-block]]。

BACK-805 曾给三块回灌 `style` 字段（compact/striped/borderless），BACK-811 因级联不可用而 **fail-closed 移除**：带该字段的块直接报未知字段错误并列出剩余字段。同期为「显示查询」面板接上阅读视图自己的代码高亮（refractor `all` 实例 + `markdown.css` 的 `.token.*`，Cypher 走 `cypher` 语法、SQL 走 `sql`，未知语法回退纯文本）。

## 第四视图：echarts（m-17）

BACK-813 把 `view` 枚举扩到 `echarts`，块可以**不画表格直接出图**：新增 `chart` 字段放图表 JSON（简单映射 `type`/`categoryField`/`valueField`，或高级 `option` + `@result` / `@result:<列名>` 占位符）。它是 `value` 视图的图表版——结果就是图表本身。

BACK-814 又加了可选 `id`：命名后的块把自己的结果发布到每文档一个的 `QueryResultProvider`，独立 `echarts` fence 用 `fromQuery` 引用它，表格与图并存。两者都不改只读与行数上限，都不引入函数执行面。详见 [[concepts/query-chart-binding]]。

## Related Concepts

- [[concepts/query-chart-binding]] — `view: echarts` 与 `fromQuery` 两种图表联动
- [[concepts/chart-block-engine]] — 图表视图复用的引擎与生命周期
- [[concepts/cypher-live-query-block]] — 共享同一内核的第三引擎（Cypher）
- [[concepts/web-ui-features]] — 查询块挂载的 Markdown 渲染链（MermaidMarkdown 围栏分支）
- [[concepts/markdown-pipeline]] — 文档渲染与序列化流水线；未分层 CSS 压过 Tailwind 工具类是 style 字段失效的根因

## Related Sources

- [[sources/m-11-sqlite-explorer]] — SQLite Explorer 里程碑（范围与安全模型定义）
- [[sources/m-12-duckdb-explorer]] — DuckDB Explorer 里程碑（镜像复用策略）
- [[sources/doc-23-sqlite-explorer-prd]] — SQLite Explorer 设计文档
- [[sources/doc-25-duckdb-explorer-prd]] — DuckDB Explorer 设计文档
- [[sources/back-777-duckdb-node-api-bun-spike]] — DuckDB 原生绑定可行性 spike
- [[sources/back-796-duckdb-csv-excel-sources]] — CSV/Excel 数据源扩展
- [[sources/back-797-query-block-pagination]] — 行上限配置与分页浏览
- [[sources/back-800-duckdb-native-binding-bundling]] — 编译二进制原生绑定打包修复
- [[sources/back-802-cypher-query-block-core]] — 共享内核泛化与 Cypher 引擎接入
- [[sources/back-805-query-block-style-presets]] — style 三预设引入（后被移除）
- [[sources/back-811-remove-style-field-add-highlight]] — style 移除与查询源码语法高亮
- [[sources/back-813-query-block-view-echarts]] — `view: echarts` 与 `chart` 字段
- [[sources/back-814-echarts-from-query]] — `id` 字段与 `fromQuery` 引用

---
title: BACK-797 - 查询块可配置行上限与分页浏览
labels: [source, web-ui, duckdb, sqlite, pagination, config]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-797 - Query-blocks-configurable-row-cap-plus-pagination-browser.md
---

# BACK-797 - 查询块可配置行上限与分页浏览

`sqlite-query` 与 `duckdb-query` 块的结果原先硬编码截断 500 行（`SQLITE_MAX_ROWS` / `DUCKDB_MAX_ROWS`）。本任务把上限、分页页大小、是否默认分页都搬进 `backlog/config.yml` 与 Web 设置页，并加真实引擎侧分页浏览器——用户 SQL 被包成子查询、`LIMIT`/`OFFSET` 下推引擎，永远不物化全量结果，因此不受 5000 硬顶约束（这正是分页存在的意义：浏览超 5000 行的数据集）。落地经历七轮评审返工。

## 目标

- 500 行预览上限从常量搬进 `BacklogConfig.queryMaxRows`（默认 500），SQLite/DuckDB 查询处理器与导出路径都读配置；`SQLITE_ABS_MAX_ROWS` / `DUCKDB_ABS_MAX_ROWS = 5000` 硬顶保留、只管预览模式。设置页数字输入钳制到最大 5000（标注"最大 5000"）。
- 新增 `paginationPageSize`（默认 50）与 `defaultPagination`（默认 false），`saveConfig` 持久化、设置页可编辑。
- 块头部刷新按钮旁放开关式"分页浏览"切换；开启时块发 `page`/`pageSize`，服务器以子查询下推 `LIMIT`/`OFFSET`（另发 `SELECT COUNT(*)` 子查询取 `totalRows`），返回 `totalRows`、`page`、`pageSize`、`totalPages`，分页模式 `truncated` 为 false。
- 分页器显示"第 X / Y 页"加左右箭头，首末页箭头禁用；翻页重新查询该页。`defaultPagination` 为 true 时块首渲染即进分页模式。
- 表格视图与列表视图都加行号（序号）列：分页模式反映全局行位（`(page - 1) * pageSize + i + 1`），预览模式反映局部位。
- 预览模式保留截断提示并补报真实总行数（"已截断至 500 行（共 N 行）"），堵上只显示"500 行"的旧缺口。

## 实现要点

- 类型与配置文件：`src/types/index.ts` 的 `BacklogConfig` 加三个可选键；`backlog/config.yml` 加 `query_max_rows: 500`、`pagination_page_size: 50`、`default_pagination: false`。既有 config.yml 缺这些键照常工作（类型可选、代码内兜底）。
- 查询（`src/sqlite/query.ts` / `src/duckdb/query.ts`）：分页分支把用户 SQL 包为 `SELECT * FROM (<sql>) AS _p LIMIT :pageSize OFFSET :offset`，总数用 `SELECT COUNT(*) AS _c FROM (<sql>) AS _p`；每请求只取一页，豁免 5000 硬顶。子查询包装对 `SELECT` 与 `WITH cte AS (...) SELECT` 都安全（两种引擎的子查询内 CTE 合法），包装前剥尾部分号；只读关键字黑名单（此时已含 INSTALL/LOAD/COPY，见 [[sources/back-796-duckdb-csv-excel-sources|BACK-796]]）仍先审包装后的 SQL。预览模式 `totalRows` 取自已物化的 `records.length`，两路汇同一字段。
- 服务器：`handleSqliteQuery` / `handleDuckdbQuery` 经 `this.core.filesystem.loadConfig()` 读配置，`maxRows` 默认 `clamp(config.queryMaxRows ?? 500, 1, 5000)`、`pageSize` 默认 `clamp(config.paginationPageSize ?? 50, 1, 1000)`。导出 CSV 继续用预览上限、与当前页无关。
- 前端 `SqlQueryBlock`：请求类型加 `page?`/`pageSize?`。
- 评审返工（共七轮，择要）：
  - 分页器原先 `totalPages > 1` 才渲染，单页结果开了分页毫无反馈——改为分页模式激活即渲染（单页显示"第 1 / 1 页"双箭头禁用）。列表视图序号从"并入首字段标签"改为独立引导 gutter 列。
  - 配置持久化 bug：三个键加进了类型与设置页，但 `FileOperations.serializeConfig` 是显式逐行 writer、没写这三个键，`parseConfig` 也没读回——UI 看似保存成功，重载即回旧默认，键被静默丢弃。修复为两函数都处理三键（含 snake/camel 别名、缺席不污染文件），并加跨 FileSystem 实例的磁盘往返测试（绕开内存缓存真验 serialize+parse）。
  - 切换空白页：`togglePagination` 用函数式 updater 忽略 `<Switch>` 传入的 `checked`，关分页时既不重置 page 也不 bump nonce——改为直接接受 Switch 的 `next: boolean`、开分页恒重置 page 为 1、恒 bump nonce。
  - 配置缓存：`loadQueryConfig()` 的模块级 `configPromise` 缓存永不失效，设置页保存后旧块仍拿旧配置——删缓存改为每块挂载时现取，并新增 `"backlog-config-updated"` window 事件（`App.tsx` 收到 WebSocket `config-updated` 时派发），所有已挂载块原地重取，设置保存即时生效、无需刷新或重启。
  - 切换滚动跳空白：共享 Switch 的 sr-only 复选框没有定位祖先，`position: absolute` 相对初始包含块解析、不跟随内层 `<main>` 滚动容器，点击 label 聚焦复选框时浏览器把窗口 scroll-into-view 到陈旧位置（同时撑大 window scrollHeight）。修复：`src/web/components/Switch.tsx` 用 `<span className="relative inline-block">` 包住复选框与轨道。同潜伏 bug 存在于 Switch 另两个调用点（SearchDialog、CompletedFilterToggle），一并修复；真实鼠标 CDP 测试（1366x768，doc-24/doc-26）验证 scrollY 1054→0 跳动消除，并以 `src/test/web-switch.test.tsx` 锁定。
  - 分页箭头改为恒渲染、首末页 `opacity-0` + `cursor-default`（占住布局），消除"第 X / Y 页"文字左右移位。切换最终落到应用专用 `<Switch>` 组件（`w-9 h-5`），on 态色改为设置页蓝（`peer-checked:bg-blue-500`），位置移到块头部最右、紧跟"重新查询"。

## 验证

`bunx tsc --noEmit` 干净；`bun run check .` 退出 0（仅剩 14 条预存 noExplicitAny 警告与 1 条刻意的 `_c` 字面量 info）。SQLite 套件 31 通过、DuckDB 套件 38 通过，每引擎含三个新分页用例（翻页切片 + totalPages、预览 totalRows/截断、6000 行分页豁免 5000 硬顶——DuckDB 侧用单条 `INSERT ... SELECT FROM range(...)` 代替 6000 条 INSERT 避免 WASM 往返超时）。

## Related Concepts

- [[concepts/list-paging]] — 本任务为查询块引入第三种分页形态：引擎侧 LIMIT/OFFSET 下推，刻意不物化全量
- [[concepts/web-ui-features]] — SqlQueryBlock 共享组件与设置页

## Related Sources

- [[sources/back-796-duckdb-csv-excel-sources]] — 查询块的 CSV/XLSX 数据源与 copy_to 写路径
- [[sources/back-800-duckdb-native-binding-bundling]] — DuckDB 原生绑定打包修复
- [[sources/back-581-web-settings-default-assignee]] — Web 设置页编辑配置项的既有通路
- [[sources/back-802-cypher-query-block-core]] — 第三引擎接入共享内核；行上限同源但 Cypher 不做分页

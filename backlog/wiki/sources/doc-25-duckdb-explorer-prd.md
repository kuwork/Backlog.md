---
title: doc-25 - DuckDB Explorer 只读查询设计
labels: [source, design, duckdb, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/docs/PRDS/duckdb/doc-25 - DuckDB-Explorer：只读-SQL-浏览与查询能力.md
---

# doc-25 - DuckDB Explorer 只读查询设计

DuckDB Explorer 设计稿（v1，与实现里程碑 m-12 对齐；§11 为 2026-10-14 的 v2 增补）。它是 [[sources/doc-23-sqlite-explorer-prd|doc-23]] SQLite Explorer 的**引擎对偶**：交互语义、安全模型、路径规则全部照搬，只把执行栈从 `bun:sqlite` 换成 `@duckdb/node-api`（DuckDB 官方 N-API 绑定，BACK-777 spike 已在 Bun 1.3.13 验证可行，`@duckdb/duckdb-wasm` 仅作 fallback）。一期只做 `duckdb-query` 围栏块的阅读态渲染；验收样本见 [[sources/doc-26-duckdb-explorer-demo|doc-26]]。

## 目标

1. 任意 Backlog 文档阅读视图里用 `duckdb-query` 围栏块嵌入实时只读查询，三种展示模式 `table` / `list` / `value`。
2. 与 SQLite Explorer 行为对齐：Refresh / Show-Hide Query / Copy Markdown（GFM 表格）/ Export CSV（浏览器保存到用户所选位置）。
3. 只读保证：任何路径都写不到数据库文件。

非目标：写操作、CLI 子命令、MCP 工具、独立浏览视图、登记进 `databases/registry.json`、Embed 静态快照（设计保留于 §7，本期不实现）。

## 实现要点

与 SQLite 侧的差异仅限驱动相关部分，其余（四道 fail-closed 路径闸门、只读三层、视图模式、动作按钮、500 行上限）完全一致并直接复用：

- **打开与连接模型**：`DuckDBInstance.create(path, { access_mode: "READ_ONLY" })`；不走句柄缓存——每个查询开一个实例、跑完 `finally` 里 `closeSync()`（DuckDB 连接模型下缓存得不偿失，只读打开天然无写冲突）。
- **扩展名与魔数**：白名单仅 `.duckdb`；魔数校验看文件头 **offset 8** 处的字面量 `DUCK`（前 8 字节是版本/校验头）。闸门 1–3 与 SQLite 共用 `src/sqlite/paths.ts` 的 `isNonRelativeSource` / `segmentsInsideProject`，仅闸门 4 由 `src/duckdb/paths.ts` 的 `isDuckdbFileName` / `hasDuckdbMagic` 实现。
- **共享件**：只读校验第 1、2 层复用 `src/sqlite/validation.ts` 的 `validateReadOnlySql`（引擎无关，DuckDB 侧黑名单额外含 `COPY`）；块解析复用 `src/sqlite/block.ts` 的 `parseQueryBlock`；`markdown.ts` / `csv.ts` 序列化只碰通用 `{ columns, rows }` 网格。前端 `DuckdbQueryBlock` 是 `SqliteQueryBlock` 的同构薄包装，二者都包在通用 `SqlQueryBlock` 外，差异只有引擎 id / i18n 命名空间 / api 方法 / 可用动作四项（`QueryEngineConfig`）；m-11 的 SQLite 表面须逐字节不变。
- **接口**：`POST /api/duckdb/query`（响应形状与 SQLite 逐字段一致）；`POST /api/duckdb/export-csv` 严格两键 `{ source, sql }`，服务端返回 CSV 文本与建议文件名，浏览器写盘。`GET /api/duckdb/files` 列库，30s 缓存。
- **行数上限**：默认 `DUCKDB_MAX_ROWS = 500`，硬上限 `DUCKDB_ABS_MAX_ROWS = 5000`（防手写 `maxRows` 成脚枪）。
- **类型强制（DuckDB 特有）**：`getRowObjects()` 返回包装对象，`query.ts` 的 `toCell` 按对象形状（`micros` / `days` / `bytes` / `value`+`scale`）判别并强制成共享 `SqliteCell` 联合——BIGINT 转十进制字符串、DECIMAL 转定标十进制串、TIMESTAMP 转 ISO、DATE 取 `slice(0,10)`、BLOB 转 `<blob N 字节>`；不 import 版本敏感的值类，绑定升级不会悄悄改变分派。
- **§11 二期增补（CSV / Excel 数据源）**：选型只用官方扩展——CSV 走内置 `read_csv_auto`（replacement scan 裸路径即可），Excel 走官方 `excel` 扩展（`read_xlsx`，core 扩展 autoload 默认开启）；否决 `spatial`（装整个 GDAL 过重）与社区 `rusty_sheet`（供应链信任）。非 `.duckdb` 数据源开 `:memory:` 内存实例、SQL 里以文件为查询目标；`source` 保持必填作为安全锚点（SQL 字面量无法可靠反向提取，访问控制不依赖解析 SQL）；SQL 字符串字面量补充校验 best-effort 拒绝 `http(s)://` / `s3://` 等 URL（防 `httpfs` autoload 变成任意外联）。`INSTALL` / `LOAD` / `COPY` 均被只读静态校验拦截，扩展装载只走引擎 autoload。写路径由块字段 `copy_to: <项目相对路径>` 显式开启：服务端把 `SELECT` 包装成 `COPY (<sql>) TO '<target>'`（`.csv` → `HEADER TRUE`；`.xlsx` → `FORMAT XLSX, HEADER TRUE`），目标过与 `source` 相同的项目内闸门，只允许写入项目内 `.csv` / `.xlsx` 新文件、禁止覆盖 `.duckdb` 本体；写随块运行触发、幂等覆盖、响应带 `writtenTo`；`sqlite-query` 块携带 `copy_to` 会被拒绝。读写示例均已在 Bun 1.3.13 + `@duckdb/node-api` 实测通过。

验收标准（§9，对应 m-12）逐条映射到任务：块渲染与路径/校验/列库（BACK-778）、类型强制（BACK-777/778）、Show/Hide Query（BACK-779）、Copy Markdown（BACK-780）、Export CSV（BACK-781）、SQLite 表面逐字节不变（BACK-778）。

## Related Concepts

- [[concepts/web-ui-features]] — 阅读态渲染管线与通用 `SqlQueryBlock` 组件所在面
- [[concepts/kuzu-graph]] — `databases/registry.json` 只描述图数据库，DuckDB 文件不进注册表

## Related Sources

- [[sources/doc-23-sqlite-explorer-prd]] — 同源设计（只读与安全模型原样照搬）
- [[sources/doc-26-duckdb-explorer-demo]] — 本设计的验收演示文档
- [[sources/m-12-duckdb-explorer]] — 本设计对应的实施里程碑

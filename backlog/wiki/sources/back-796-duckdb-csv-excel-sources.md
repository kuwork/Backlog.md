---
title: BACK-796 - DuckDB Explorer 支持 CSV 与 Excel 数据源
labels: [source, duckdb, web-ui, core, sql]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-796 - DuckDB-Explorer-support-CSV-and-Excel-data-sources-via-official-excel-extension.md
---

# BACK-796 - DuckDB Explorer 支持 CSV 与 Excel 数据源

M-12 交付的 duckdb-query 块只能读 .duckdb 文件，项目里的 CSV/Excel 数据完全无法预览或查询。可行性已由探针证实：Bun 1.3.13 + @duckdb/node-api 在 `:memory:` 实例上经 replacement scan 直接裸路径 `FROM 'file.csv'` / `FROM 'file.xlsx'`；官方 excel 扩展是核心扩展、引擎 autoload 默认开启（首次联网安装、之后走本地缓存），`COPY ... TO (FORMAT XLSX, HEADER true)` 可经 `read_xlsx` 往返。官方 excel 扩展优于 spatial（st_read 太重）与社区 rusty_sheet（供应链信任）。设计见 doc-25 第 11 节。

## 目标

- duckdb-query 块接受项目内相对路径 .csv（`:memory:` 实例 + 裸路径 replacement scan，无需装扩展）与 .xlsx（官方 excel 扩展，autoload，用户 SQL 不写 INSTALL/LOAD，`read_xlsx(...)` 带参数也可用）。
- `resolveDuckdbSource` 白名单扩到 .csv/.xlsx，DUCK 魔数检查只管 .duckdb；三道路径门禁（仅相对、项目内、符号链接解析）对所有扩展名生效。
- 只读校验器继续拒绝 INSTALL/LOAD/COPY；扩展加载只走引擎 autoload；离线无缓存时装扩展失败渲染可读中文错误而非静默。
- 可选写路径：解析器新增 `copy_to` 字段，SQL 仍是 SELECT，服务器包装为 `COPY (<sql>) TO '<target>'`（.csv → `HEADER true`，.xlsx → `FORMAT XLSX, HEADER true`），目标过同样的项目内门禁且永不可是既有 .duckdb 文件；响应带 `writtenTo`。
- SQL 字符串字面量额外筛查：URL scheme 字面量（http(s)://、s3:// 等）直接拒绝，路径样字面量逐个过项目内门禁。

## 实现要点

- 先跑探针再写码：两个一次性脚本（`tmp/duckdb-probe2.ts` / `probe3.ts`，事后删除）敲定三个未知：裸路径 FROM 在 cwd=项目根的 `:memory:` 实例上可行；`COPY ... TO` 在 `READ_ONLY` 实例上也成功（写路径对 .duckdb 源同样成立）；excel 扩展本地存在即可解析（probe-3 首次报错只是 fixture 路径写错，反而确认了 `read_xlsx` 函数名可解析）。
- `src/duckdb/paths.ts`：`DUCKDB_EXTENSIONS` 白名单扩为 .duckdb/.csv/.xlsx；`resolveDuckdbSource` 返回源种类（`database | data-file`）；魔数检查只管 .duckdb（伪装的非数据库 .duckdb 仍被正确拒绝）；新增 `resolveDuckdbWriteTarget` 门禁 copy_to 目标（仅 csv/xlsx、绝不 .duckdb、必须在项目内）。
- `src/duckdb/query.ts`：`runDuckdbQuery` 按种类分支——.duckdb 保持 `READ_ONLY` attach；.csv/.xlsx 开 `:memory:` 实例靠引擎 replacement scan + autoload。excel autoload/autoinstall 失败（离线）包装为可读中文错误（"无法加载 Excel 扩展：请检查网络连接，或确认已缓存 excel 扩展"）；xlsx 测试带优雅跳过守卫（CI/离线保护）。`copy_to` 在读所用的同一连接上执行；.duckdb 源的 `READ_ONLY` 物理层已挡回写。
- 新增 `src/duckdb/sql-literals.ts`：复用 `validation.ts` 的扫描语义抽取 SQL 字符串字面量，仅对 data-file 源筛查；无法分类的字面量按拒绝处理（best-effort、fail-closed）。
- 最重要的安全改动在共享层：`validateReadOnlySql`（SQLite 与 DuckDB 共用，在 `src/sqlite/validation.ts`）把 INSTALL/LOAD/COPY 加入只读禁用关键字，堵死用户 SQL 装恶意扩展或 COPY 出项目的路径。
- 共享块解析器 `src/sqlite/block.ts` 认知 `copy_to` 可选字段：SQLite 侧拒绝、DuckDB 侧接受。`SqlQueryBlock` 同时支撑两种块，copy_to 管道与 `writtenTo` 提示都加在那里，四语言加 i18n 键；SQLite 处理器永不填充 `writtenTo`，UI 对该字段保持惰性。
- `/api/duckdb/files` 经放宽的 `isDuckdbFileName` 白名单自动列出 .csv/.xlsx。

## 验证

`duckdb.test.ts` 扩到 35 个用例：白名单/魔数/种类分发、CSV 与 xlsx 查询、字面量筛查、copy_to 写入与逃逸拒绝、INSTALL/LOAD/COPY 作首关键字拒绝；sqlite 套件 28 个用例保持绿。`bunx tsc --noEmit` 0 错误；`bun run check .` 0 错误（14 条预存 noExplicitAny 警告与本任务无关）。

## Related Concepts

- [[concepts/core-architecture]] — 路径门禁与 fail-closed 只读校验在 core/server 边界的落位
- [[concepts/web-ui-features]] — SqlQueryBlock 同时支撑 SQLite 与 DuckDB 查询块的 Web 呈现

## Related Sources

- [[sources/back-797-query-block-pagination]] — 同一 SQL 查询块线的行上限配置与分页浏览（依赖本任务的块管道）
- [[sources/back-800-duckdb-native-binding-bundling]] — DuckDB 原生绑定进编译二进制的打包修复

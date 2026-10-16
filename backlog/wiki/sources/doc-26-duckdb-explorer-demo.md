---
title: doc-26 - DuckDB Explorer 演示
labels: [source, guide, duckdb, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/docs/PRDS/duckdb/doc-26 - DuckDB-Explorer-演示.md
---

# doc-26 - DuckDB Explorer 演示

BACK-778 的验收样本文档（对应里程碑 m-12）：自带示例库 `backlog/databases/demo-shop.duckdb`（表 `customers`(20) / `products`(15) / `orders`(80)，视图 `order_details`），schema 与数据同 SQLite 演示库 `demo-shop.sqlite` 逐行一致，只是引擎换成 DuckDB。`bun run src/cli.ts browser --no-open` 打开 Web UI 即可看到所有 `duckdb-query` 块实时执行的结果。设计依据见 [[sources/doc-25-duckdb-explorer-prd|doc-25]]。

## 内容要点

第 1–6 节与 SQLite 演示（[[sources/doc-24-sqlite-explorer-demo|doc-24]]）同构：表格 / 列表 / 单值三种视图、空结果渲染空态、写类语句（`DELETE`）与并列语句被静态校验挡掉、越界路径（`..` 逃逸、前导 `/`）fail-closed；另有 DuckDB 特有示例——`source` 指向 `.sqlite` 文件因扩展名不在白名单被拒。`source` 一律按项目相对路径解析（`wiki/developer-notes/security-gotchas.md` §1）。

**第 7 节 CSV / Excel 数据源（BACK-796，已实装）**，对应 doc-25 §11：

- 演示文件 `demo-shop-orders.csv`（`order_details` 全量 80 行）与 `demo-shop.xlsx`（`products` 全量 15 行），与 `demo-shop.duckdb` 同库派生。
- 非 `.duckdb` 数据源打开**内存实例**，SQL 里以文件为查询目标；`source` 仍必填且与 SQL 中引用的本地文件路径一致（`source` 是安全闸门锚点，SQL 字面量里的 URL 一律被拒）。
- 读 CSV：replacement scan 让 `FROM '文件路径'` 直接可用，不必写 `read_csv_auto`。读 Excel：官方 `excel` core 扩展默认 autoload，首次查询自动联网下载安装（缓存到 `~/.duckdb/extensions`，之后离线可用），不必手写 `INSTALL` / `LOAD`；需要参数时用 `read_xlsx('data.xlsx', sheet = 'Sheet2')` 等函数形式。
- 写 CSV / Excel：默认关闭，由块字段 `copy_to: <项目相对路径>` 显式开启；服务端把 `SELECT` 包装成 `COPY (<sql>) TO '<target>'`，目标限项目内 `.csv` / `.xlsx` 且禁止覆盖 `.duckdb` 本体，写随块运行触发、幂等覆盖，块内显示"已写入：<路径>"；`sqlite-query` 块不支持 `copy_to`。用户 SQL 不再允许写（`COPY` 已被只读校验拦截），`.duckdb` 数据源本体依旧物理 `READ_ONLY` 不可写。

DuckDB 类型显示（服务端 `toCell` 强制后渲染，见 doc-25 §5.4）：BIGINT → 十进制文本；DECIMAL → 定标十进制串；TIMESTAMP → ISO 字符串；DATE → `YYYY-MM-DD`；BLOB → `<blob N 字节>` 占位；NULL → 空单元格（复制成 Markdown 也是空格子）。

边界：上限 500 行超出截断提示；每块自动跑一次、改库点 Refresh；每块各自开一个只读 DuckDB 实例（不做句柄缓存，doc-25 §5.2）；只读三层里只有物理 `READ_ONLY` 是硬保证；编辑态显示源码不执行。

## Related Sources

- [[sources/doc-25-duckdb-explorer-prd]] — 本演示对应的设计文档（含 §11 CSV/Excel 增补）
- [[sources/doc-24-sqlite-explorer-demo]] — SQLite 侧同构演示（数据逐行一致）
- [[sources/m-12-duckdb-explorer]] — 实施里程碑

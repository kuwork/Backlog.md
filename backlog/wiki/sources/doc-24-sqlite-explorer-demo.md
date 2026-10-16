---
title: doc-24 - SQLite Explorer 演示
labels: [source, guide, sqlite, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/docs/PRDS/sqlite/doc-24 - SQLite-Explorer-演示.md
---

# doc-24 - SQLite Explorer 演示

BACK-773 的验收样本文档：自带小型示例库 `backlog/databases/demo-shop.sqlite`（表 `customers`(20) / `products`(15) / `orders`(80)，视图 `order_details` 为订单 join 客户与商品、含 `amount`），无需准备数据；`bun run src/cli.ts browser --no-open` 打开 Web UI 进入本页即可看到所有 `sqlite-query` 块在阅读视图里实时执行的结果。设计依据见 [[sources/doc-23-sqlite-explorer-prd|doc-23]]（文尾链接写作 doc-16，PRDS/sqlite 目录下无此编号，应为旧编号）。

## 内容要点

六个示例小节覆盖三种视图与三类边界：

1. **表格视图（默认）**：按品类汇总已成交金额（`WHERE status IN ('paid', 'shipped')` + `GROUP BY category`）。
2. **列表视图**：`view: list`，单条记录字段多、横向放不下时竖向 key–value 呈现（示例查客户"张伟"的订单）。
3. **单值视图**：`view: value` 取结果第一行第一列，适合仪表盘式聚合指标。
4. **空结果**：查不到行时渲染空态而非报错。
5. **被拒绝的查询**：`DELETE FROM orders …` 在到达引擎之前被静态校验挡掉；`SELECT 1; DROP TABLE customers` 这类并列语句同样拒绝（只允许末尾一个分号）。
6. **被拒绝的路径**：`../../tmp/escape.sqlite` 越界与前导 `/` 写法一律 fail-closed，块内报错但不影响页面其余部分——`source` 一律按项目相对路径解析是项目安全约定（`wiki/developer-notes/security-gotchas.md` §1，Windows 下 `isAbsolute("/x")` 为真）。

块的写法：四个顶格 `key: value` 字段——`source`（必填，扩展名限 `.sqlite` / `.sqlite3` / `.db`）、`sql`（必填，单条 `SELECT` 或 `WITH … SELECT`，多行用 `sql: |` 块标量）、`view`（默认 `table`）、`refresh`（目前仅 `manual`）。

边界：结果上限 500 行超出截断并提示；每块自动跑一次，改库后点 Refresh 重取；只读三层（语句形状白名单 → 关键字黑名单跳过引号标识符与字符串字面量 → 物理 `readonly` 句柄 + `PRAGMA query_only`），只有第三层是硬保证；编辑态显示原始块源码不执行。

## Related Sources

- [[sources/doc-23-sqlite-explorer-prd]] — 本演示对应的设计文档
- [[sources/m-11-sqlite-explorer]] — 实施里程碑
- [[sources/doc-26-duckdb-explorer-demo]] — DuckDB 侧同构演示（schema 与数据逐行一致）

---
title: doc-33 - MDB (Access) 实况查询演示
labels: [source, guide, mdb]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/docs/PRDS/mdb/doc-33 - MDB-Access-Live-Query-演示.md
---

# doc-33 - MDB (Access) 实况查询演示

MDB（Access）实况查询的验收样本文档（实现见 `src/mdb/`，块写法见 `src/guidelines` 的 Live MDB Query Blocks 小节）。全文 `mdb-query` 块在阅读视图实时执行并渲染；用真实勘察数据库，无需自备数据。

## 数据源

- 数据库：`backlog/assets/lizheng.mdb`（项目相对路径）
- 87 张表（31 张有数据），如 `g_TableName`(69)/`g_YanXing`(175)/`z_ZuanKong`(30)/`g_DiZhi`(137)/`x_GongCheng`(1)
- 理正工程地质库；示例均来自该文件

## 字段与安全约定

- `source` **一律按项目相对路径解析**，不接受前导 `/`（Windows 下 `isAbsolute("/x")` 为真，是安全约定）。
- `lizheng.mdb` 以 GBK（CP936）字节存文本；`mdb-reader` 按 latin1 还原成乱码形态，`mdb-query` 引擎入库前自动按 GBK 还原成正确中文（与离线转换器 `decodeText` 一致）。
- 结果上限 500 行，超出截断并提示；分页模式豁免（每页最大 1000 行）。
- 只读三层：语句形状白名单 → 关键字黑名单（跳过引号标识符与字符串字面量）→ 物理 `PRAGMA query_only=ON`。仅第三层是硬保证。
- 跨表 JOIN 可用（各表载入同一内存 SQLite 实例）。
- `mdb-query` **不支持 `copy_to`**（Access 不能就地写），服务端拒；仅 duckdb-query 支持。

## 块字段

`source`（必，项目相对路径，扩展名限 `.mdb`/`.accdb`）、`sql`（必，单条 SELECT/WITH，只读）、`view`（table/list/value，默认 table）、`refresh`（仅 manual）、`id`（供 echarts `fromQuery` 引用）。

## 联动 ECharts

`id:` 后，同文档 `echarts` 块可用 `fromQuery:` 引用（机制同 BACK-814，与 sqlite 一致）。

## Related Concepts

- [[concepts/mdb-live-query]] — 引擎概念
- [[concepts/sql-query-blocks]] — 第四引擎
- [[concepts/query-chart-binding]] — `fromQuery` 图表联动

## Related Sources

- [[sources/back-832-mdb-live-query]] — 实现与覆盖审计
- [[sources/m-18-mdb-live-query]] — 里程碑

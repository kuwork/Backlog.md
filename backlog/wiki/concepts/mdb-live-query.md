---
title: MDB (Access) 实况查询引擎
labels: [concept, mdb, web-ui]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
---

# MDB (Access) 实况查询引擎

`mdb-query` 围栏代码块让任何 Backlog 文档在阅读视图实时执行 Access（`.mdb`/`.accdb`）查询并渲染结果，由里程碑 m-18（BACK-832~834）交付。它是 `sqlite-query`/`duckdb-query`/`cypher-query` 之后接入同一共享内核的**第四块**，设计参照 doc-33 的验收样本。

## 引擎结构

- `src/mdb/{paths,query,export,block,discover}.ts` 复用 sqlite-query 内核核心（`runSqliteQuery`、网格/分页、`toCell`）。
- `createMdbDatabase`（`query.ts`）用 `mdb-reader` 把每个 Access 表载入内存 SQLite 实例（`PRAGMA query_only=ON`），支持跨表 JOIN 与完整 SQL 面。
- `decodeMdbText`（`query.ts`）：逐字节恢复 GBK/CP936（`charCodeAt & 0xff` → `TextDecoder('gbk')`），替换字符过多时回退原值——修复 `mdb-reader` 按 latin1 还原造成的乱码。
- Web：`MdbQueryBlock` 薄包装 `SqlQueryBlock`（engine id=mdb）；`MermaidMarkdown` 注册 `language-mdb-query` 围栏；服务端加 `/api/mdb/{files,query,export-csv}`。
- 四 locale 加 `mdbQueryBlock` 字典；guideline 文档加 Live MDB Query Blocks 小节。

## 块模型与安全

与 sqlite/duckdb 同构：`source`（项目相对路径，扩展名限 `.mdb`/`.accdb`）、`sql`（单条 SELECT/WITH，只读）、`view`（`table`/`list`/`value`）、`id`（供 echarts `fromQuery`）。安全同四道 fail-closed 闸门：扩展名白名单、只读 SQL 校验、query_only pragma、源路径逃逸拒绝（`source` 不接受前导 `/`，Windows 下 `isAbsolute("/x")` 为真）。

## 与 sqlite/duckdb 的差异

- **不支持 `copy_to`**：Access 文件不能就地写，块内写 `copy_to` 服务端拒；仅 duckdb-query 支持。
- **GBK 解码**：文本字段以 GBK 字节存储，引擎入库前自动还原成正确中文。
- **CLI/MCP 入口无**：与 sqlite/duckdb 一致保持现状（见 BACK-832 决策）。
- 类型亲和度映射：`long/integer/byte/boolean → INTEGER`、`double/float/single/currency/numeric/decimal → REAL`、`text/memo/ole/repid/datetime → TEXT`（datetime→ISO 字符串，ole 二进制→`<blob N 字节>` 占位）。

## 实况查询内联编辑

四个查询块（含 mdb）共享 BACK-833 的就地编辑流：展开查询面板后首行右端出现编辑入口，语法高亮编辑器支持 Save/Test/Discard/Format；Save 写回源 `.md` 并重跑；草稿跨分页/刷新/CSV 导出持续。

## Related Concepts

- [[concepts/sql-query-blocks]] — 四引擎共享内核与块模型
- [[concepts/query-chart-binding]] — `id`/`fromQuery` 图表联动
- [[concepts/markdown-pipeline]] — 文档渲染与序列化流水线

## Related Sources

- [[sources/back-832-mdb-live-query]] — 实现与覆盖审计
- [[sources/back-833-live-query-inline-sql-editor]] — 内联编辑器
- [[sources/back-834-consolidate-query-block-i18n]] — 查询块 i18n 合并
- [[sources/doc-33-mdb-live-query-demo]] — 验收样本
- [[sources/m-18-mdb-live-query]] — 里程碑

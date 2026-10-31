---
title: MDB 查询块
labels: [usermanual]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
---

# MDB 查询块

`mdb-query` 是在文档里嵌入 Access（`.mdb` / `.accdb`）只读查询的第四种实况查询块，与 [SQL 查询块](02-SQL查询块.md) 的 sqlite/duckdb 引擎、[Cypher 查询块](04-Cypher查询块.md) 共享同一套渲染内核。阅读视图会把块渲染成实时查询结果。

## 块语法

````
```mdb-query
source: backlog/assets/lizheng.mdb
view: table
sql: |
  SELECT TNMC AS 表名, TNMS AS 说明
  FROM "g_TableName"
  LIMIT 12
```
````

| 字段 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `source` | 是 | — | Access 数据库路径，**项目相对路径**（不接受前导 `/`，Windows 下 `/x` 会被判为绝对路径） |
| `sql` | 是 | — | 查询语句，支持 `sql: |` 多行写法 |
| `view` | 否 | `table` | `table` / `list` / `value` / `echarts`（直接出图，见 [图表块](../80-图谱与数据查询/06-图表块.md)） |
| `id` | 否 | — | 供 `echarts` 块 `fromQuery` 引用（见 [SQL 查询块](02-SQL查询块.md) 的联动说明） |
| `refresh` | 否 | `manual` | 仅手动刷新 |

## 引擎与安全模型

- Access 库经 `mdb-reader` 把各表载入**内存 SQLite 实例**（`PRAGMA query_only=ON`），再以 SQLite 内核执行，因此支持跨表 JOIN 与完整 SQL 面。
- 沿用与 sqlite/duckdb 相同的四道 fail-closed 闸门：扩展名白名单（仅 `.mdb` / `.accdb`）、只读 SQL 校验（SELECT / WITH 形状 + 关键字黑名单）、`query_only` pragma、源路径逃逸拒绝。
- 结果默认 500 行上限，分页模式豁免（每页最多 1000 行）。

## 中文编码

理正等 Windows 版 Access 导出的旧文件，文本字段以 **GBK（CP936）字节**存储。`mdb-reader` 会按 latin1 还原成乱码形态，而 `mdb-query` 引擎在入库前**自动按 GBK 还原**为正确中文。纯 ASCII 列与所有数值列本就正常，不受影响。

## 与 sqlite/duckdb 的差异

- **不支持 `copy_to`**：Access 文件不能就地写，块内写 `copy_to` 会在服务端被拒（仅 `duckdb-query` 支持）。
- **类型映射**：`long/integer/byte/boolean → INTEGER`（boolean 显示 0/1）；`double/float/single/currency/numeric/decimal → REAL`；`text/memo/ole/repid/datetime → TEXT`（datetime 转 ISO 字符串，ole 二进制显示为 `<blob N 字节>` 占位）；NULL 为空单元格。

## 内联编辑器

`mdb-query` 同样支持 [SQL 查询块](02-SQL查询块.md) 所描述的就地编辑流：展开查询面板后点编辑入口，即可在阅读视图内修改 SQL、Test 试运行、Save 写回源文档并重跑。

## 验收样本

`backlog/docs/PRDS/mdb/doc-33 - MDB-Access-Live-Query-演示.md` 用真实勘察数据库 `backlog/assets/lizheng.mdb`（87 张表）演示了各视图、只读拦截、路径拒绝与 `fromQuery` 联动。

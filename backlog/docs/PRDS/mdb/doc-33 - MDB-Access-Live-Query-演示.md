---
id: doc-33
title: MDB (Access) Live Query 演示
type: guide
created_date: '2026-10-30 14:19'
updated_date: '2026-10-30 14:22'
---
# MDB (Access) Live Query 演示

MDB (Access) live query 的验收样本（实现见 src/mdb/，块写法见 src/guidelines 的 Live MDB Query Blocks 小节）。本文档所有 `mdb-query` 块在阅读视图里都会**实时执行**并把结果渲染出来；下面是一个真实的勘察数据库，不需要你准备数据。

## 数据源

| 项 | 值 |
|---|---|
| 数据库 | `backlog/assets/lizheng.mdb`（项目相对路径） |
| 表 | 87 张（31 张有数据），如 `g_TableName`(69) / `g_YanXing`(175) / `z_ZuanKong`(30) / `g_DiZhi`(137) / `x_GongCheng`(1) |
| 说明 | 理正工程地质库；下文示例均来自该文件 |

> [!IMPORTANT]
> `source` **一律按项目相对路径解析**，不接受前导 `/`。这是项目安全约定：客户端传入的路径必须过 `!isAbsolute()`，而 Windows 下 `isAbsolute("/x")` 为真。

> [!NOTE]
> 编码说明：`lizheng.mdb` 是 Windows 版 Access / 理正软件导出的旧文件，文本字段以 **GBK（CP936）字节**存储。`mdb-reader` 会按 latin1 逐字节还原成字符（`µØÖÊ²»Á¼·ûºÅ±í` 这种形态），`mdb-query` 引擎在入库前会**自动按 GBK 还原**成正确中文（与离线转换器 `MDB转Excel离线转换器.html` 的 `decodeText` 一致），所以网格里的中文是可读的。纯 ASCII 列（如 `TNMC`）与所有数值列本就正常，不受影响。

```bash
bun run src/cli.ts browser --no-open   # 打开 Web UI，进入本页查看渲染结果
```

## 1. 表格视图（默认）

`g_TableName` 是库内「表名 ↔ 中文名」映射。`TNMC` 为 ASCII 列，干净可读；`TNMS` 为 GBK 中文，引擎已自动解码为正确中文（如 `地质不良符号表`）。

```mdb-query
source: backlog/assets/lizheng.mdb
view: table
sql: |
  SELECT TNMC AS 表名, TNMS AS 说明
  FROM "g_TableName"
  LIMIT 12
```

## 2. 列表视图

单条记录字段多、横向放不下时用 `view: list`（本表 53 列）：

```mdb-query
source: backlog/assets/lizheng.mdb
view: list
sql: SELECT * FROM "z_ZuanKong" LIMIT 1
```

## 3. 单值视图

只要一个数（仪表盘式指标）时用 `view: value`，取结果第一行第一列。`z_ZuanKong` 共 30 条钻孔记录：

```mdb-query
source: backlog/assets/lizheng.mdb
view: value
sql: SELECT COUNT(*) AS 钻孔总数 FROM "z_ZuanKong"
```

## 4. 空结果

查不到行时渲染空态，而不是报错。`d_DZBuLiang` 表结构存在但 0 行：

```mdb-query
source: backlog/assets/lizheng.mdb
view: table
sql: SELECT * FROM "d_DZBuLiang"
```

## 5. 被拒绝的查询（只读校验）

写类语句在**到达引擎之前**就被静态校验挡掉，块内直接给出原因：

```mdb-query
source: backlog/assets/lizheng.mdb
sql: DELETE FROM "g_TableName"
```

并列语句同样不接受（只允许末尾一个分号）：

```mdb-query
source: backlog/assets/lizheng.mdb
sql: |
  SELECT 1;
  DROP TABLE "g_TableName"
```

## 6. 被拒绝的路径

越界路径一律 fail-closed，块内报错但**不影响页面其余部分**：

```mdb-query
source: ../../tmp/escape.mdb
sql: SELECT 1
```

前导 `/` 同样被拒（见文首说明）：

```mdb-query
source: /backlog/assets/lizheng.mdb
sql: SELECT 1
```

扩展名不在白名单也会被拒（白名单仅 `.mdb` / `.accdb`；`.sqlite` 不属于 MDB 数据源）：

```mdb-query
source: backlog/assets/not-an-mdb.sqlite
sql: SELECT 1
```

## 7. 联动 ECharts（fromQuery）

`mdb-query` 块加 `id:` 后，同一文档的 `echarts` 块可用 `fromQuery:` 引用其结果（机制同 BACK-814，与 sqlite 一致）。下面把聚合结果直接出柱状图：查询块继续显示表格，图表独立成块。

```mdb-query
source: backlog/assets/lizheng.mdb
id: soilTypes
view: table
sql: |
  SELECT YTLB AS 岩土类别, COUNT(*) AS 种数
  FROM "g_YanXing"
  GROUP BY YTLB
  ORDER BY 种数 DESC
```

```echarts
{
  "dataset": { "fromQuery": "soilTypes" },
  "xAxis": { "type": "category" },
  "yAxis": { "type": "value" },
  "series": [
    { "type": "bar", "encode": { "x": "岩土类别", "y": "种数" } }
  ]
}
```

## 块的写法

字段均为顶格 `key: value`；SQL 多行时用 `sql: |` 块标量：

| 字段 | 必填 | 说明 |
|---|---|---|
| `source` | 是 | 项目相对路径，扩展名限 `.mdb` / `.accdb` |
| `sql` | 是 | 单条 `SELECT` 或 `WITH … SELECT`（只读；写类与并列语句被拦截） |
| `view` | 否 | `table`（默认）/ `list` / `value` |
| `refresh` | 否 | 目前仅 `manual`（默认） |
| `id` | 否 | 供 echarts `fromQuery` 引用（见 §7） |

> [!NOTE]
> `mdb-query` **不支持 `copy_to`**：Access 文件不能就地写，也没有写入路径概念，块内写 `copy_to` 会在服务端被拒。`sqlite-query` 同样不支持；只有 `duckdb-query` 支持。

## MDB 类型怎么映射 / 显示

`mdb-reader` 取出的字段先落进一个内存 SQLite 库（PRAGMA query_only），再复用 sqlite-query 的网格与渲染。类型按如下亲和度映射：

- `long` / `integer` / `byte` / `boolean` → **INTEGER**（`boolean` 渲染为 `0` / `1`）
- `double` / `float` / `single` / `currency` / `numeric` / `decimal` → **REAL**
- `text` / `memo` / `ole` / `repid` / `datetime` → **TEXT**（`datetime` → ISO 字符串；`ole` 的二进制 → `<blob N 字节>` 占位）
- **NULL** → 空单元格（复制成 Markdown 时也是空格子，不会写字面 `NULL`）

## 边界

- 结果上限 500 行，超出截断并在块内提示；分页模式豁免该上限（每页最大 1000 行）。
- 每个块自动跑一次；改了库想重取就点 **Refresh**。
- 只读是三层：语句形状白名单 → 关键字黑名单（跳过引号标识符与字符串字面量）→ 物理 `PRAGMA query_only = ON`。只有第三层是硬保证。
- 编辑态看到的是原始块源码，不执行。
- 跨表 **JOIN** 可用：Access 各表载入同一内存 SQLite 实例，例如 `g_TableName` 与业务表可按 `GCSY` 等键关联查询。

设计依据见 [doc-26](../duckdb/doc-26%20-%20DuckDB-Explorer-演示.md)（DuckDB 同构演示，含 CSV / Excel 数据源）；SQLite 侧对应设计见 [doc-23](../sqlite/doc-23%20-%20SQLite%20Explorer：只读%20SQL%20浏览与查询能力.md)。

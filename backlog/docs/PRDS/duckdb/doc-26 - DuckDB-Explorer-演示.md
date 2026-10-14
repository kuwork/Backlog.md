---
id: doc-26
title: DuckDB Explorer 演示
type: guide
created_date: '2026-10-13 01:30'
updated_date: '2026-10-14 22:00'
---

# DuckDB Explorer 演示

BACK-778 的验收样本（对应 m-12）。本文档所有 `duckdb-query` 块在阅读视图里都会**实时执行**并把结果渲染出来；下面是一个自带的小型示例库，不需要你准备数据。

## 数据源

| 项 | 值 |
|---|---|
| 数据库 | `backlog/databases/demo-shop.duckdb`（项目相对路径） |
| 表 | `customers`(20) / `products`(15) / `orders`(80) |
| 视图 | `order_details`（订单 join 客户与商品，含 `amount`） |

库的 schema 与数据同 `demo-shop.sqlite`（SQLite Explorer 演示所用）逐行一致，只是引擎换成 DuckDB。

```bash
bun run src/cli.ts browser --no-open   # 打开 Web UI，进入本页查看渲染结果
```

> [!IMPORTANT]
> `source` **一律按项目相对路径解析**，不接受前导 `/`。这是项目安全约定（`wiki/developer-notes/security-gotchas.md` §1）：客户端传入的路径必须过 `!isAbsolute()`，而 Windows 下 `isAbsolute("/x")` 为真。

## 1. 表格视图（默认）

按品类汇总已成交金额：

```duckdb-query
source: backlog/databases/demo-shop.duckdb
view: table
sql: |
  SELECT category,
         COUNT(*)                AS orders,
         ROUND(SUM(amount), 2)   AS revenue
  FROM order_details
  WHERE status IN ('paid', 'shipped')
  GROUP BY category
  ORDER BY revenue DESC
```

## 2. 列表视图

单条记录字段多、横向放不下时用 `view: list`：

```duckdb-query
source: backlog/databases/demo-shop.duckdb
view: list
sql: |
  SELECT product, quantity, amount, status, ordered_at
  FROM order_details
  WHERE customer = '张伟'
  ORDER BY ordered_at
  LIMIT 5
```

## 3. 单值视图

只要一个数（仪表盘式指标）时用 `view: value`，取结果第一行第一列：

```duckdb-query
source: backlog/databases/demo-shop.duckdb
view: value
sql: SELECT ROUND(SUM(amount), 2) FROM order_details WHERE status = 'paid'
```

## 4. 空结果

查不到行时渲染空态，而不是报错：

```duckdb-query
source: backlog/databases/demo-shop.duckdb
view: table
sql: SELECT name, city FROM customers WHERE city = '拉萨'
```

## 5. 被拒绝的查询（只读校验）

写类语句在**到达引擎之前**就被静态校验挡掉，块内直接给出原因：

```duckdb-query
source: backlog/databases/demo-shop.duckdb
sql: DELETE FROM orders WHERE id = 1
```

并列语句同样不接受（只允许末尾一个分号）：

```duckdb-query
source: backlog/databases/demo-shop.duckdb
sql: |
  SELECT 1;
  DROP TABLE customers
```

## 6. 被拒绝的路径

越界路径一律 fail-closed，块内报错但**不影响页面其余部分**：

```duckdb-query
source: ../../tmp/escape.duckdb
sql: SELECT 1
```

前导 `/` 同样被拒（见文首说明）：

```duckdb-query
source: /backlog/databases/demo-shop.duckdb
sql: SELECT 1
```

扩展名不在白名单也会被拒（`.sqlite` 不属于 DuckDB 数据源；白名单内容见第 7 节）：

```duckdb-query
source: backlog/databases/demo-shop.sqlite
sql: SELECT 1
```

## 7. CSV / Excel 数据源（BACK-796，已实装）

> [!IMPORTANT]
> 本节示例对应 **BACK-796**（设计见 doc-25 §11），**已实装**：CSV / XLSX 数据源现已可查询与写入。选型结论：**只用官方扩展**——CSV 走内置 `read_csv_auto`（无需扩展），Excel 走官方 `excel` 扩展（`read_xlsx`）；不用 `spatial`（`st_read`，过重）与社区 `rusty_sheet`（供应链信任）。

演示文件与 `demo-shop.duckdb` 同库派生，数据一致：

| 文件 | 内容 |
|---|---|
| `backlog/databases/demo-shop-orders.csv` | `order_details` 全量（80 行，含表头） |
| `backlog/databases/demo-shop.xlsx` | `products` 全量（15 行，含表头） |

非 `.duckdb` 数据源打开的是**内存实例**，SQL 里以文件为查询目标。`source` 仍然必填，且 SQL 中引用的本地文件路径要与 `source` 一致（`source` 是安全闸门的锚点，SQL 字面量里的 URL 一律被拒——设计见 doc-25 §11.4）。

### 7.1 读 CSV（内置，无需扩展）

DuckDB 的 replacement scan 让 `FROM '文件路径'` 直接可用，不必写 `read_csv_auto`：

```duckdb-query
source: backlog/databases/demo-shop-orders.csv
view: table
sql: |
  SELECT category,
         COUNT(*)              AS orders,
         ROUND(SUM(amount), 2) AS revenue
  FROM 'backlog/databases/demo-shop-orders.csv'
  WHERE status IN ('paid', 'shipped')
  GROUP BY category
  ORDER BY revenue DESC
```

### 7.2 读 Excel（官方 excel 扩展）

`excel` 是 core 扩展，DuckDB 默认 autoload：首次查询自动联网下载安装（写入用户目录缓存 `~/.duckdb/extensions`，之后离线可用），**不必手写 `INSTALL` / `LOAD`**；下载失败时块内渲染可读错误。裸路径即可查询：

```duckdb-query
source: backlog/databases/demo-shop.xlsx
view: table
sql: |
  SELECT name, category, price, stock
  FROM 'backlog/databases/demo-shop.xlsx'
  ORDER BY price DESC
  LIMIT 10
```

需要参数时才写函数形式：`read_xlsx('data.xlsx', sheet = 'Sheet2')` 指定工作表、`header = false` 跳过表头、`range = 'A2:E100'` 指定范围。

### 7.3 写 CSV / Excel（可选，字段 `copy_to`）

写能力默认关闭，由块字段 `copy_to: <项目相对路径>` 显式开启；服务端把块里的 `SELECT` 包装成 `COPY (<sql>) TO '<target>'`（`.csv` → `HEADER TRUE`；`.xlsx` → `FORMAT XLSX, HEADER TRUE`），目标走与 `source` 相同的项目内闸门（设计见 doc-25 §11.4）。用户 SQL **不再允许写**——`COPY` 已被只读校验拦截，写只经由 `copy_to`：

```duckdb-query
source: backlog/databases/demo-shop.duckdb
view: table
copy_to: output/orders.csv
sql: |
  SELECT category, COUNT(*) AS orders
  FROM people
  GROUP BY category
```

- 目标扩展名限 `.csv` / `.xlsx`，且禁止写入或覆盖 `.duckdb` 数据库本体。
- 写随块运行（渲染 / 刷新）触发，幂等覆盖；块内显示一行"已写入：<路径>"。
- `sqlite-query` 块不支持 `copy_to`，携带会被服务端拒绝。

无论读写，**`.duckdb` 数据源本体依旧不可写**（物理 `READ_ONLY` 兜底）；写只落在项目目录内的新文件上。

## 块的写法

四个字段，均为顶格 `key: value`；SQL 多行时用 `sql: |` 块标量：

| 字段 | 必填 | 说明 |
|---|---|---|
| `source` | 是 | 项目相对路径，扩展名限 `.duckdb` / `.csv` / `.xlsx`（见第 7 节） |
| `sql` | 是 | 单条 `SELECT` 或 `WITH … SELECT`（只读；`INSTALL` / `LOAD` / `COPY` 均被拦截） |
| `view` | 否 | `table`（默认）/ `list` / `value` |
| `refresh` | 否 | 目前仅 `manual`（默认） |
| `copy_to` | 否 | 仅 `duckdb-query` 支持；项目相对 `.csv` / `.xlsx` 目标，开启写路径（见 §7.3） |

源码形态（本文档第 1 节的块，去掉外层四反引号即为其真实写法）：

````text
```duckdb-query
source: backlog/databases/demo-shop.duckdb
view: table
sql: |
  SELECT category, COUNT(*) AS orders
  FROM order_details
  GROUP BY category
```
````

## DuckDB 类型怎么显示

DuckDB 的 `getRowObjects()` 返回的是包装对象，服务端会先强制成统一的值再渲染（见 doc-25 §5.4）：

- `COUNT(*)` 等 **BIGINT** → 渲染成十进制文本（如 `13`）。
- **DECIMAL(w,s)** → 定标十进制串（如 `3.140`）；**TIMESTAMP** → ISO 字符串；**DATE** → `YYYY-MM-DD`。
- **BLOB** → `<blob N 字节>` 占位（不把二进制塞进文档）。
- **NULL** → 空单元格（复制成 Markdown 时也是空格子，不会写字面 `NULL`）。

## 边界

- 结果上限 500 行，超出截断并在块内提示。
- 每个块自动跑一次；改了库想重取就点 **Refresh**。
- 每个块**各自开一个只读 DuckDB 实例**（DuckDB 不做句柄缓存，见 doc-25 §5.2）。
- 只读是三层：语句形状白名单 → 关键字黑名单（跳过引号标识符与字符串字面量）→ 物理 `READ_ONLY` 访问模式。只有第三层是硬保证。
- 编辑态看到的是原始块源码，不执行。

设计依据见 [doc-25](doc-25%20-%20DuckDB-Explorer：只读-SQL-浏览与查询能力.md)；SQLite 侧的对应设计见 [doc-23](../sqlite/doc-23%20-%20SQLite%20Explorer：只读%20SQL%20浏览与查询能力.md)。

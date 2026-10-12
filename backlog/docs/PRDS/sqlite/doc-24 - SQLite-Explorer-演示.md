---
id: doc-24
title: SQLite Explorer 演示
type: guide
created_date: '2026-10-12 18:03'
---

# SQLite Explorer 演示

BACK-773 的验收样本。本文档所有 `sqlite-query` 块在阅读视图里都会**实时执行**并把结果渲染出来；下面是一个自带的小型示例库，不需要你准备数据。

## 数据源

| 项 | 值 |
|---|---|
| 数据库 | `backlog/databases/demo-shop.sqlite`（项目相对路径） |
| 表 | `customers`(20) / `products`(15) / `orders`(80) |
| 视图 | `order_details`（订单 join 客户与商品，含 `amount`） |

```bash
bun run src/cli.ts browser --no-open   # 打开 Web UI，进入本页查看渲染结果
```

> [!IMPORTANT]
> `source` **一律按项目相对路径解析**，不接受前导 `/`。这是项目安全约定（`wiki/developer-notes/security-gotchas.md` §1）：客户端传入的路径必须过 `!isAbsolute()`，而 Windows 下 `isAbsolute("/x")` 为真。

## 1. 表格视图（默认）

按品类汇总已成交金额：

```sqlite-query
source: backlog/databases/demo-shop.sqlite
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

```sqlite-query
source: backlog/databases/demo-shop.sqlite
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

```sqlite-query
source: backlog/databases/demo-shop.sqlite
view: value
sql: SELECT ROUND(SUM(amount), 2) FROM order_details WHERE status = 'paid'
```

## 4. 空结果

查不到行时渲染空态，而不是报错：

```sqlite-query
source: backlog/databases/demo-shop.sqlite
view: table
sql: SELECT name, city FROM customers WHERE city = '拉萨'
```

## 5. 被拒绝的查询（只读校验）

写类语句在**到达引擎之前**就被静态校验挡掉，块内直接给出原因：

```sqlite-query
source: backlog/databases/demo-shop.sqlite
sql: DELETE FROM orders WHERE id = 1
```

并列语句同样不接受（只允许末尾一个分号）：

```sqlite-query
source: backlog/databases/demo-shop.sqlite
sql: |
  SELECT 1;
  DROP TABLE customers
```

## 6. 被拒绝的路径

越界路径一律 fail-closed，块内报错但**不影响页面其余部分**：

```sqlite-query
source: ../../tmp/escape.sqlite
sql: SELECT 1
```

前导 `/` 同样被拒（见文首说明）：

```sqlite-query
source: /backlog/databases/demo-shop.sqlite
sql: SELECT 1
```

## 块的写法

四个字段，均为顶格 `key: value`；SQL 多行时用 `sql: |` 块标量：

| 字段 | 必填 | 说明 |
|---|---|---|
| `source` | 是 | 项目相对路径，扩展名限 `.sqlite` / `.sqlite3` / `.db` |
| `sql` | 是 | 单条 `SELECT` 或 `WITH … SELECT` |
| `view` | 否 | `table`（默认）/ `list` / `value` |
| `refresh` | 否 | 目前仅 `manual`（默认） |

源码形态（本文档第 1 节的块，去掉外层四反引号即为其真实写法）：

````text
```sqlite-query
source: backlog/databases/demo-shop.sqlite
view: table
sql: |
  SELECT category, COUNT(*) AS orders
  FROM order_details
  GROUP BY category
```
````

## 边界

- 结果上限 500 行，超出截断并在块内提示。
- 每个块自动跑一次；改了库想重取就点 **Refresh**。
- 只读是三层：语句形状白名单 → 关键字黑名单（跳过引号标识符与字符串字面量）→ 物理 `readonly` 句柄 + `PRAGMA query_only`。只有第三层是硬保证。
- 编辑态看到的是原始块源码，不执行。

设计依据见 [doc-16](../PRDS/sqlite/doc-16%20-%20SQLite%20Explorer：只读%20SQL%20浏览与查询能力.md)。

---
title: SQL 查询块
labels: [usermanual]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
---


# SQL 查询块

在文档（docs / Wiki 等 Markdown）里可以用 `sqlite-query` 或 `duckdb-query` 围栏代码块嵌入一条只读 SQL 查询；Web 界面的阅读视图会把块渲染成实时查询结果，而不是死代码。编辑模式下仍显示原始块文本。

## 块语法

````
```sqlite-query
source: backlog/databases/shop.sqlite
view: table
sql: |
  SELECT product, price, stock
  FROM inventory
  ORDER BY price DESC
```
````

| 字段 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `source` | 是 | — | 数据源路径，**项目相对路径**（见下） |
| `sql` | 是 | — | 查询语句，支持 `sql: |` 多行写法 |
| `view` | 否 | `table` | `table`（表格）/ `list`（逐行字段列表）/ `value`（单值） |
| `refresh` | 否 | `manual` | 仅支持手动刷新；自动/定时刷新不支持 |

## 安全约束与只读保证

- `source` 一律按**项目相对路径**解析：绝对路径（含以 `/` 开头）、`..` 逃逸、指向项目外的符号链接、隐藏/排除目录都会被拒绝；扩展名必须在白名单内，SQLite 源还会校验确实是 SQLite 文件。
- SQL 必须只读：只能以 `SELECT` 或 `WITH … SELECT` 开头，不允许内部分号（容忍一个结尾 `;`），写关键字黑名单对注释也生效（注释掉的 `DROP` 同样被拒绝）。
- 真正的兜底在引擎层：SQLite 用只读句柄加 `PRAGMA query_only` 打开，DuckDB 用 `READ_ONLY` 模式打开——即使绕过了文本校验，写操作也会被引擎拒绝。

## 数据源

- `sqlite-query`：`source` 指向项目内的 `.sqlite` / `.sqlite3` / `.db` 文件。
- `duckdb-query`：除 `.duckdb` 数据库外，`source` 还可以直接指向 **CSV / Excel（.csv / .xlsx）文件**——此时 DuckDB 以内存实例打开并直接 `FROM 'file.csv'` 查询；xlsx 依赖官方 excel 扩展的自动加载，首次使用需要联网下载（离线时会显示可读的块错误）。DuckDB 块还支持可选的 `copy_to` 字段把结果另存为项目内的 csv/xlsx 文件。

## 行数上限与分页

- 预览模式默认最多显示 500 行，超出时提示「已截断至 N 行（共 M 行）」，会如实报告总行数。
- 上限可配置：`backlog/config.yml` 的 `query_max_rows`（默认 500，预览模式硬性封顶 5000），Web 设置页的「Query / Data preview」分区同样可以修改。
- 块头部有「分页浏览」开关：开启后结果按页浏览（`← 第 X / Y 页 →`），每页行数由 `pagination_page_size`（默认 50）控制，`default_pagination: true` 可让块默认进入分页模式。分页是真正的引擎侧分页（`LIMIT`/`OFFSET` 下推 + 单独 `COUNT(*)`），因此**不受 5000 行上限约束**，适合浏览大结果集。
- 表格视图与列表视图都带行号（`#` / 序号）列，分页模式下显示全局行号。

## 块上的四个动作

| 动作 | 说明 |
|------|------|
| Refresh | 重新执行查询，刷新结果 |
| Show/Hide Query | 展开/收起只读的 `source` 与 SQL 面板（默认收起；不发出请求） |
| Copy Markdown | 把当前结果以 GitHub 风格 Markdown 表格复制到剪贴板（`value` 视图复制标量；NULL 为空单元格） |
| Export CSV | 把结果导出为 CSV 文件（UTF-8 BOM + CRLF，Excel 可直接打开中文）；SQLite 块写入数据库旁的 `<库名>-<时间戳>.csv`（绝不覆盖），DuckDB 块由浏览器保存文件；导出沿用预览行数上限 |

四个动作对两种引擎的块完全一致。设置页的修改会通过广播即时生效，无需刷新页面。

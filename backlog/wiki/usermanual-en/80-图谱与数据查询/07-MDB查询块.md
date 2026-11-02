---
title: MDB Query Blocks
labels: [usermanual]
created_date: 2026-10-31 23:53
updated_date: 2026-11-04 00:00
---

# MDB Query Blocks

`mdb-query` is the fourth live query block for embedding read-only Access (`.mdb` / `.accdb`) queries in documents. It shares the same rendering kernel as the sqlite/duckdb engines of [SQL Query Blocks](02-SQL查询块.md) and [Cypher Query Blocks](04-Cypher查询块.md). The reading view renders the block as a live query result.

## Block Syntax

````markdown
```mdb-query
source: backlog/assets/lizheng.mdb
view: table
sql: |
  SELECT TNMC AS table_name, TNMS AS description
  FROM "g_TableName"
  LIMIT 12
```
````

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `source` | Yes | — | Access database path, **project-relative** (no leading `/`; on Windows `/x` is treated as an absolute path) |
| `sql` | Yes | — | Query statement; supports multi-line `sql: \|` syntax |
| `view` | No | `table` | `table` / `list` / `value` / `echarts` (render a chart directly; see [Chart Blocks](../80-图谱与数据查询/06-图表块.md)) |
| `id` | No | — | For `echarts` blocks to reference via `fromQuery` (see the linkage explanation in [SQL Query Blocks](02-SQL查询块.md)) |
| `refresh` | No | `manual` | Manual refresh only |

## Engine and Security Model

- Access databases are loaded by `mdb-reader` into an **in-memory SQLite instance** (`PRAGMA query_only=ON`), and then executed with the SQLite kernel, so cross-table JOINs and the full SQL surface are supported.
- Uses the same four fail-closed gates as sqlite/duckdb: extension whitelist (only `.mdb` / `.accdb`), read-only SQL validation (SELECT / WITH shape + keyword blacklist), `query_only` pragma, and source path escape rejection.
- Default result limit is 500 rows; pagination mode is exempt (up to 1000 rows per page).

## Chinese Encoding

Old files exported by Windows versions of Access such as Lizheng store text fields as **GBK (CP936) bytes**. `mdb-reader` restores them as garbled Latin1, but the `mdb-query` engine **automatically re-encodes them as correct Chinese** via GBK before loading into the database. Pure ASCII columns and all numeric columns are already normal and unaffected.

## Differences from sqlite/duckdb

- **No `copy_to` support**: Access files cannot be written in place, so writing `copy_to` in the block is rejected server-side (only `duckdb-query` supports it).
- **Type mapping**: `long/integer/byte/boolean → INTEGER` (boolean displays as 0/1); `double/float/single/currency/numeric/decimal → REAL`; `text/memo/ole/repid/datetime → TEXT` (datetime converted to ISO string, ole binary shown as `<blob N bytes>` placeholder); NULL becomes an empty cell.

## Inline Editor

`mdb-query` also supports the in-place editing flow described in [SQL Query Blocks](02-SQL查询块.md): after expanding the query panel, click the edit entry to modify SQL in the reading view, Test to dry-run, and Save to write back to the source document and re-run.

## Acceptance Sample

`backlog/docs/PRDS/mdb/doc-33 - MDB-Access-Live-Query-演示.md` demonstrates all views, read-only interception, path rejection, and `fromQuery` linkage using the real survey database `backlog/assets/lizheng.mdb` (87 tables).

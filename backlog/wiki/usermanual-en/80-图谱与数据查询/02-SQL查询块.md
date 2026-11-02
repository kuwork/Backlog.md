---
title: SQL Query Blocks
labels: [usermanual]
created_date: 2026-10-16 01:00
updated_date: 2026-11-04 00:00
---

# SQL Query Blocks

In documents (docs / Wiki and other Markdown), you can embed a read-only query using `sqlite-query`, `duckdb-query`, or `mdb-query` fenced code blocks; the Web interface reading view renders the block as a live query result instead of dead code. In edit mode the original block text is still shown. `mdb-query` uses an Access database as the data source; its syntax and fields are the same as this page. See [MDB Query Blocks](07-MDB查询块.md) for details.

## Block Syntax

````markdown
```sqlite-query
source: backlog/databases/shop.sqlite
view: table
sql: |
  SELECT product, price, stock
  FROM inventory
  ORDER BY price DESC
```
````

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `source` | Yes | — | Data source path, **project-relative** (see below) |
| `sql` | Yes | — | Query statement; supports multi-line `sql: \|` syntax |
| `view` | No | `table` | `table` (grid), `list` (field list per row), `value` (single value), or `echarts` (render a chart directly; see [Chart Blocks](06-图表块.md)) |
| `refresh` | No | `manual` | Only manual refresh is supported; automatic / scheduled refresh is not supported |

## Security Constraints and Read-Only Guarantee

- `source` is always resolved as a **project-relative path**: absolute paths (including leading `/`), `..` escapes, symlinks pointing outside the project, and hidden/excluded directories are rejected. Extensions must be on the whitelist, and SQLite sources are also validated to actually be SQLite files.
- SQL must be read-only: it must start with `SELECT` or `WITH … SELECT`, no internal semicolons are allowed (a trailing `;` is tolerated), and the write-keyword blacklist also applies to comments (a commented-out `DROP` is still rejected).
- The real safeguard is at the engine layer: SQLite is opened with a read-only handle plus `PRAGMA query_only`, and DuckDB is opened in `READ_ONLY` mode—even if text validation is bypassed, write operations are rejected by the engine.

## Data Sources

- `sqlite-query`: `source` points to a `.sqlite` / `.sqlite3` / `.db` file inside the project.
- `duckdb-query`: in addition to `.duckdb` databases, `source` can directly point to a **CSV / Excel (.csv / .xlsx) file**—DuckDB then opens an in-memory instance and queries it directly with `FROM 'file.csv'`; xlsx relies on the official excel extension auto-loading, which requires an internet download on first use (offline environments show a readable block error). DuckDB blocks also support an optional `copy_to` field to save results as a csv/xlsx file inside the project.

## Row Limit and Pagination

- Preview mode displays at most 500 rows by default; when exceeded, a hint "Truncated to N rows (M total)" is shown, and the total row count is reported truthfully.
- The limit is configurable via `query_max_rows` in `backlog/config.yml` (default 500, hard cap 5000 in preview mode), and can also be changed in the Web settings page under "Query / Data preview".
- The block header has a "Paginated browse" toggle: when enabled, results are browsed by page (`← Page X / Y →`), with rows per page controlled by `pagination_page_size` (default 50). `default_pagination: true` can make blocks enter pagination mode by default. Pagination uses true engine-side paging (`LIMIT`/`OFFSET` pushdown + separate `COUNT(*)`), so it is **not constrained by the 5000-row limit** and is suitable for browsing large result sets.
- Both table view and list view show a row-number (`#` / sequence) column; global row numbers are shown in pagination mode.

## Four Block Actions

| Action | Description |
|--------|-------------|
| Refresh | Re-run the query and refresh the results |
| Show/Hide Query | Expand/collapse the read-only `source` and SQL panel (collapsed by default; does not issue a request) |
| Copy Markdown | Copy the current results as a GitHub-flavored Markdown table to the clipboard (`value` view copies the scalar; NULL becomes an empty cell) |
| Export CSV | Export the results as a CSV file (UTF-8 BOM + CRLF, Excel can open Chinese directly). SQLite blocks write `<database>-<timestamp>.csv` next to the database (never overwriting); DuckDB blocks save the file via the browser. Export follows the preview row limit. |

The four actions are identical across blocks for all four engines. Changes in the settings page take effect immediately via broadcast without refreshing the page.

## Editing Inside Reading View

After expanding the query panel, an edit entry appears at the right end of the first line: in edit mode, the SQL/Cypher statement becomes a syntax-highlighted editor. Click Save to write the new statement back to the source Markdown and re-run immediately, Test to run a dry-run validation without writing to disk, or Discard to restore the original statement. SQL engines also have a Format button to reformat indentation in place (does not write to the file). This feature is common to `sqlite-query`, `duckdb-query`, `mdb-query`, and `cypher-query` blocks; blocks without a known source path (such as milestone descriptions) remain read-only.

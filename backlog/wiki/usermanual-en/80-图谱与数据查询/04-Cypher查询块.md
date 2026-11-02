---
title: Cypher Query Blocks
labels: [usermanual]
created_date: 2026-10-18 01:00
updated_date: 2026-11-04 00:00
---

# Cypher Query Blocks

In documents (tasks / documents / decisions / Wiki and other Markdown), you can embed a read-only Cypher query using a `cypher-query` fenced code block; the Web interface reading view renders the block as a live query result, while edit mode still shows the original block text. It is the **graph-database counterpart** to [SQL Query Blocks](02-SQL查询块.md): the interaction semantics and security model are the same, only the execution stack is replaced with a graph engine.

````markdown
```cypher-query
source: demo
view: graph
refresh: auto
query: |
  MATCH (p:Person)-[r:WORKS_AT]->(c:Company)
  RETURN p, r, c
```
````

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `source` | Yes | — | **Database registered name** (a name listed by `backlog graph list`), not a file path |
| `query` | Yes | — | Query statement; supports multi-line `query: \|` syntax; must be read-only |
| `view` | No | `table` | `table` (grid), `list` (field list per row), `value` (single value), `graph` (force-directed graph), or `echarts` (render a chart directly; see [Chart Blocks](06-图表块.md)) |
| `refresh` | No | `manual` | `manual` (manual) / `auto` (re-run automatically when graph data changes) |

Unknown fields cause an error and list available fields; they are not silently ignored.

## `source` Is a Registered Name, Not a Path

The `source` of SQL blocks is a project-relative file path, while Cypher blocks always use a **registered name**—graph databases are directory-based storage and have no single-file semantics. Unregistered names and any path-like values (relative paths, absolute paths, `..`) are rejected; the block shows a readable error and lists available database names.

## Four Views

| View | Rendering |
|------|-----------|
| `table` | Standard grid, one record per row |
| `list` | Each record as a vertical key–value list |
| `value` | Only the first row and first cell, inline plain text (good for embedding an aggregate value) |
| `graph` | Force-directed graph rendering of nodes and relationships, sharing the same legend configuration as the Databases page |

When `graph` view results exceed about 3000 nodes, it automatically degrades to a table with an explanation. Cypher return values include scalars, nodes, relationships, and paths: nodes are serialized as JSON after stripping internal handles, relationships are rendered as `(start)-[type]->(end)`, and paths are compact strings of alternating nodes and relationships—the `graph` view uses the raw structure directly.

## Live Refresh

`refresh: auto` subscribes to graph data change broadcasts: after graph content changes, the block automatically re-runs after a short quiet period (500 milliseconds); continuous changes during batch imports trigger only one re-run. When the result is the same as the current value, it does not re-render, avoiding flicker. The block header shows a Live badge and a pause/resume toggle; pausing only stops re-runs. This capability depends on the graph database having change broadcasts—currently only the derived corpus graph has this; writing `refresh: auto` for user databases behaves the same as manual refresh.

## Read-Only Guarantee

Write Cypher (`CREATE` / `MERGE` / `DELETE` / `SET` / `DROP` / `UPDATE`) is rejected and shows an error inside the block; query blocks structurally cannot touch the write path.

## Row Limit and Block Actions

- The row limit is the same as SQL blocks, taken from the configured query row limit (default 500, hard cap 5000); when exceeded, the block truncates and shows a hint. Cypher **does not provide pagination**—if the limit is exceeded, change the query rather than paginating.
- The four block-header actions are consistent with SQL blocks: Refresh (re-execute), Show/Hide Query (expand/collapse the read-only `source` and statement, collapsed by default; expanding does not trigger a query; the statement has syntax coloring consistent with the code block), Copy Markdown (copy as GitHub-flavored table), Export CSV (export as a CSV file).
- Empty results and errors both have explicit copy; there are no silently blank blocks.

## Query Writing Notes

The graph engine currently does not support untyped relationship patterns (`-[r]->` matches no rows) or multi-type unions (`-[r:A|B]->` errors), so queries must specify concrete relationship types.

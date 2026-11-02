---
title: Graph MCP Tools
labels: [usermanual]
created_date: 2026-10-16 01:00
updated_date: 2026-11-04 00:00
---

# Graph MCP Tools

The Backlog.md MCP server provides a set of `graph_*` tools that let AI agents directly query the project's task/knowledge graph and user databases. Their capabilities correspond one-to-one with the CLI `backlog graph` subcommands. The accompanying MCP usage guide is available through `get_backlog_instructions` (or the resource `backlog://workflow/graph`), and mirrors the CLI guide from `backlog instructions graph`.

## Six Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `graph_query` | Run read-only Cypher against `default` or a user database, returning columns and rows | `readOnlyHint`; write keywords (CREATE/MERGE/SET/DELETE/DROP, etc.) are rejected |
| `graph_schema` | Return a database's schema: node tables and properties, relationship tables and endpoints | `readOnlyHint` |
| `graph_list_databases` | List `default` and all user databases with metadata (name, kind, size) | `readOnlyHint`, no required parameters |
| `graph_describe_database` | Return a single database's description, timestamp, and per-table row/edge counts | `readOnlyHint` |
| `graph_create_database` | Create a user database (`name` + `description`) | `destructiveHint`; must explicitly pass `acknowledged: true` to write |
| `graph_import_csv` | Import CSV into a user database: by default imports as nodes (missing tables auto-created with inferred types, upsert by primary key); add `rel`/`from`/`to` to import as edges (endpoints matched but not created) | `destructiveHint`; files are fully validated before opening the database, so format errors have no side effects |

When the database does not exist, query tools return a clear error (and list available databases); write tools always reject the read-only `default`.

## One-Shot Switch Model

Graph MCP tools **do not hold a long-lived GraphService**: each call goes through a one-shot flow of "open → prepare → execute → close". Specifically:

- `default` uses the derived graph snapshot reuse (same path as the CLI), keeping results consistent with the Web interface.
- User databases are hydrated from their JSON snapshots, and write tools re-persist the snapshot after execution.
- Therefore agents do not need to manage connections, and there is no contention with the Web server process for the same graph.

## Relationship to CLI

Tool parameters correspond to CLI subcommands: `graph_query(db, statement)` ↔ `backlog graph query <db> [cypher]`, `graph_import_csv(db, csv, …)` ↔ `backlog graph import <db> <csv>`, and so on. Relative paths in `graph_import_csv` are resolved against the project root, not the MCP process's current directory.

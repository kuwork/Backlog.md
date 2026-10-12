---
id: m-11
title: SQLite Explorer
created_date: '2026-10-13 01:14'
updated_date: '2026-10-12 18:21'
actual_end: '2026-10-12 18:21'
documentation:
  - backlog/docs/PRDS/sqlite/doc-16 - SQLite Explorer：只读 SQL 浏览与查询能力.md
---
## Description

Add a read-only SQLite Explorer to Backlog.md, modelled on the Obsidian *SQLite Explorer* plugin (https://community.obsidian.md/plugins/sqlite-explorer) but executed server-side on `bun:sqlite` instead of sql.js/WASM.

Phase 1 scope (doc-16): **markdown code blocks only**. A `sqlite-query` fenced block in any Backlog document renders live query results in reading view with `table` / `list` / `value` display modes, plus Refresh and Embed (static timestamped Markdown snapshot) actions. Data sources are **any `.sqlite` / `.sqlite3` / `.db` file under the project root** (excluding `node_modules`, `.git`, `dist`, `build`, `.locks` and dot-directories other than `.backlog`), always addressed by a **project-relative path** (a leading `/` is refused, per the project's standing rule that client-supplied paths must be relative — security-gotchas.md §1); every request is forced read-only (`readonly` handle + `PRAGMA query_only`) and capped at 500 rows. `<backlog>/databases/` is merely a conventional place to keep them, not a boundary.

Explicitly out of scope for this milestone: a standalone database browser view, table selector / schema panel, CSV export, CLI subcommands, MCP tools, and registering SQLite files in `databases/registry.json` (that registry describes graph databases only).

High-level tasks:
1. Core — block parser (YAML subset: `source` / `sql` / `view` / `refresh`), path resolution + four fail-closed gates (no leading `/`, no absolute path, no `..` escape, realpath inside the project root, extension + SQLite magic check), read-only SQL validation (SELECT/WITH shape, keyword blacklist that ignores quoted identifiers and string literals but keeps comments). Extract the exclude-dir set already used by `searchProjectFiles` (`src/file-system/operations.ts`) into a shared constant instead of re-declaring it.
2. Server — `POST /api/sqlite/query` returning `{ columns, rows, truncated, elapsedMs, dbPath }`, with a per-realpath handle cache (shared across blocks, closed on 60s idle); `GET /api/sqlite/files` lists the project's SQLite files (30s cache) so a block author can see what exists.
3. Web — `sqlite-query` fence branch in the `MermaidMarkdown` render chain mounting a `SqliteQueryBlock` component: three view modes, loading / error / empty / truncated states, Refresh and Embed actions.
4. Server + Web — Embed writes a timestamped Markdown table back in place, only when the original block text matches exactly; otherwise it errors without touching the file.
5. Tests and gates — parser, path guards, read-only validation (including the engine-level rejection path), handle reuse, truncation, Embed write/no-write; `bunx tsc --noEmit`, `bun run check .`, scoped tests green.

Design source: doc-16 (§9 carries the acceptance criteria).

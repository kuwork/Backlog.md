---
id: m-12
title: DuckDB Explorer
created_date: '2026-10-13 07:55'
updated_date: '2026-10-13 03:11'
documentation:
  - backlog/docs/PRDS/duckdb/doc-25 - DuckDB-Explorer：只读-SQL-浏览与查询能力.md
---
## Description

Add DuckDB support to Backlog.md, mirroring the SQLite Explorer delivered in m-11 but executing server-side on `@duckdb/node-api` (the official N-API binding) instead of `bun:sqlite`. The two engines share one design: a `duckdb-query` fenced block in any Backlog document renders live, read-only query results in reading view with `table` / `list` / `value` modes, plus Refresh, Show/Hide Query, Copy Markdown and Export CSV. Data sources are **any `.duckdb` file under the project root**, always addressed by a **project-relative path** (same standing rule as SQLite: client-supplied paths must be relative — security-gotchas.md §1); every request is forced read-only (DuckDB opened in `READ_ONLY` access mode) and capped at 500 rows.

Reuse, do not duplicate: `src/sqlite/validation.ts` (read-only SQL shape + keyword blacklist is engine-agnostic), `src/sqlite/markdown.ts` and `src/sqlite/csv.ts` (serialisation only touches a generic `{ columns, rows }` grid) are shared verbatim. The `SqliteQueryBlock` React component is refactored into a generic `SqlQueryBlock` parameterised by an **engine config** (block language, i18n namespace, api methods), with `SqliteQueryBlock` kept as a thin SQLite wrapper so the m-11 surface is unchanged. Only the driver-specific pieces are new: `src/duckdb/block.ts` (language constant), `discover.ts` (`.duckdb` extension), `paths.ts` (resolve + header check), `query.ts` (`@duckdb/node-api` readonly execution + JSON-safe type coercion), `export.ts` (`buildDuckdbCsv` wrapper).

A feasibility spike (BACK-777) runs first: `@duckdb/node-api` must import and run a read-only query under `bun` (the server runtime) before any of the engine work is built. If the native binding cannot load in Bun, the fallback is `@duckdb/duckdb-wasm`.

Explicitly out of scope for this milestone: a standalone database browser view, table selector / schema panel, CLI subcommands, MCP tools, and registering DuckDB files in `databases/registry.json`. Embed remains deferred (same as m-11).

High-level tasks:
1. Spike - confirm `@duckdb/node-api` imports and runs read-only queries in Bun, and that DuckDB-specific types coerce to the shared `SqliteCell` contract (BACK-777).
2. Core + Web - `duckdb-query` fence renders live results: generic `SqlQueryBlock` + engine config, `src/duckdb/` engine module (parser reuse, discover, paths, query, export wrapper), `POST /api/duckdb/query` + `GET /api/duckdb/files`, api client methods, `duckdb-query` branch in `MermaidMarkdown`, `duckdbQueryBlock` locales (4 languages), three view modes, loading/error/empty/truncated, Refresh (BACK-778, mirrors BACK-773).
3. Web - Show/Hide Query toggle for `duckdb-query` blocks (locale wiring + shared-toggle verification, BACK-779, mirrors BACK-774).
4. Web - Copy Markdown for `duckdb-query` results (shared `markdown.ts`; locale wiring + hide-when-empty contract, BACK-780, mirrors BACK-775).
5. Server + Web - Export CSV for `duckdb-query` results (`buildDuckdbCsv` + `POST /api/duckdb/export-csv` + shared save-where-user-picks; locale wiring, BACK-781, mirrors BACK-776).
6. Tests and gates - parser, path guards, read-only validation (shared), DuckDB handle/type coercion, truncation, CSV quoting/naming/refusal-before-build; `bunx tsc --noEmit`, `bun run check .`, scoped tests green.

Design source: doc-23 (SQLite Explorer — the read-only + security model carries over unchanged) and doc-25 (the DuckDB-specific design); engine-specific deltas are captured in the tasks.

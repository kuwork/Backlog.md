---
id: BACK-777
title: Verify DuckDB native binding (`@duckdb/node-api`) loads and runs read-only queries in Bun
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 07:55'
updated_date: '2026-10-13 08:11'
actual_start: '2026-10-13 08:00'
actual_end: '2026-10-13 08:11'
labels:
  - web-ui
  - duckdb
milestone: m-12
dependencies: []
documentation:
  - backlog/docs/PRDS/sqlite/doc-16 - SQLite Explorer：只读 SQL 浏览与查询能力.md
modified_files: []
ordinal: 336001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Before any DuckDB engine work is built (m-12), confirm the chosen binding actually runs under `bun` — the exact runtime that serves `src/server`. Install `@duckdb/node-api` and prove three things: (1) it imports without error in Bun; (2) a `.duckdb` file can be opened in `READ_ONLY` access mode and a `SELECT` executed; (3) the DuckDB-specific value types coerce to the shared `SqliteCell` contract (`string | number | boolean | null`) that `src/sqlite/markdown.ts`, `src/sqlite/csv.ts` and `src/web/lib/api.ts` already depend on. Document the exact API calls (instance create with `READ_ONLY`, connect, `runAndReadAll`) and the type-coercion map. If the native binding cannot load in Bun, the fallback decision is `@duckdb/duckdb-wasm` and this task records why.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
 - [x] #1 `@duckdb/node-api` imports under `bun` with no error (the same runtime as `src/server`), not only under `node`.
 - [x] #2 A `.duckdb` file opens in `READ_ONLY` mode and answers a `SELECT` (no write possible).
 - [x] #3 At least INTEGER/BIGINT, DECIMAL, DOUBLE, VARCHAR, BOOLEAN, TIMESTAMP, DATE, BLOB and NULL each coerce to a JSON-safe `SqliteCell` (string | number | boolean | null).
 - [x] #4 The exact binding API + readonly-open incantation + type map are recorded in the task notes; if native load fails, the WASM fallback is documented with the reason.
 - [x] #5 The spike does not break existing gates: `bunx tsc --noEmit`, `bun run check .`, and existing suites stay green (spike code lives in a scratch script, not committed to `src/` unless reused).
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
 - [x] #1 bunx tsc --noEmit passes when TypeScript touched
 - [x] #2 bun run check . passes when formatting/linting touched
 - [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `bun add @duckdb/node-api` (or the project's dependency mechanism) and attempt `import { DuckDBInstance } from "@duckdb/node-api"` inside a `bun`-run script.
2. Create a throwaway `.duckdb` (or reuse a fixture), open with `accessMode: READ_ONLY`, connect, `runAndReadAll` a multi-type `SELECT`.
3. Inspect `columnTypes()` / row values; build a `toCell` map that yields `SqliteCell`.
4. Record the working snippet + coercion table in Implementation Notes; if step 1 fails, document the WASM fallback.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Go: native binding loads and runs read-only under Bun
- `bun add @duckdb/node-api` → `@duckdb/node-api@1.5.6-r.1`, installs clean under Bun 1.3.13 (Windows x64); imports with no error.
- Open read-only: `DuckDBInstance.create(path, { access_mode: "READ_ONLY" })`. This build exposes **no** `DuckDBAccessMode` enum — the config is a plain `Record<string, string>` of DuckDB config keys, and `access_mode` is the one that matters. A `CREATE` against the read-only handle throws `Invalid Input Error: Cannot execute statement of type "CREATE" on database … attached in read-only mode`, so the engine itself is the load-bearing read-only layer, exactly like SQLite's `PRAGMA query_only`.
- Close is **synchronous**: `connection.closeSync()` / `instance.closeSync()` (there is no async `close()`).
- Query: `connection.runAndReadAll(sql)` → `DuckDBResultReader`; `reader.columnNames()` + `reader.getRowObjects()` (sync, returns `Record<string, DuckDBValue>[]`). `getRowObjectsJS()` is NOT on the reader in this build (only on the materialised `DuckDBResult`), so coercion is done from the typed `DuckDBValue` wrappers directly.

### Type coercion map (DuckDB → shared `SqliteCell` = string | number | boolean | null)
`getRowObjects()` returns wrapper objects for everything past the JS primitives. Confirmed from a one-row multi-type `SELECT`:

| DuckDB type | `getRowObjects()` shape | coercion to `SqliteCell` |
|---|---|---|
| INTEGER | `number` | pass through |
| BIGINT | `bigint` | `String(bigint)` (same as SQLite `toCell`) |
| DOUBLE | `number` | pass through |
| DECIMAL(w,s) | `{ width, scale, value: "<integer string>" }` | decimal string using `scale` (value `"12345"` scale 3 → `"12.345"`); never the raw integer form |
| VARCHAR | `string` | pass through |
| BOOLEAN | `boolean` | pass through |
| TIMESTAMP | `{ micros: "<string>" }` | `new Date(Number(micros) / 1000).toISOString()` |
| DATE | `{ days: <int> }` | epoch days → `new Date(days * 86400000).toISOString().slice(0, 10)` |
| BLOB | `{ bytes: Buffer }` | `<blob N 字节>` (N = `bytes.length`), matching the SQLite `toCell` wording |
| NULL | `null` | pass through |

So `src/duckdb/query.ts` needs its own `toCell` that switches on the wrapper type. The safest discriminator is `reader.columnTypes()[i].typeId` (4=INTEGER, 5=BIGINT, 11=DOUBLE, 19=DECIMAL, 17=VARCHAR, 1=BOOLEAN, 12=TIMESTAMP, 13=DATE, 18=BLOB) with a `typeof` fallback for NULL/primitives. Unlike SQLite's `toCell` (which mostly sees primitives), this one must unwrap the DuckDB value objects.

### Decision
Native binding confirmed → proceed with `@duckdb/node-api`. WASM fallback (`@duckdb/duckdb-wasm`) not needed. `@duckdb/node-api` is now a runtime dependency (added to `package.json` by the spike; `bun.lockb` updated).

### Scratch artifact
`scripts/duckdb-spike.ts` (untracked) is the reproducible verification; it is not shipped in `src/`. Keep as a reference or delete before the m-12 work is committed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
The chosen DuckDB binding (`@duckdb/node-api`) is confirmed to work under `bun` (the server runtime): it imports, opens a `.duckdb` in `READ_ONLY` mode, and rejects writes with an engine-level error — the same load-bearing read-only guarantee SQLite gets from `PRAGMA query_only`. A reproducible spike (`scripts/duckdb-spike.ts`) populated a multi-type table and read it back, establishing the exact coercion map DuckDB's value wrappers require: BIGINT→string, DECIMAL→scaled decimal string, TIMESTAMP/DATE→ISO, BLOB→`<blob N 字节>`, the rest pass through. `@duckdb/node-api@1.5.6-r.1` is now a runtime dependency. WASM fallback is unnecessary. This unblocks BACK-778..781.
<!-- SECTION:SUMMARY:END -->

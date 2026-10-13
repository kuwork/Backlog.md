---
id: BACK-778
title: Make `duckdb-query` code blocks render live results
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 07:55'
updated_date: '2026-10-13 08:30'
labels:
  - web-ui
  - duckdb
milestone: m-12
dependencies:
  - BACK-777
documentation:
  - backlog/docs/PRDS/sqlite/doc-16 - SQLite Explorer：只读 SQL 浏览与查询能力.md
modified_files: []
ordinal: 337001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the `duckdb-query` fenced code block work end to end (m-12 task 2, mirrors BACK-773). New `src/duckdb/` engine module: a language constant + the **reused** YAML-subset parser (parameterised by language), `discover.ts` for `.duckdb` files, `paths.ts` resolving `source` as a project-relative path behind the same four fail-closed gates as SQLite (with a `.duckdb` extension whitelist and a DuckDB storage-header / try-open check), and `query.ts` running the statement server-side on `@duckdb/node-api` in READ_ONLY mode with the shared 500-row cap and a per-realpath idle handle cache. The `SqliteQueryBlock` component is refactored into a generic `SqlQueryBlock` parameterised by an engine config (block language, i18n namespace, api methods, fetchFiles); `SqliteQueryBlock` remains as a thin SQLite wrapper so the m-11 surface is byte-for-byte unchanged. The server exposes `POST /api/duckdb/query` and `GET /api/duckdb/files`; the Web UI renders the fence in reading view with `table` / `list` / `value` views, loading / error / empty / truncated states and a Refresh action. Read-only SQL validation is **reused** from `src/sqlite/validation.ts` (engine-agnostic) — no new validation module.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Generic block parser accepts `source` / `sql` (inline or `|` block scalar) / `view` / `refresh` for the `duckdb-query` language; missing/unknown fields and illegal `view` fail readably.
- [x] #2 Read-only validation reused from `src/sqlite/validation.ts` (SELECT/WITH shape + keyword blacklist, quote/comment-aware); no new validation file.
- [x] #3 Path resolution: `source` always project-relative; refused: leading `/`, absolute paths, `..` escapes, symlinks leaving project, excluded/hidden dirs, non-`.duckdb` extensions, non-DuckDB files.
- [x] #4 `POST /api/duckdb/query` returns the same `{ columns, rows, truncated, elapsedMs, dbPath }` shape as SQLite (so the shared types/UI work); failures return 400 with a Chinese reason.
- [x] #5 `GET /api/duckdb/files` lists project `.duckdb` files with a 30s cache.
- [x] #6 Generic `SqlQueryBlock` renders a `duckdb-query` fence (table/list/value) with loading/error/empty/truncated + Refresh; the existing `sqlite-query` path is unchanged via its wrapper; edit mode keeps raw source.
- [x] #7 `bunx tsc --noEmit`, `bun run check .`, and the new duckdb suite stay green.
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Refactor `SqliteQueryBlock.tsx` → generic `SqlQueryBlock` taking an engine config; keep `SqliteQueryBlock` as a SQLite-config wrapper.
2. `src/duckdb/block.ts` — language constant (`DUCKDB_BLOCK_LANG = "duckdb-query"`) + reuse the parser from `src/sqlite/block.ts` via a parameterised entry.
3. `src/duckdb/paths.ts` — `resolveDuckdbSource` / `isDuckdbFileName` / header check (mirror `src/sqlite/paths.ts` gates).
4. `src/duckdb/query.ts` — `@duckdb/node-api` READ_ONLY execution, 500-row cap, idle handle cache, JSON-safe `toCell` using the BACK-777 coercion map; reuse `SQLITE_MAX_ROWS` semantics.
5. `src/duckdb/discover.ts` — project-wide `.duckdb` listing, 30s cache (mirror `src/sqlite/discover.ts`).
6. Server: register `/api/duckdb/query` and `/api/duckdb/files`; reuse `validateReadOnlySql`.
7. Web: apiClient `runDuckdbQuery` / `fetchDuckdbFiles` + `duckdbQueryBlock` i18n strings (4 langs) + `duckdb-query` branch in `MermaidMarkdown`.
8. Tests: parser, path gates, DuckDB execution + type coercion, discovery; then tsc / biome / scoped tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Notes

### Shared core, per-engine wrappers
- The YAML-subset parser in `src/sqlite/block.ts` is now engine-agnostic (`parseQueryBlock`, returns `QueryBlock`/`QueryBlockParse`). `parseSqliteQueryBlock` / `parseDuckdbQueryBlock` are aliases; `DUCKDB_BLOCK_LANG = "duckdb-query"`.
- `src/web/components/SqlQueryBlock.tsx` is the shared render core, parameterised by `QueryEngineConfig` = `{ id, dict, run, exportCsv, actions }`. `SqliteQueryBlock` and `DuckdbQueryBlock` are thin wrappers that only supply labels, endpoints and which action buttons are live.
- The three action buttons (Show/Hide, Copy Markdown, Export CSV) are **milestone-gated**: `DuckdbQueryBlock` starts with `actions: { showHide: false, copy: false, export: false }`; BACK-779 / BACK-780 / BACK-781 switch them on one by one. SQLite keeps all three `true`, so the m-11 surface is byte-for-byte unchanged.

### DuckDB engine (`src/duckdb/`)
- `query.ts`: opens the instance with `{ access_mode: "READ_ONLY" }` and **opens/closes per query** (no idle-handle cache — DuckDB's connection model makes a cache more trouble than the rare reopen costs). `toCell` coerces BIGINT→string, DECIMAL→fixed-scale decimal string, TIMESTAMP→ISO, DATE→ISO date, BLOB→`<blob N 字节>` via shape-based dispatch (verified against `@duckdb/node-api` 1.5.6). The 500-row cap + 5000 absolute ceiling match SQLite.
- `paths.ts`: the four fail-closed gates are reused from `src/sqlite/paths.ts` (`isNonRelativeSource`, `segmentsInsideProject` are now exported and shared). Only the extension whitelist (`.duckdb`) and the magic check differ; `hasDuckdbMagic` reads the `DUCK` signature at byte offset 8 (verified — DuckDB's first 8 bytes are a version/checksum header).
- `discover.ts`: project-wide `.duckdb` walk with the same 30s cache and excluded-directory rule as SQLite.
- `validation.ts` and the `markdown.ts` / `csv.ts` serialisers are **reused as-is** — DuckDB's `toCell` already produces the `SqliteCell` union they consume.

### Integration
- Server: `/api/duckdb/{files,query,export-csv}` mirror the SQLite routes; `handleDuckdbQuery`/`handleDuckdbExportCsv` `await` the (async) DuckDB calls and reuse `validateReadOnlySql`.
- `src/web/lib/api.ts`: `runDuckdbQuery` / `fetchDuckdbFiles` / `exportDuckdbCsv` + their types; reuse the `SqliteQueryResult` / `SqliteCsvExport` shapes structurally.
- `MermaidMarkdown.tsx` `PreBlock` dispatches on the fence language to `SqliteQueryBlock` or `DuckdbQueryBlock`.
- Four-language `duckdbQueryBlock` namespace added to `en` / `ja` / `zh-CN` / `zh-TW`, mirroring `sqliteQueryBlock`.
- Tests: `src/test/duckdb.test.ts` (parse, gates, coercion, truncation, read-only rejection, CSV, discovery) and `src/test/duckdb-query-block.test.tsx` (base render + an explicit "action buttons absent until enabled" assertion).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
## Final Summary
DuckDB Explorer base render ships: `duckdb-query` fences now render live results (table / list / value, loading / error / empty / truncated, Refresh) through the same generic `SqlQueryBlock` core the SQLite block uses. Validation, Markdown/CSV serialisation and the containment gates are reused; only the engine module (`src/duckdb/`) and the wiring (server routes, API client, i18n, fence dispatch) are new. The three action buttons are intentionally off for DuckDB and switched on by BACK-779 / BACK-780 / BACK-781. SQLite behaviour is unchanged. `tsc` and `bun run check .` are clean; the scoped duckdb suites (19 tests) plus the sqlite suites are green. The full `bun test` was not completed in this session (an unrelated pre-existing test hangs), so only the scoped regression pass is asserted.
<!-- SECTION:SUMMARY:END -->

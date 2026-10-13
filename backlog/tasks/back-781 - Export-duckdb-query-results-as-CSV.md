---
id: BACK-781
title: Export `duckdb-query` results as CSV
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 07:55'
updated_date: '2026-10-13 10:15'
labels:
  - web-ui
  - duckdb
milestone: m-12
dependencies:
  - BACK-778
documentation:
  - backlog/docs/PRDS/sqlite/doc-16 - SQLite Explorer：只读 SQL 浏览与查询能力.md
modified_files: []
ordinal: 340001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Export `duckdb-query` results as CSV (m-12 task 5, mirrors BACK-776). New `src/duckdb/export.ts` `buildDuckdbCsv` reuses the shared `validateReadOnlySql` + `resolveDuckdbSource` + `runDuckdbQuery`, then serialises with the shared `renderCsvFile` / `defaultExportName` (UTF-8 BOM + RFC 4180). The server exposes `POST /api/duckdb/export-csv`, returning `{ filename, csv, rows, truncated }` — the client sends **only** `source` + `sql` (component test asserts the request body is strictly those two keys), the server re-gates both and re-executes, and the browser saves the returned text where the user picks via the shared `saveTextFile` (File System Access API, blob download fallback). No row payload or target path ever comes from the client. The Export button follows the shared contract: rendered only when ready & non-empty, and a dismissed save dialog is a no-op (`AbortError`). Adds `duckdbQueryBlock.exportCsv` / `exporting` / `exported` / `exportFailed` locale strings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 `buildDuckdbCsv` re-runs both gates + executes, returns the full CSV text (UTF-8 BOM) + suggested `<db stem>-<timestamp>.csv` name.
- [x] #2 `POST /api/duckdb/export-csv` returns the same JSON shape as the SQLite export; client request body is strictly `{ source, sql }` (component test asserts two keys).
- [x] #3 Export button rendered only when ready & non-empty; save-dialog cancel is a no-op (`AbortError`).
- [x] #4 `duckdbQueryBlock.exportCsv` / `exporting` / `exported` / `exportFailed` present in all 4 languages.
- [x] #5 tsc/biome/tests green; duckdb export tests cover naming / quoting / refusal-before-build.
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `src/duckdb/export.ts` — `buildDuckdbCsv` reusing `validateReadOnlySql` + `resolveDuckdbSource` + `runDuckdbQuery` + `renderCsvFile` / `defaultExportName`.
2. Server: `POST /api/duckdb/export-csv` returning `{ filename, csv, rows, truncated }`.
3. Web: apiClient `exportDuckdbCsv`; generic component already wires save-via-`saveTextFile`; add export locale strings; hide-when-empty contract.
4. Tests: naming / quoting / refusal-before-build; request-body strict-two-key assertion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Engine + server were already in place (BACK-778)
- `src/duckdb/export.ts` `buildDuckdbCsv` was written in BACK-778 and reuses `validateReadOnlySql` + `resolveDuckdbSource` + `runDuckdbQuery` + the shared `renderCsvFile` / `defaultExportName` (UTF-8 BOM + RFC 4180). Its naming / quoting / refusal-before-build cases are covered by `src/test/duckdb.test.ts` (`buildDuckdbCsv > builds a CSV with a <stem>-<timestamp>.csv filename and BOM body`, `> refuses a write keyword at the validation gate`).
- `POST /api/duckdb/export-csv` (`handleDuckdbExportCsv` in `src/server/index.ts`) and `apiClient.exportDuckdbCsv` (`/duckdb/export-csv`) were also wired in BACK-778. BACK-781 only flips `engine.actions.export` from `false` to `true` in the `DuckdbQueryBlock` wrapper, turning on the shared Export action.
- `duckdbQueryBlock.exportCsv` / `exporting` / `exported` / `exportFailed` were already present in all 4 languages from BACK-778.
- Security contract unchanged: the client sends **only** `{ source, sql }`; the server re-gates and re-runs both; the browser saves the returned text through the shared `saveTextFile` (File System Access API with a blob-download fallback). A dismissed save dialog (`AbortError`) is a no-op.

### Test
- `src/test/duckdb-query-block.test.tsx` gained a `DuckdbQueryBlock Export CSV (BACK-781)` suite. Its harness now stubs `showSaveFilePicker` and captures export request bodies. Cases: the save path writes the returned CSV (BOM + CRLF) under the suggested `<stem>-<timestamp>.csv` name and the request body is **strictly** `{ source, sql }` (asserted via `Object.keys`); a server refusal surfaces "Export failed" inline; the button is absent when the result is empty.
- The earlier BACK-778 gating test was removed: with Show/Hide (BACK-779), Copy (BACK-780) and now Export (BACK-781) all enabled, no duckdb action button remains gated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
`duckdb-query` blocks can now export their result as CSV, the last of the three actions and the m-12 closer. The engine layer (`buildDuckdbCsv`), the `POST /api/duckdb/export-csv` route and the API client were all built in BACK-778; BACK-781 flips `engine.actions.export` to `true` in the `DuckdbQueryBlock` wrapper to switch the shared Export action on. The client sends only `{ source, sql }` (asserted to be exactly those two keys); the server re-gates and re-runs both and returns `{ filename, csv, rows, truncated }`; the browser saves it via the shared `saveTextFile`, and a cancelled dialog is a no-op. The `exportCsv` / `exporting` / `exported` / `exportFailed` strings exist in all 4 languages. tsc, `bun run check .`, the duckdb component suite (15 tests) and the duckdb backend suite (14 tests) are green. With this, all three DuckDB block actions (Show/Hide, Copy Markdown, Export CSV) are live and m-12's task set is complete.
<!-- SECTION:SUMMARY:END -->

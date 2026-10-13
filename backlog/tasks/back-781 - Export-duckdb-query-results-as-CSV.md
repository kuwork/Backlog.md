---
id: BACK-781
title: Export `duckdb-query` results as CSV
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-13 07:55'
updated_date: '2026-10-13 07:55'
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
- [ ] #1 `buildDuckdbCsv` re-runs both gates + executes, returns the full CSV text (UTF-8 BOM) + suggested `<db stem>-<timestamp>.csv` name.
- [ ] #2 `POST /api/duckdb/export-csv` returns the same JSON shape as the SQLite export; client request body is strictly `{ source, sql }` (component test asserts two keys).
- [ ] #3 Export button rendered only when ready & non-empty; save-dialog cancel is a no-op (`AbortError`).
- [ ] #4 `duckdbQueryBlock.exportCsv` / `exporting` / `exported` / `exportFailed` present in all 4 languages.
- [ ] #5 tsc/biome/tests green; duckdb export tests cover naming / quoting / refusal-before-build.
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
<!-- SECTION:SUMMARY:END -->

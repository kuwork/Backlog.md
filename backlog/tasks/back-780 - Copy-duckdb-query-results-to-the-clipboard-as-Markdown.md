---
id: BACK-780
title: Copy `duckdb-query` results to the clipboard as Markdown
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 07:55'
updated_date: '2026-10-13 09:50'
actual_start: '2026-10-13 09:20'
actual_end: '2026-10-13 09:50'
labels:
  - web-ui
  - duckdb
milestone: m-12
dependencies:
  - BACK-778
documentation:
  - backlog/docs/PRDS/sqlite/doc-23 - SQLite Explorer：只读 SQL 浏览与查询能力.md
  - backlog/docs/PRDS/duckdb/doc-25 - DuckDB-Explorer：只读-SQL-浏览与查询能力.md
modified_files: []
ordinal: 339001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Copy `duckdb-query` results to the clipboard as a GitHub-flavoured Markdown table (m-12 task 4, mirrors BACK-775). Serialisation is **reused** from `src/sqlite/markdown.ts` (`resultToMarkdownTable` / `cellToMarkdown`), which only touches a generic `{ columns, rows }` grid, so the DuckDB path needs no new serialiser. The generic `SqlQueryBlock` Copy action already drives it. This task adds the `duckdbQueryBlock.copyMarkdown` / `copied` / `copyFailed` locale strings, and verifies the copy contract for DuckDB: table/list views copy the whole grid, value view copies the single cell, NULL becomes an empty cell, pipe/newline/tab escaping is identical to SQLite, and the button is **hidden** (not disabled) when there is nothing to copy. Clipboard falls back to a hidden textarea for non-secure (plain http LAN) contexts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Copy yields a GFM table from the loaded DuckDB result (table/list views); value view copies the single cell.
- [x] #2 NULL → empty cell; pipe / newline / tab escaping identical to the SQLite path (shared `markdown.ts`).
- [x] #3 Button hidden (not disabled) when there is nothing to copy; success → "copied" reverts after 2s; failure shows an explicit error.
- [x] #4 `duckdbQueryBlock.copyMarkdown` / `copied` / `copyFailed` present in all 4 languages.
- [x] #5 tsc/biome/tests green.
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `copyMarkdown` / `copied` / `copyFailed` to the `duckdbQueryBlock` namespace in all 4 locale files.
2. Confirm the generic Copy action serialises DuckDB results via the shared `markdown.ts`.
3. Component test: button absent when empty/unparsed; clipboard receives a GFM table; 2s revert.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Reused serialiser, one flag flip
- Serialisation is **reused** from `src/sqlite/markdown.ts` (`resultToMarkdownTable` / `cellToMarkdown`), which only consumes a generic `{ columns, rows }` grid of `SqliteCell`. DuckDB's `toCell` (BACK-778) already coerces every DuckDB type into that union, so the DuckDB Copy path needs no new serialiser — `BACK-778`'s `duckdb.test.ts` proves the coercion, this task proves the coercion reaches the clipboard intact.
- BACK-780 only flips `engine.actions.copy` from `false` to `true` in `src/web/components/DuckdbQueryBlock.tsx`; the Copy action itself is shared UI from the generic `SqlQueryBlock`.
- `duckdbQueryBlock.copyMarkdown` / `copied` / `copyFailed` were already added in all 4 languages as part of BACK-778; the button consumes them through `engine.dict`.

### Test
- `src/test/duckdb-query-block.test.tsx` gained a `DuckdbQueryBlock Copy Markdown (BACK-780)` suite. The headline case feeds the component a DuckDB-coerced grid (BIGINT→`"1234567890123"`, DECIMAL→`"3.140"`, TIMESTAMP→ISO, DATE→ISO date, BLOB→`"<blob 4 字节>"`, NULL→`null`) and asserts the copied GFM table is exactly:
  `| id | amount | ts | day | blob | note |` / `| --- | --- | --- | --- | --- | --- |` / `| 1234567890123 | 3.140 | 2026-10-13T08:30:00.000Z | 2026-10-13 | <blob 4 字节> |  |`
  (the trailing `|  |` proves NULL → empty cell). Plus: value view copies the bare scalar (`3.140`), failure path shows "Copy failed", and the button is absent when the result is empty. The shared 2s "copied"→label revert is covered by the SQLite suite (BACK-775).
- The BACK-778 gating test was renamed to "keeps the Export CSV action gated" now that Show/Hide (BACK-779) and Copy (BACK-780) are live and only Export CSV (BACK-781) remains off.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
`duckdb-query` blocks can now copy their result to the clipboard as a GitHub-flavoured Markdown table, mirroring the SQLite block (BACK-775). Serialisation is reused from the shared `src/sqlite/markdown.ts` (DuckDB's `toCell` already produces the `SqliteCell` union it consumes), so there is no new serialiser. BACK-780 only flips `engine.actions.copy` to `true` in the `DuckdbQueryBlock` wrapper. The component test drives a fully DuckDB-typed grid (BIGINT / DECIMAL / TIMESTAMP / DATE / BLOB / NULL) through to the clipboard and asserts the exact GFM output, including the NULL→empty-cell rule; value-view, failure, and empty-state contracts are covered too. `copyMarkdown` / `copied` / `copyFailed` exist in all 4 languages. tsc, `bun run check .` and the duckdb component suite (13 tests) are green.
<!-- SECTION:SUMMARY:END -->

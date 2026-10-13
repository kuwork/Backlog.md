---
id: BACK-780
title: Copy `duckdb-query` results to the clipboard as Markdown
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
ordinal: 339001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Copy `duckdb-query` results to the clipboard as a GitHub-flavoured Markdown table (m-12 task 4, mirrors BACK-775). Serialisation is **reused** from `src/sqlite/markdown.ts` (`resultToMarkdownTable` / `cellToMarkdown`), which only touches a generic `{ columns, rows }` grid, so the DuckDB path needs no new serialiser. The generic `SqlQueryBlock` Copy action already drives it. This task adds the `duckdbQueryBlock.copyMarkdown` / `copied` / `copyFailed` locale strings, and verifies the copy contract for DuckDB: table/list views copy the whole grid, value view copies the single cell, NULL becomes an empty cell, pipe/newline/tab escaping is identical to SQLite, and the button is **hidden** (not disabled) when there is nothing to copy. Clipboard falls back to a hidden textarea for non-secure (plain http LAN) contexts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Copy yields a GFM table from the loaded DuckDB result (table/list views); value view copies the single cell.
- [ ] #2 NULL → empty cell; pipe / newline / tab escaping identical to the SQLite path (shared `markdown.ts`).
- [ ] #3 Button hidden (not disabled) when there is nothing to copy; success → "copied" reverts after 2s; failure shows an explicit error.
- [ ] #4 `duckdbQueryBlock.copyMarkdown` / `copied` / `copyFailed` present in all 4 languages.
- [ ] #5 tsc/biome/tests green.
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `copyMarkdown` / `copied` / `copyFailed` to the `duckdbQueryBlock` namespace in all 4 locale files.
2. Confirm the generic Copy action serialises DuckDB results via the shared `markdown.ts`.
3. Component test: button absent when empty/unparsed; clipboard receives a GFM table; 2s revert.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
<!-- SECTION:SUMMARY:END -->

---
id: BACK-779
title: Add a Show/Hide Query toggle to `duckdb-query` blocks
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
ordinal: 338001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the Show/Hide Query toggle to `duckdb-query` blocks (m-12 task 3, mirrors BACK-774). The generic `SqlQueryBlock` already carries the toggle; this task wires the `duckdbQueryBlock.showQuery` / `hideQuery` locale strings and verifies the toggle behaves correctly for the DuckDB namespace: defaults collapsed, expands to show the read-only `source` + SQL, never issues a query request on its own, Refresh does not collapse it, and a block that fails to parse shows the raw fence body when expanded. The toggle is shared UI, so this is wiring + locale + a per-engine component test, not a new control.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 Toggle defaults collapsed; expands to show `source` + SQL read-only.
- [ ] #2 Expanding/collapsing issues no query request; Refresh does not collapse it.
- [ ] #3 Parse failure shows the raw fence body (not the error text alone) when expanded.
- [ ] #4 `duckdbQueryBlock.showQuery` / `hideQuery` present in all 4 languages and used by the toggle.
- [ ] #5 tsc/biome/tests green; component test asserts `aria-expanded` / `aria-controls` and the toggle is absent when the block cannot be parsed.
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `showQuery` / `hideQuery` to the `duckdbQueryBlock` namespace in all 4 locale files.
2. Confirm the generic `SqlQueryBlock` toggle renders under the DuckDB engine config.
3. Component test: collapse/expand does not call the api; `aria-expanded`/`aria-controls` wired; unparsed block → toggle absent.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
<!-- SECTION:SUMMARY:END -->

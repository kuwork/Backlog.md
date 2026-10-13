---
id: BACK-779
title: Add a Show/Hide Query toggle to `duckdb-query` blocks
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 07:55'
updated_date: '2026-10-13 09:20'
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
- [x] #1 Toggle defaults collapsed; expands to show `source` + SQL read-only.
- [x] #2 Expanding/collapsing issues no query request; Refresh does not collapse it.
- [x] #3 Parse failure shows the raw fence body (not the error text alone) when expanded.
- [x] #4 `duckdbQueryBlock.showQuery` / `hideQuery` present in all 4 languages and used by the toggle.
- [x] #5 tsc/biome/tests green; component test asserts `aria-expanded` / `aria-controls`, and expanding an unparsed block reveals the raw fence body (the toggle stays present, mirroring SQLite BACK-774 — supersedes the original "absent when unparsed" wording).
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `showQuery` / `hideQuery` to the `duckdbQueryBlock` namespace in all 4 locale files.
2. Confirm the generic `SqlQueryBlock` toggle renders under the DuckDB engine config.
3. Component test: collapse/expand does not call the api; `aria-expanded`/`aria-controls` wired; unparsed block → toggle absent.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Wiring, not a new control
- The generic `SqlQueryBlock` (BACK-778) already carries the Show/Hide toggle, gated by `engine.actions.showHide`. BACK-779 simply flips `actions.showHide` from `false` to `true` in `src/web/components/DuckdbQueryBlock.tsx`; no new render code.
- The toggle defaults collapsed (`queryOpen = false`), expands to reveal a read-only `source:` line plus the SQL in a `<pre>`, and toggles `aria-expanded` / `aria-controls`. Expanding/collapsing never re-runs the query; Refresh re-reads the rows but leaves the panel open — same as the SQLite block (BACK-774).
- An unparseable block still renders the toggle (it is gated by `engine.actions.showHide`, not by `parsed.ok`); expanding it shows the raw fence body. This matches the SQLite behaviour and AC #3; it supersedes the original AC #5 wording that said the toggle should be absent when unparsed.
- `duckdbQueryBlock.showQuery` ("Show query") / `hideQuery` ("Hide query") were already added in all 4 languages (en / zh-CN / zh-TW / ja) as part of BACK-778; the toggle consumes them through `engine.dict`.

### Test
- `src/test/duckdb-query-block.test.tsx` gained a `toggle()` helper (matches /query/i across both label states) and a `DuckdbQueryBlock Show/Hide Query (BACK-779)` suite mirroring the SQLite BACK-774 cases: hidden-until-asked, reveal source+SQL, no extra request + Refresh keeps panel open, raw body on parse failure. The BACK-778 "action buttons" test was narrowed to assert only Copy/Export stay gated now that Show/Hide is live.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:SUMMARY:BEGIN -->
The `duckdb-query` block now has a working Show/Hide Query toggle, mirroring the SQLite block (BACK-774). It is shared UI from the generic `SqlQueryBlock`: BACK-779 only flips `actions.showHide` to `true` in the `DuckdbQueryBlock` wrapper. The toggle defaults collapsed, expands to a read-only `source` + SQL panel, wires `aria-expanded` / `aria-controls`, issues no request of its own, survives Refresh, and reveals the raw fence body when the block fails to parse (toggle stays present, like SQLite). The `showQuery` / `hideQuery` strings exist in all 4 languages. tsc, `bun run check .` and the duckdb component suite (9 tests) are green.
<!-- SECTION:SUMMARY:END -->

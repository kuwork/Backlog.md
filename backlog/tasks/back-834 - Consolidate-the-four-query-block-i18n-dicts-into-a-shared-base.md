---
id: BACK-834
title: Consolidate the four query-block i18n dicts into a shared base
status: Done
assignee: []
created_date: '2026-10-31 14:53'
labels:
  - web-ui
dependencies: []
ordinal: 394003
actual_start: '2026-10-31 14:00'
actual_end: '2026-10-31 14:51'
modified_files:
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/cypher-query-block.test.tsx
  - src/test/duckdb-query-block.test.tsx
  - src/test/sqlite-query-block.test.tsx
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Consolidate the four near-identical query-block i18n dicts (sqlite/duckdb/cypher/mdb) into a single shared base object in each of the four locale files (en/zh-CN/zh-TW/ja), and align the query-block Show/Hide test assertions with the user capital-Q copy change.

The four dialect dicts shared about 31 identical keys and differed only in title (cypher added four graph/live keys). They now spread from one module-level queryBlock base, eliminating roughly 355 lines of duplicated copy with no component or type changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All four locale files define one shared queryBlock base holding the 31 common keys
- [x] #2 sqlite/duckdb/mdb dicts spread queryBlock and override only title; cypher spreads it and adds its four graph/live keys
- [x] #3 No QueryBlock component or the QueryBlockDict type is changed; the five components still pass t.<dialect>QueryBlock
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. For each locale (en/zh-CN/zh-TW/ja), add a module-level const queryBlock with the 31 shared keys, extracted verbatim from the four original dialect dicts.
2. Replace the four dialect dicts with spreads: sqliteQueryBlock: { ...queryBlock, title: "..." }, etc.; cypher also adds graphTooLarge / live / pauseAuto / resumeAuto.
3. Keep every key name and string value unchanged so components and QueryBlockDict need no edits.
4. Auto-format with biome and run bunx tsc --noEmit.
5. Update the 8 Show/Hide test assertions to Show Query / Hide Query to track the locale copy the user edited (capital Q).
6. Run the three query-block test files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One source of truth for query-block copy
The four dialect dicts were about 31 of 35 identical. A single queryBlock base (en.ts:9-41) is now spread by all four. A future label fix touches one place instead of four. The cypher dict is the only divergence: it adds four graph/live-only keys (graphTooLarge, live, pauseAuto, resumeAuto).

## Why four keys instead of one namespace
We kept four keys (sqlite/duckdb/cypher/mdb) rather than collapsing to a single queryBlock reference at the call sites, so no component or the QueryBlockDict type had to change. The merge was structural only: every string value is byte-identical to before (confirmed via git diff).

## Test mismatch was a copy edit, not a refactor bug
The 8 Show/Hide assertions expected lowercase Show query / Hide query. The locale strings are Show Query / Hide Query (capital Q) - a copy change the user made intentionally. The i18n merge did not touch these strings, so the tests were updated to track the shipped copy.

## Not consolidated: intentional contextual strings
Other apparent repetition (for example many Loading variants across memos / graphView / databases) is deliberate contextualization, not duplication, and was left as-is. The codebase already centralizes generic verbs in common and shared preview strings in preview.shared.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Consolidated the four near-identical query-block i18n dicts (sqlite/duckdb/cypher/mdb) into a single shared queryBlock base object in each of the four locale files (en/zh-CN/zh-TW/ja). The four dialect dicts now spread the base and override only title (cypher also adds its four graph/live keys). Every string value is unchanged, so the five QueryBlock components and the QueryBlockDict type needed no edits. Net reduction is roughly 355 lines of duplicated copy across the four files. Separately, the 8 Show/Hide test assertions in the cypher/duckdb/sqlite query-block tests were updated to Show Query / Hide Query to match the capital-Q copy the user edited. Verification: bunx tsc --noEmit clean; bunx biome check clean on the locale files; 55/55 tests pass across the three query-block test files.

Modified files: src/web/locales/en.ts, src/web/locales/zh-CN.ts, src/web/locales/zh-TW.ts, src/web/locales/ja.ts, src/test/cypher-query-block.test.tsx, src/test/duckdb-query-block.test.tsx, src/test/sqlite-query-block.test.tsx.
<!-- SECTION:FINAL_SUMMARY:END -->

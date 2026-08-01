---
id: BACK-534
title: Preserve updated_date for ordinal-only task reorders
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-02 20:39'
updated_date: '2026-08-01 08:53'
labels:
  - migration
dependencies: []
references:
  - src/core/backlog.ts
  - src/test/reorder-utils.test.ts
modified_files:
  - src/core/backlog.ts
  - src/test/reorder-utils.test.ts
priority: low
actual_start: '2026-08-01 08:25'
actual_end: '2026-08-01 08:38'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a task ordinal is changed (e.g., via board reorder or sort order), `updated_date` is currently bumped even though no meaningful content or metadata changed. This produces noisy diffs.

Update the task update logic so that ordinal-only changes preserve the existing `updated_date` (or omit it if absent), while changes that also modify content or metadata still update the timestamp normally.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.47.1..v1.48.0 --grep BACK-518` and `git show a0193e5` as implementation reference.
- [x] #2 Editing only a task ordinal preserves the existing `updated_date` value.
- [x] #3 Editing only a task ordinal does not add `updated_date` when it was absent.
- [x] #4 Saving ordinal changes together with any non-order task field updates `updated_date` normally.
- [x] #5 Board reorder and bulk update flows preserve `updated_date` for ordinal-only changes.
Editing only a task ordinal does not add `updated_date` when it was absent.
Saving ordinal changes together with any non-order task field updates `updated_date` normally.
Board reorder and bulk update flows preserve `updated_date` for ordinal-only changes.
Regression tests cover direct ordinal edits, mixed edits, and bulk reorder flows.

- [x] #6 Regression tests cover direct ordinal edits, mixed edits, and bulk reorder flows.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect `Core.updateTask` in `src/core/backlog.ts` and the current date-empty-string clearing logic; centralize `updated_date` stamping so ordinal-only saves restore the original `updated_date` (or omit it if absent).
2. Implement the ordinal-only check by comparing persisted task fields against the update input, excluding `ordinal` and `updatedDate` from the comparison. If only `ordinal` differs, do not bump `updated_date`; if any other field changes, stamp normally.
3. Update board reorder and bulk update call sites to rely on the centralized logic instead of stamping timestamps themselves.
4. Add focused regression tests: direct ordinal edit, ordinal + content edit, bulk update ordinal-only, same-column reorder.
5. Run `bunx tsc --noEmit`, `bun run check .`, and `bun test` for the touched suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation passed for touched files: bunx tsc --noEmit, biome check on src/core/backlog.ts and src/test/reorder-utils.test.ts, and bun test src/test/reorder-utils.test.ts (16 pass). Full bun test surfaced 42 pre-existing failures unrelated to this change (TUI timeouts, platform/network tests, CRLF formatting issues across the repo). Full bun run check . fails due to repository-wide CRLF line endings, not the modified files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented BACK-534 to preserve updated_date for ordinal-only task changes.

Changes:
- Added buildUpdatedDateComparableTask and hasUpdatedDateRelevantChanges helpers in src/core/backlog.ts to compare persisted task content while ignoring ordinal and updatedDate.
- Updated Core.updateTask to stamp updated_date only when content/metadata changed; otherwise restore the original updated_date or omit it if absent.
- Board reorder and bulk update flows now rely on the centralized logic, so ordinal-only changes no longer bump updated_date.
- Added regression tests in src/test/reorder-utils.test.ts for direct ordinal edits, mixed edits, ordinal-only bulk updates, and same-column reorder.

Verification:
- bunx tsc --noEmit: pass
- bunx biome check src/core/backlog.ts src/test/reorder-utils.test.ts: pass
- bun test src/test/reorder-utils.test.ts: 16 pass
- bun test (full suite): 1531 pass, 6 skip, 42 pre-existing failures unrelated to this change
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched.
- [x] #2 bun run check . passes when formatting/linting touched.
- [x] #3 bun test (or scoped reorder tests) passes.
<!-- DOD:END -->

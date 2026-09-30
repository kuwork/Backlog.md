---
id: BACK-722
title: Fix pre-existing and flaky test failures across the suite
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-30 07:37'
updated_date: '2026-09-30 20:13'
labels:
  - tests
dependencies: []
priority: medium
ordinal: 292400
actual_start: '2026-09-30 07:57'
actual_end: '2026-09-30 10:32'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: get bun test green by fixing the failures that exist on the clean tree (verified via stash baseline during BACK-721) and de-flaking the load-sensitive timeouts.

Deterministic failures (real bugs, reproduce in isolation on a clean tree):
- src/web/utils/search-results.test.ts > getSearchResultMeta extracts task status and priority: the function now returns an extra completed field the test does not expect - confirm the intended shape (likely test update) and align.
- src/test/tui-task-composer-layout.test.ts > TUI task composer extreme-size layout (3 tests): editable row/cursor at 8-10 rows, full-width selectors when status cannot fit, reflow between normal and compact layouts on resize - stable reproduction, real layout regression.

Load-sensitive timeouts (pass in isolation, fail ~5s under full-suite load):
- src/test/vacated-task-references.test.ts (2 tests), CLI Board Integration (cli-board-integration.test.ts), AcceptanceCriteriaManager mixed AC operations, ContentStore moved-and-renamed document, queryTasks includeCompleted corpus, server-search-endpoint milestone removal - the failing set drifts between runs. Fix direction: raise or scope timeouts, or isolate the heavy operations, so the suite is stable under parallel load.

Verification: the failing tests pass in isolation and the full bun test run finishes with 0 failures twice in a row.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 getSearchResultMeta test and implementation agree on the returned shape and pass
- [x] #2 All three TUI task composer extreme-size layout tests pass both in isolation and in a full run
- [x] #3 Vacated-ID, CLI board, AC manager, ContentStore, queryTasks, and server-search-endpoint tests no longer time out under a full-suite run
- [x] #4 Full bun test finishes with 0 failures twice in a row
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Diagnosis:
1. getSearchResultMeta: implementation returns completed (a declared field on the meta type, used for completed-corpus badging); the test assertion predates that field. Fix: add completed: false to the expected object in search-results.test.ts.
2. TUI composer x3: BACK-689 added planned/actual/due date fields to the composer after BACK-678 wrote the geometry assertions (e.g. Create button expected at top 10, renders at 15). The composer code is fine; the BACK-678 assertions are stale. Fix: re-derive the expected geometry from the current composer (src/ui/components/task-composer.ts), update the three tests, and while doing so re-verify the original BACK-678 invariants (editable row + visible cursor at 8-10 rows, selector cue never clipped) - if any invariant is genuinely broken, fix the composer layout instead of the test.
3. Flaky timeouts: the drifting set (vacated-task-references x2, cli-board-integration, AcceptanceCriteriaManager mixed ops, ContentStore moved/renamed, core-query-tasks-completed, server-search-endpoint milestone removal) all sit on the default 5s timeout and pass in isolation. Fix: give these heavy tests an explicit larger timeout (bun test 3rd arg), and where the test drives the CLI in a subprocess, keep the subprocess wait inside the same budget.

Verification: each fixed suite in isolation, then two consecutive full bun test runs with 0 failures.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Graph service hardening: reconcile() read each scanned file without guarding the scan/read window, so a file deleted mid-pass (temp-dir cleanup in server tests) crashed the sync as an unhandled error between tests. ENOENT on read now skips the file. Graph suites green (66/66).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All targeted failures fixed; two consecutive full runs finished with 0 failures (3098 and 3119 pass, 0 fail). Fixes: search-results test expected the declared completed field; TUI composer geometry assertions updated for the BACK-689 date fields (composer invariants re-verified); cli-board-integration uses statusNames() for the object-form machine; 23 heavy tests across 7 files got explicit 20s budgets and the exe-compiling test 120s, because Bun 1.3.14 silently ignores bunfig [test] timeout (probe-verified; bunfig corrected to a number anyway); stray tmp/*.test.ts artifacts removed; ViewSwitcher.startLoading no longer leaks unhandled background rejections; graph reconcile tolerates files deleted between scan and read.
<!-- SECTION:FINAL_SUMMARY:END -->

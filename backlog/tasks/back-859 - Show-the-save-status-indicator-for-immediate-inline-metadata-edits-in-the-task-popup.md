---
id: BACK-859
title: >-
  Show the save status indicator for immediate inline metadata edits in the task
  popup
status: Done
assignee:
  - '@doubao'
created_date: '2026-11-19 16:46'
updated_date: '2026-11-19 16:49'
labels:
  - web-ui
dependencies: []
references:
  - 'src/web/components/TaskDetailsModal.tsx:1574-1597'
  - src/test/web-task-details-modal-inline-meta-save-status.test.tsx
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/test/web-task-details-modal-inline-meta-save-status.test.tsx
ordinal: 418004
actual_start: '2026-11-19 16:46'
actual_end: '2026-11-19 16:49'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-839 batched the list-shaped inline metadata fields (references, documentation, modified files, labels, dependencies) and surfaced their save state through a header chip, but the single-value fields on the sidebar (status, dates, title, assignee, priority, milestone) still write immediately without touching inlineMetaSaveStatus. Changing status or a date gives no feedback at all, unlike labels or references which show Saving and Saved. The user asked for these immediate writes to reuse the same header chip directly rather than being folded into the debounce pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Editing status, any sidebar date field (dueDate, plannedStart, plannedEnd, actualStart, actualEnd), title, assignee, priority or milestone still issues an immediate single PUT with no debounce window added, and the header chip shows Saving while that write is in flight
- [x] #2 A successful immediate write switches the chip to Saved, reusing the existing auto-reset back to idle
- [x] #3 A rejected immediate write switches the chip to Failed to save and keeps the existing optimistic rollback and error message behaviour
- [x] #4 The debounced list-shaped fields keep their coalesced flush behaviour and chip handling unchanged, and create mode never shows the chip for metadata edits
- [x] #5 New regression tests cover status success and rejection plus a date edit through the immediate path, and the existing task details modal suites stay green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Wire inlineMetaSaveStatus into the immediate single-write branch of handleInlineMetaUpdate (saving before the PUT, saved on success, failed on rejection).
2. Keep the debounced list-shaped fields and create mode untouched; no new timers.
3. Add regression tests for immediate status/date saves and rejection rollback; run tsc, biome and the modal suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Immediate (non-debounced) writes in handleInlineMetaUpdate now drive the same inlineMetaSaveStatus chip used by the BACK-839 debounced flush: saving before apiClient.updateTask, saved on success, failed on rejection alongside the existing rollback and error banner. No debounce added; the five list-shaped fields keep their coalesced flush path. Create mode is unaffected because the chip update sits inside the existing if (task) guard. Pre-existing gap left untouched: restoreInlineMetaValues does not cover dates or title, so a rejected date/title write shows the failed chip and error banner without rolling the input value back. Validation: bun x tsc --noEmit clean; bun run check reports only 14 pre-existing warnings; scoped bun tests: 3 new save-status tests pass, all 13 task-details-modal suites (83 tests) pass, readiness, draft-editing and graph-stack-return suites pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reused the header save-status chip for immediate inline metadata edits in the task popup (status, dates, title, assignee, priority, milestone) without adding debounce.

Changes:
- src/web/components/TaskDetailsModal.tsx: the immediate branch of handleInlineMetaUpdate now sets saving/saved/failed around the single PUT, sharing the chip introduced in BACK-839
- src/test/web-task-details-modal-inline-meta-save-status.test.tsx: new regression tests for status success, status rejection rollback and a date edit

Verification:
- bun x tsc --noEmit (clean)
- bun run check (14 pre-existing warnings only)
- bun test: 3 new tests plus all 13 task-details-modal suites (83 pass), readiness, draft editing and graph stack return all green
<!-- SECTION:FINAL_SUMMARY:END -->

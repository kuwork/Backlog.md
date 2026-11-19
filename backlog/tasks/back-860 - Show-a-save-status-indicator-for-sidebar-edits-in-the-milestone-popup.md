---
id: BACK-860
title: Show a save status indicator for sidebar edits in the milestone popup
status: Done
assignee:
  - '@doubao'
created_date: '2026-11-19 16:56'
updated_date: '2026-11-19 16:56'
labels:
  - web-ui
dependencies: []
references:
  - 'src/web/components/MilestoneDetailsModal.tsx:301-337'
  - src/test/web-milestone-details-modal-save-status.test.tsx
modified_files:
  - src/web/components/MilestoneDetailsModal.tsx
  - src/test/web-milestone-details-modal-save-status.test.tsx
ordinal: 419004
actual_start: '2026-11-20 15:50'
actual_end: '2026-11-19 16:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mirrors BACK-859 for the milestone detail modal. The sidebar name input (on blur) and the five date fields (on change) write immediately through saveMeta, but the saving flag is only used to disable header buttons, so in preview mode these edits give no visible feedback at all. The task popup gained a Saving/Saved/Failed header chip for the same kind of immediate writes in BACK-859; the milestone popup needs the equivalent treatment, driven by saveMeta and reusing the existing common.saving/saved/failedToSave locale keys. No debounce is added and the edit-mode Save button keeps its current behaviour.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Blurring the sidebar name with a changed value or changing any sidebar date field still issues the existing immediate saveMeta write with no debounce, and the header chip shows Saving while the write is in flight
- [x] #2 A successful sidebar write switches the chip to Saved and it auto-resets to idle after about 2.5 seconds
- [x] #3 A rejected sidebar write switches the chip to Failed to save, keeps the existing error message and does not trigger onRefreshData
- [x] #4 The edit-mode Save button behaviour is unchanged and the chip reuses the existing common.saving, common.saved and common.failedToSave locale keys with no new i18n entries
- [x] #5 New regression tests cover a sidebar date edit succeeding and being rejected, and the existing milestone web suites stay green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a metaSaveStatus state (idle/saving/saved/failed) with the same 2.5s auto-reset as the task popup.
2. Drive it from saveMeta (saving before the write, saved on success, failed on rejection) and render the chip in the Modal actions slot, reusing the existing locale keys.
3. Add regression tests for a sidebar date edit succeeding and being rejected; run tsc, biome and the milestone suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The chip lives in the Modal actions slot and is driven only by saveMeta, the sidebar's immediate write path (name blur, five date fields, documentation edits). handleSave keeps the edit-mode button feedback and does not touch the chip. Saving uses the pre-existing common.saving/saved/failedToSave keys, so no locale changes. Failure keeps the prior behaviour: the error banner shows the message and the entered value stays in the input (no rollback, same as before). Validation: bun x tsc --noEmit clean after typing the updateMilestone deferred mock against its real { success, milestone } result; biome auto-fixed one long svg line; bun test web-milestone runs 31 tests across 7 files, all passing, including the 2 new badge tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the task-popup-style save status chip to the milestone popup sidebar edits.

Changes:
- src/web/components/MilestoneDetailsModal.tsx: new metaSaveStatus state with 2.5s auto-reset, driven by saveMeta; Saving/Saved/Failed chip rendered in the Modal actions slot using existing locale keys
- src/test/web-milestone-details-modal-save-status.test.tsx: covers a date edit showing Saving then Saved (with refresh) and a rejected write showing Failed to save with the error preserved

Verification:
- bun x tsc --noEmit (clean)
- bun run check (14 pre-existing warnings only)
- bun test web-milestone: 31 pass, 0 fail across 7 files
<!-- SECTION:FINAL_SUMMARY:END -->

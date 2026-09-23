---
id: BACK-689
title: 'TUI task composer and task detail popup: planned/actual/due dates'
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 00:45'
updated_date: '2026-09-23 01:22'
labels:
  - cli
  - tui
  - enhancement
dependencies: []
ordinal: 262400
actual_start: '2026-09-23 00:51'
actual_end: '2026-09-23 01:06'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scope: 
(1) Task composer (task-composer.ts) gains Due / Planned from-to / Actual from-to date fields, mirroring the milestone form fields.
 
(2) Task detail popup (createTaskPopup in task-viewer-with-search.ts) displays due date, planned start/end, actual start/end like the milestone detail popup does. Labels: cli, tui, enhancement
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Composer offers Due / Planned from-to / Actual from-to fields and persists valid dates to the created task file
- [x] #2 A malformed date is refused with a named-field error and the form refocuses the offending field
- [x] #3 Task detail popup (task-list quick-look and board popup) shows Due and Planned/Actual ranges, and omits date lines when the task has none
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Composer: five date fields (Due, Planned from/to, Actual from/to) between the Details frame and actions, mirroring the milestone form's label+input rows; validation reuses isValidMilestoneDate; invalid submit refocuses the offending field. Popup height cap raised 20->24 with the short-screen margin guard kept. Detail: generateDetailContent metadata gains Due/Planned/Actual lines (feeds both the task-list quick-look and the board popup). Verified end-to-end: invalid date refused with refocus, fixed value persisted (dueDate/plannedStart/plannedEnd written to the task file).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added planned/actual/due date support to the TUI task composer and task detail popup. Composer: 5 date fields in the milestone-form style with format validation and error refocus; detail popup shows Due plus Planned/Actual ranges. Verified: 95 related tests pass, tsc and biome clean, live create-flow probe confirmed dates persist and bad dates are refused.
<!-- SECTION:FINAL_SUMMARY:END -->

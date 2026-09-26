---
title: BACK-689 TUI task composer and task detail popup - planned/actual/due dates
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
  - cli
  - date-fields
source_path: backlog/tasks/back-689 - TUI-task-composer-and-task-detail-popup-planned-actual-due-dates.md
---

# BACK-689 TUI task composer and task detail popup - planned/actual/due dates

The TUI task composer and task detail popup had no date fields at all, while the milestone form already carried them. This task adds Due / Planned from-to / Actual from-to fields to the composer and Due plus Planned/Actual range lines to the task detail popup, mirroring the milestone surfaces.

## Summary

- Composer (`task-composer.ts`): five date fields (Due, Planned from/to, Actual from/to) placed between the Details frame and the actions, laid out as label+input rows in the milestone-form style; popup height cap raised 20 to 24 with the short-screen margin guard kept
- Validation reuses `isValidMilestoneDate`; an invalid submit is refused with a named-field error and refocuses the offending field
- Detail: `generateDetailContent` in `task-viewer-with-search.ts` gained Due/Planned/Actual metadata lines, which feeds both the task-list quick-look and the board popup; date lines are omitted when the task has none
- Verified end-to-end with a live create-flow probe: an invalid date is refused with refocus, and fixed values persist as `dueDate`/`plannedStart`/`plannedEnd` in the created task file
- Checks: 95 related tests pass, `bunx tsc --noEmit` and Biome clean

## Acceptance Criteria

- Composer offers Due / Planned / Actual date fields and persists valid dates to the created task file
- A malformed date is refused with a named-field error and the form refocuses the offending field
- Task detail popup shows Due and Planned/Actual ranges in both the task-list quick-look and the board popup
- Tasks with no dates render no date lines

## Related Concepts

- [[concepts/date-fields]] — the due/planned/actual date model these TUI fields expose
- [[concepts/cli-tui]] — composer and popup conventions of the terminal UI

## Related Sources

- [[sources/back-587-repair-tui-task-composer-ux]] — earlier composer UX repair whose form this extends
- [[sources/actual-dates-auto-create-task]] — actual-date fields on task creation, the CLI counterpart

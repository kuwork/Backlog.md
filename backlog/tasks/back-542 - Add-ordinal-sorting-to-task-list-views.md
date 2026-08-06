---
id: BACK-542
title: Add ordinal sorting to task list views
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-08 20:33'
updated_date: '2026-08-06 18:26'
labels: []
dependencies: []
modified_files:
  - src/web/components/TaskList.tsx
  - src/cli.ts
  - src/test/web-task-list-sort.test.tsx
  - src/test/cli-priority-filtering.test.ts
actual_start: '2026-08-06 17:36'
actual_end: '2026-08-07 01:21'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make ordinal the default sort in the Web All Tasks list and CLI task list, aligning with the board. Do not add a dedicated Ordinal column; express ordinal order through default sort and header-click interactions.

Boundaries:
- All Tasks defaults to ordinal sort instead of ID descending.
- Header clicks cycle: first ascending, second descending, third clears the column sort and restores default ordinal sort.
- CLI backlog task list returns ordinal-sorted results by default while still supporting --sort ordinal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Web All Tasks defaults to ordinal sort without adding a dedicated Ordinal column.
- [x] #2 Header sort cycling is: first ascending, second descending, third clears the column sort and restores default ordinal sort.
- [x] #3 CLI backlog task list returns ordinal-sorted results by default.
- [x] #4 CLI backlog task list continues to support --sort ordinal and exposes it in help text.
- [x] #5 Focused tests cover default ordinal sorting, three-click sort reset, and CLI default ordinal behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript is touched
- [x] #2 bun run check . passes when formatting/linting is touched
- [x] #3 bun test (or scoped tests) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm current TaskList sort state, handleSortChange, and sortedDisplayTasks.
2. Change default sort from ID descending to ordinal; introduce internal default state with no explicit column sort.
3. Update handleSortChange so the third click on the same column clears the sort and restores the ordinal default.
4. Update sortedDisplayTasks to use sortByOrdinal in the default/cleared state.
5. Update CLI task list to default to ordinal and add ordinal to --sort help and validation.
6. Update or add tests for default sorting, three-click reset, and CLI default behavior.
7. Run scoped bun test, tsc, and Biome checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Default sort: sortByOrdinal(tasks) for base data and filtered search results. Sort state tracks null column as the default/ordinal mode. handleSortChange cycles every column: first ascending, second descending, third click clears the column and restores ordinal default. sortedDisplayTasks branches on null to sortByOrdinal and otherwise applies the selected column. CLI default changed to sortTasks(tasks, "ordinal") and --sort help/validation now includes ordinal. Kept sortTasksByIdDescending helper for the ID column branch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changed the Web All Tasks list and CLI task list to default to ordinal sorting, matching the board view, without adding a dedicated Ordinal column. Sortable headers now cycle through ascending, descending, and cleared (back to default ordinal) on the third click. CLI task list defaults to ordinal and still supports --sort ordinal. Updated existing CLI sort tests and added focused TaskList tests for default ordinal order and the three-click sort cycle. Verified with bun test (scoped), bunx tsc --noEmit, and bun run check . (only pre-existing unrelated warnings).
<!-- SECTION:FINAL_SUMMARY:END -->

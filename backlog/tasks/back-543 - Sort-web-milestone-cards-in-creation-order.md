---
id: BACK-543
title: Sort web milestone cards in creation order
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-08 20:31'
updated_date: '2026-08-06 19:25'
labels: []
dependencies: []
modified_files:
  - src/web/components/MilestonesPage.tsx
  - src/web/components/MilestoneTaskRow.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/web-milestones-page-search.test.tsx
actual_start: '2026-08-06 19:02'
actual_end: '2026-08-07 02:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make each milestone card's task table behave like the All Tasks list: default to ordinal sort, add a Created column, and use the same three-click header sort cycle (ascending, descending, cleared back to default). The milestone card order itself stays unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each milestone card's task table header includes a sortable Created column.
- [x] #2 Default task order inside each milestone table is ordinal (sortByOrdinal).
- [x] #3 Every sortable header cycles: first click ascending, second descending, third click clears the column and restores the default ordinal order.
- [x] #4 Tasks with missing/invalid createdDate are handled predictably when sorting by Created.
- [x] #5 The change is covered by focused MilestonesPage tests including three-click reset.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript is touched
- [x] #2 bun run check . passes when formatting/linting is touched
- [x] #3 bun test (or scoped tests) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Confirm current MilestonesPage bucket table columns, sort state, and getSortedTasks.
2. Add "created" to BucketSortColumn and add a Created header button.
3. Change getSortedTasks to default to sortByOrdinal when no explicit column sort is active.
4. Change handleBucketSortChange to the three-click cycle used in TaskList.
5. Add a createdDate sort branch with missing/invalid dates at the end and task ID tie-breaker.
6. Update MilestoneTaskRow grid and display createdDate.
7. Update i18n labels and focused tests.
8. Run MilestonesPage tests, tsc, and Biome checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Milestone bucket task table now mirrors All Tasks sort behavior: default sortByOrdinal, three-click header cycle (asc → desc → cleared/ordinal). Added Created column with parseStoredUtcDate-based comparator. Kept milestone card order unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made each milestone card's task table use the same sort interactions as the All Tasks list: default ordinal order, a new sortable Created column, and a three-click header cycle (ascending → descending → cleared, restoring default ordinal). Updated MilestoneTaskRow to display the new column and adjusted grid widths. Added locale labels for en/zh-CN/zh-TW/ja and focused tests verifying the Created column and three-click reset. Left the milestone card order unchanged. Verified with bun test (MilestonesPage, board, milestones utility), bunx tsc --noEmit, and bun run check . (only pre-existing unrelated warnings).
<!-- SECTION:FINAL_SUMMARY:END -->

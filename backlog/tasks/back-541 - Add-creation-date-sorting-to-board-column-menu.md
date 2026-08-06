---
id: BACK-541
title: Add creation-date sorting to board column menu
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-09 06:50'
updated_date: '2026-08-06 17:03'
labels: []
dependencies: []
modified_files:
  - src/web/components/TaskColumn.tsx
  - src/test/web-task-column-sort.test.tsx
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
actual_start: '2026-08-06 16:43'
actual_end: '2026-08-06 16:54'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub issue #694 asks for a Web board column menu action to sort tasks by creation date. Scope is intentionally narrow: add creation-date sort actions beside the existing Sort by Priority action, using the existing task createdDate field and current column reorder behavior without introducing a generic sorting framework.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Board column menu exposes creation-date sorting beside the existing priority sort action.
- [x] #2 Creation-date sorting supports both oldest-first and newest-first ordering within the selected column.
- [x] #3 Sorting uses each task createdDate and falls back predictably when a task has no created date.
- [x] #4 The change is covered by focused Web board tests.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add createdDate to TaskColumn columnSort field and handleLocalSort signature.
2. Add creation-date ascending/descending options to the column actions menu using the existing sortOptions pattern and the existing t.taskList.columns.created locale label.
3. Add a sort branch in getDisplayTasks that uses parseStoredUtcDate to compare dates, keeping missing/invalid dates at the end and using task ID as tie-breaker.
4. Add focused tests covering ascending, descending, missing-date fallback, and no-op reorder scenarios.
5. Run TaskColumn tests, type-check, Biome, and relevant board tests.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added creation-date ascending/descending sort options to the Web board column actions menu, following the same local-sort pattern as the existing ID/Title/Priority options. Implemented a parseStoredUtcDate-based comparator that keeps tasks with missing/invalid createdDate at the end and uses task ID as tie-breaker. Added focused tests for ascending, descending, missing-date fallback, and clear-sort behavior. Verified with bun test src/test/web-task-column-sort.test.tsx, bun test src/test/board.test.ts src/test/board-ui.test.ts src/web/lib/lanes.test.ts, bunx tsc --noEmit, and bun run check . (only pre-existing unrelated warnings).
<!-- SECTION:FINAL_SUMMARY:END -->

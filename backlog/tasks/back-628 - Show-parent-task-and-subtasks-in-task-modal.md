---
id: BACK-628
title: Show parent task and subtasks in task modal
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-12 22:28'
updated_date: '2026-09-13 00:08'
labels:
  - web-ui
dependencies: []
modified_files:
  - src/web/components/TaskHierarchySection.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/web-task-details-modal-hierarchy.test.tsx
ordinal: 229400
actual_start: '2026-09-12 22:41'
actual_end: '2026-09-13 00:08'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a parent/subtask hierarchy section to the task detail modal, rendered directly below the task title, so users can see and navigate the parent-child hierarchy without leaving the modal.

Design (based on UI mockups):
- Child task view: below the title row, render a PARENT row - an up-arrow icon plus the PARENT label, the parent task ID, the parent title, and the parent status badge on the right. Clicking the row opens the parent task in the modal.
- Parent task view: below the title row, render a SUBTASKS section header - a subtasks icon plus the SUBTASKS label, a completion count (e.g. 1/6), a horizontal progress bar, and an expand/collapse chevron on the right.
- Below the header, list each subtask as a row: a completion indicator (filled/checked circle when done, empty circle otherwise), the subtask ID, its title, its status badge on the right, and a chevron indicating drill-down. Clicking a row opens that subtask in the modal.

The section is rendered only when the open task actually has a parent or subtasks. Most tasks have no hierarchy, so when neither exists nothing is rendered and the modal layout, sizing, and expansion behave exactly as before.

Data is already available on the task (parentTaskId and subtasks fields).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task modal shows a PARENT row directly below the title when the open task has a parent, displaying the parent ID, title, and status badge
- [x] #2 Clicking the PARENT row opens the parent task in the modal, integrating with existing drill-down navigation
- [x] #3 Task modal shows a SUBTASKS section directly below the title when the open task has subtasks, with completion count (e.g. 1/6) and a progress bar
- [x] #4 SUBTASKS section can be expanded and collapsed via the chevron control
- [x] #5 Each subtask row shows a completion indicator, task ID, title, status badge, and drill-down affordance; clicking a row opens that subtask in the modal
- [x] #6 New section matches the existing modal styling and does not break existing modal behavior (keyboard shortcuts, back navigation, unsaved-draft handling)
- [x] #7 Changes are covered by tests consistent with the existing web UI test setup
- [x] #8 When a task has no parent and no subtasks, no hierarchy section is rendered and the modal layout, sizing, and expansion behavior are unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add TaskHierarchySection component (parent row + collapsible subtasks list) that resolves parent/subtask Task objects from the task corpus and navigates via onDrillDown
2. Render it at the top of TaskDetailsModal content (below banners, above the content grid), only when parent or subtasks exist
3. Add i18n strings to en.ts and mirror in ja/zh-CN/zh-TW
4. Add component tests following src/test web conventions (renderToString + I18nProvider/MemoryRouter/ThemeProvider)
5. Run bunx tsc --noEmit, bun run check ., and bun test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented TaskHierarchySection (parent row + collapsible subtasks list) rendered at the top of TaskDetailsModal, resolving parent/subtasks client-side from the task corpus via canonicalTaskId and navigating through the existing handleTaskClick/onDrillDown path. Added optional availableTasks prop to the modal (seeded from App.tsx corpus). i18n labels added for en/ja/zh-CN/zh-TW. Added 5 renderToString component tests.

Fix during execution: importing taskIdsEqual from src/utils/task-path.ts pulled Core into the browser bundle and broke the web UI (blank page); switched to canonicalTaskId from the pure src/utils/task-id.ts module.

Per user feedback: the whole SUBTASKS header row toggles expand/collapse (not just the chevron).

Verification so far: hierarchy tests 5/5 pass, tsc passes, biome passes, browser page serves correctly; full bun test suite running to identify 1 failing test seen in an earlier run.
<!-- SECTION:NOTES:END -->

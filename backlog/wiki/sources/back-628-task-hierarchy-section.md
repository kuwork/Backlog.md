---
title: BACK-628 Show parent task and subtasks in task modal
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
labels:
  - source
  - web-ui
  - task-hierarchy
source_path: backlog/tasks/back-628 - Show-parent-task-and-subtasks-in-task-modal.md
---

# BACK-628 Show parent task and subtasks in task modal

Parent/child relationships were invisible in the task detail modal — seeing or navigating a hierarchy meant leaving the modal. This task renders a hierarchy section directly below the title: a PARENT row when the open task has a parent, and a collapsible SUBTASKS section with completion count, progress bar, and per-row drill-down when it has children.

## Summary

- New `TaskHierarchySection.tsx`, rendered at the top of `TaskDetailsModal` content (below banners, above the content grid), only when a parent or subtasks exist — tasks without hierarchy render exactly as before, so modal layout, sizing, and expansion are unchanged
- Parent row: up-arrow icon, PARENT label, parent ID + title, status badge; clicking opens the parent in the modal through the existing `onDrillDown` / `handleTaskClick` path
- Subtasks section: header with icon, SUBTASKS label, `done/total` count, progress bar, and chevron; the **whole header row** toggles expand/collapse (user feedback, not just the chevron); rows carry a filled/empty completion circle, ID, title, status badge, and drill-down chevron
- Resolution is client-side from the task corpus: `canonicalTaskId` matching for both parent lookup and child filter, children ordered by `sortByTaskId`; `TaskDetailsModal` gained an optional `availableTasks` prop seeded from `App.tsx`
- Execution finding: importing `taskIdsEqual` from `src/utils/task-path.ts` pulled Core into the browser bundle and blank-paged the web UI — switched to `canonicalTaskId` from the pure `src/utils/task-id.ts` module (see [[decisions/pure-task-id-module-in-browser-bundle]])
- i18n: labels added to `en`/`ja`/`zh-CN`/`zh-TW`; tests: 5 `renderToString` component tests in `src/test/web-task-details-modal-hierarchy.test.tsx`
- Assets: reference mockups `backlog/assets/paste/parent-task-view.png` and `subtask-view.png`

## Acceptance Criteria

- PARENT row shows parent ID, title, and status badge below the title, and opens the parent on click
- SUBTASKS section shows completion count and progress bar and can be expanded/collapsed
- Each subtask row shows completion indicator, ID, title, status badge, and drill-down affordance, and opens that subtask on click
- Section matches existing modal styling without breaking keyboard shortcuts, back navigation, or unsaved-draft handling
- Tasks with neither parent nor subtasks render no section and behave exactly as before

## Related Concepts

- [[concepts/web-ui-features]] — task modal interaction conventions this section joins
- [[concepts/task-lifecycle]] — parent/subtask relationships the section visualizes
- [[concepts/task-identity]] — `canonicalTaskId` prefix-independent matching used for resolution

## Related Sources

- [[sources/back-505]] — BACK-505 dependency drill-down navigation reused here
- [[sources/back-624-global-search-dialog]] — same feedback wave; BACK-624 split `task-badge-colors.ts` out of TaskList
- [[sources/subtask-grouping-fix]] — BACK-496 subtask grouping in board/list views

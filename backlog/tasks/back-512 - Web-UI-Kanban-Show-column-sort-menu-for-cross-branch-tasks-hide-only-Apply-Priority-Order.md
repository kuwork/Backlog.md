---
id: BACK-512
title: >-
  Web UI Kanban: Show column sort menu for cross-branch tasks, hide only Apply
  Priority Order
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-05 16:25'
updated_date: '2026-06-05 16:38'
labels:
  - web-ui
  - bug
dependencies:
  - BACK-484
modified_files:
  - src/web/components/TaskColumn.tsx
priority: medium
ordinal: 170400
actual_start: '2026-06-05 16:25'
actual_end: '2026-06-05 16:38'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a Kanban column contains tasks from other branches (cross-branch tasks), the entire column actions menu (sort dropdown) was being hidden. This was overly restrictive because the menu contains two types of actions:

1. **Local view-only sorts** (ID ↑/↓, Title ↑/↓, Priority ↑/↓) — these only affect display order and do not modify any persisted data.
2. **Apply Priority Order** — this calls onTaskReorder which modifies the ordinal field of tasks in the column.

The original code used a single canSort flag that checked tasks.every(task => !task.branch), causing the entire menu to disappear when any cross-branch task was present.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Split the single canSort condition into two separate flags:

- showColumnMenu: controls whether the menu button is shown (requires onTaskReorder and length > 1). No longer checks for cross-branch tasks.
- canReorder: controls whether the Apply Priority Order button is shown (requires onTaskReorder AND no cross-branch tasks).

This allows users to still use local sorting even when a column contains cross-branch tasks, while correctly hiding the action that would attempt to modify ordinals across branches.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Refactored canSort into showColumnMenu + canReorder in src/web/components/TaskColumn.tsx to differentiate view-only local sorts from ordinal-mutating priority order application.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Column actions menu remains visible when the column contains cross-branch tasks
- [x] #2 Apply Priority Order button is hidden when any task in the column has a branch field
- [x] #3 Apply Priority Order button is visible when all tasks in the column belong to the current branch
- [x] #4 Local sort options (ID, Title, Priority) work correctly regardless of cross-branch tasks
<!-- AC:END -->

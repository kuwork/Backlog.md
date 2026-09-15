---
id: BACK-526
title: Fix create-task references input and .backlog autocomplete discovery
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-14 06:04'
updated_date: '2026-07-14 06:20'
labels:
  - web-ui
dependencies: []
references:
  - src/web/components/TaskDetailsModal.tsx
priority: high
ordinal: 178400
actual_start: '2026-07-14 06:05'
actual_end: '2026-07-14 06:19'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The create-task modal currently does not allow users to add References, while the Documentation section works correctly. Additionally, the task payload submitted on create does not include references or documentation, so even if the UI allowed input, the values would not be saved.

Separately, the path autocomplete global search filters out all dot-prefixed directories via startsWith("."), which prevents users from discovering the .backlog directory when typing ".back". The original task (BACK-479) only intended to exclude specific directories (node_modules, .git, dist, build, .backlog, .locks), but the implementation is stricter than specified.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create-task modal shows the References add input field (path autocomplete + Add button)
- [x] #2 Creating a new task persists any entered references
- [x] #3 Creating a new task persists any entered documentation
- [x] #4 Existing preview/edit mode references behavior remains unchanged
- [x] #5 Typing '.back' in path autocomplete suggests the .backlog directory
- [x] #6 Other dot-prefixed directories (e.g., .github, .husky) remain hidden from global filename search
<!-- AC:END -->













## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect TaskDetailsModal.tsx to understand why the References add form is hidden in create mode and why references/documentation are omitted from the create payload.
2. Update the References add form condition to match Documentation (visible whenever the task is editable).
3. Include references and documentation arrays in the create-task payload.
4. Adjust searchProjectFiles in src/file-system/operations.ts to allow the .backlog directory while keeping other dot-prefixed directories hidden.
5. Run TypeScript checks and relevant filesystem tests to verify the changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This task fixes all three issues:

1. References add form in TaskDetailsModal now renders in create mode (removed the 'mode === preview' gate).

2. Create-task payload now includes references and documentation arrays.

3. searchProjectFiles in src/file-system/operations.ts allows the .backlog directory while keeping other dot-prefixed directories hidden.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

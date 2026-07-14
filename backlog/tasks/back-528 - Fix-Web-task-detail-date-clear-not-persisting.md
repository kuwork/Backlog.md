---
id: BACK-528
title: Fix Web task detail date clear not persisting
status: Done
assignee: []
created_date: '2026-07-14 06:59'
updated_date: '2026-07-14 07:14'
labels:
  - bug
  - web
  - frontend
dependencies: []
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/test/server-task-dates-endpoint.test.ts
priority: high
ordinal: 180400
actual_start: '2026-07-14 06:36'
actual_end: '2026-07-14 06:50'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the web task detail modal, clicking the browser date picker's "Clear" button for date fields (actual start/end, planned start/end, due date) did not actually remove the value from the saved markdown file. The client sent undefined for empty date values, which JSON.stringify drops, so the server never received the clear instruction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking 'Clear' in the date picker removes actual start/end from the task file
- [x] #2 Clearing due date, planned start/end also works
- [x] #3 Clearing dates in edit mode and clicking Save persists correctly
- [x] #4 Server API test covers clearing all date fields and a single field via empty string
<!-- AC:END -->







## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update all date onChange handlers in TaskDetailsModal.tsx to send value directly (empty string) instead of value || undefined.\n2. Update date fields in handleSave to send empty string instead of undefined when cleared.\n3. Add server-task-dates-endpoint.test.ts to verify empty string clears dates.\n4. Run tsc, biome check, and relevant tests to verify the fix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The server already supports clearing dates via empty string: handleUpdateTask accepts an empty string, applyOptionalDateField converts it to undefined, and deletes task.actualStart/actualEnd/etc. The bug was purely on the client side, where undefined values were dropped during JSON serialization.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the web task detail modal so that clicking 'Clear' on date fields (actual start/end, planned start/end, due date) actually removes them from the saved task file.\n\nRoot cause: the client sent undefined for empty date values, which JSON.stringify drops, so the server never received the clear instruction.\n\nChanges:\n- src/web/components/TaskDetailsModal.tsx: all date onChange handlers and handleSave now send an empty string instead of undefined.\n- src/test/server-task-dates-endpoint.test.ts: added tests verifying PUT /api/tasks/:id clears all or individual date fields when given empty strings.\n\nVerification:\n- bunx tsc --noEmit passes\n- npx biome check on modified files passes\n- bun test src/test/server-task-dates-endpoint.test.ts src/test/task-edit-preservation.test.ts passes
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

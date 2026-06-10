---
id: BACK-515
title: Fix Web API milestone update missing milestone in response
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-06 08:18'
updated_date: '2026-06-06 08:20'
labels:
  - bug
  - web-api
  - milestones
dependencies: []
priority: high
ordinal: 172400
actual_start: '2026-06-06 08:18'
actual_end: '2026-06-06 08:20'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PUT /api/milestones/:id returns success and message but omits the updated milestone object, causing web milestone rename tests to fail.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PUT /api/milestones/:id returns the updated milestone in the response
- [x] #2 server-search-endpoint rename test passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: handleUpdateMilestone only returned {success, message} without fetching and including the updated milestone after calling editMilestone.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed by loading the source milestone before edit to get the canonical ID, then reloading the updated milestone after editMilestone succeeds and including it in the JSON response. Also added a 404 guard when the source milestone is not found.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

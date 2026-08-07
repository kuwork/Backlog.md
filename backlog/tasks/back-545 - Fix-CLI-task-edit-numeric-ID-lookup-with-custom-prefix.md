---
id: BACK-545
title: Fix CLI task edit numeric ID lookup with custom prefix
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-06 23:53'
updated_date: '2026-08-07 00:41'
labels: []
dependencies:
  - BACK-364
references:
  - src/cli.ts
  - src/utils/task-path.ts
  - src/core/backlog.ts
  - src/test/acceptance-criteria.test.ts
  - src/test/task-edit-preservation.test.ts
priority: high
ordinal: 187400
actual_start: '2026-08-07 00:13'
actual_end: '2026-08-07 00:31'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-364 fixed numeric ID lookup in the core layer (core.loadTaskById / core.getTask), but backlog task edit still pre-normalizes the input with normalizeTaskId in src/cli.ts before calling core. When a project uses a non-default task prefix (e.g., back), a bare numeric ID like 544 is converted to TASK-544 instead of being resolved to the actual back-544 file. backlog task view BACK-544 --plain works because it passes the raw ID through.

This task removes the pre-normalization in task edit (both interactive wizard and non-interactive paths) so that core.loadTaskById receives the raw ID and can auto-detect the configured prefix, matching the behavior of view/archive/complete.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog task edit TASK_NUMBER --priority low succeeds when project task prefix is non-default and task file uses that prefix
- [x] #2 backlog task edit PREFIX-TASK_NUMBER --priority low continues to work
- [x] #3 backlog task edit task-TASK_NUMBER --ac ... continues to work for projects using default task prefix
- [x] #4 Wizard path (backlog task edit TASK_NUMBER in TTY) also resolves correct prefix
- [x] #5 Regression test covers custom-prefix numeric ID edit
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed normalizeTaskId pre-normalization from task edit wizard and non-wizard paths in src/cli.ts. The raw taskId is now passed to core.loadTaskById, allowing getTaskPath to auto-detect the configured prefix for numeric IDs. Subsequent edits use existingTask.id so the canonical prefixed ID is always used.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed backlog task edit for numeric IDs in projects with a custom task prefix by passing the raw ID to core.loadTaskById instead of pre-normalizing to the default task prefix. Added regression tests in src/test/task-edit-preservation.test.ts for both bare numeric IDs and prefixed IDs with a custom prefix. Verified with bun test, bunx tsc --noEmit, and bun run check .
<!-- SECTION:FINAL_SUMMARY:END -->

---
title: BACK-706 Stamp a milestone's actualEnd when its last task reaches a terminal status
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - milestones
  - core
source_path: backlog/tasks/back-706 - Stamp-a-milestones-actualEnd-when-its-last-task-reaches-a-terminal-status.md
---

# BACK-706 Stamp a milestone's actualEnd when its last task reaches a terminal status

The BACK-493 branch meant to auto-stamp a milestone's `actual_end` could never fire: it judged the task set via `fs.listTasks()`, but at that point the flipped task is still on disk with its pre-save status, so `every(isTerminalStatus)` was always false. This task makes the branch resolve the flipped task to its new status before judging.

## Summary

- Dead-branch diagnosis proven with instrumentation on a throwaway corpus: `listTasks()` returned "TASK-1:Done, TASK-2:In Progress" while TASK-2 was being flipped to Done, because `saveTask` runs after the milestone block; live repo evidence matched (m-9 had `actual_start` only)
- Fix in `src/core/backlog.ts` (`updateTask`, milestone auto-population): the flipped task is resolved to its new status by id against the `listTasks()` result before the all-terminal test; write site, guards (task has milestone, milestone loads, `actual_end` not already set) and save order unchanged
- Deliberately left as-is (recorded in the description): `POST /tasks/:id/complete` is a bare rename filling neither task nor milestone date; a task created directly into a terminal status doesn't close its milestone; drafts and archived tasks are invisible to `listTasks()` and never block closing
- Regression tests in `src/test/milestone-timestamps.test.ts`: `actual_end` appears only after the last task flips; an already-set `actual_end` and non-closing transitions stay untouched; mutation check confirmed the new case goes red without the fix
- Gates: `tsc`/biome clean; 79 pass across five milestone suites plus 13 pass on server/web milestone timestamp suites; end-to-end verified on a real throwaway corpus

## Acceptance Criteria

- Flipping the last active task stamps `actual_end`; a milestone with a still-open task gets none
- An existing `actual_end` and unrelated transitions are left untouched
- Regression coverage for both the last-task and still-open cases

## Related Concepts

- [[concepts/milestones]] — milestone lifecycle dates this task completes
- [[concepts/task-lifecycle]] — terminal-status transitions that drive the stamp

## Related Sources

- [[sources/milestone-actual-dates-task]] — earlier milestone actual-date field work
- [[sources/actual-dates-auto-create-task]] — task-level actual_start/actual_end auto-stamping

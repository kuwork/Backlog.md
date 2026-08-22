---
id: BACK-571
title: Fail fast instead of silently losing concurrent task edits
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-22 07:40'
labels:
  - migration
dependencies: []
references:
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/server/index.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/test/atomic-task-edit.test.ts
  - scripts/smoke-parallel-task-locking.sh
actual_start: '2026-08-22 06:37'
actual_end: '2026-08-22 07:03'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
updateTaskFromInput is an unlocked read-modify-write shared by CLI task edit, the MCP update_task tool, and the web PUT handler. Two concurrent edits of the same task silently lose one write while both callers report success. Silent data loss is the worst possible outcome for a tool whose whole value is a reviewable, trustworthy record of work.

Use filesystem-level locking that protects across separate backlog processes, and on contention FAIL FAST with a clear error such as "Edit failed: TASK-X is being modified by another process; retry if appropriate". No waiting, no re-read-and-merge, no automatic retry - the caller decides what to do. The web surface must return HTTP 409 and MCP must surface an appropriate operation error.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-575 and git show 4a0070c a95a72c e3dd0a4 as implementation reference.
- [x] #2 Concurrent edits of the same task never silently lose data: one edit succeeds and the other fails.
- [x] #3 The locking protects across separate backlog processes, not only within a single process.
- [x] #4 A losing CLI edit exits non-zero with a clear message naming the task and the contention.
- [x] #5 The web update endpoint returns HTTP 409 on contention.
- [x] #6 The MCP update_task tool returns an appropriate operation error on contention.
- [x] #7 No waiting, merging, or automatic retry happens on contention.
- [x] #8 A concurrency test proves lost-update protection.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/file-system/operations.ts: extract the shared proper-lockfile mechanics of withCreateLock into a private withLockTarget(target, lockDir, settings, toError, fn) and add FileSystem.withTaskLock(task, fn) beside it. The task lock is FAIL FAST (retries: 0), uses the backlog directory for the lockfile, and targets the task file itself (proper-lockfile keys its in-process registry by target path, so a shared target with per-task lockfile paths would corrupt concurrent in-process locks). Add ETASKLOCK / isTaskLockError / taskLockErrorMessage(taskId) producing 'Edit failed: <id> is being modified by another process; retry if appropriate.'.
2. src/core/backlog.ts: wrap the read-modify-write in updateTaskFromInput with fs.withTaskLock and re-read the task inside the lock. The re-read is required for correctness, not merging: a lock around the write alone still loses an update when writer A releases before writer B acquires, because B would then apply its mutation to a pre-lock snapshot.
3. src/core/backlog.ts: move the task lock into demoteTaskWithUpdates with the same in-lock re-read, so both updateTaskFromInput and editTaskOrDraft are protected.
4. Surface the contention error: web PUT /api/tasks/:id returns 409 (extend the isCreateLockError mapping in src/server/index.ts), MCP task_edit throws BacklogToolError OPERATION_FAILED (src/mcp/tools/tasks/handlers.ts editTask), CLI needs no change (formatTaskEditError already prints error.message and sets exit code 1) - add a test to lock that in.
5. Tests: new src/test/atomic-task-edit.test.ts with fail-fast semantics - N concurrent same-task edits, assert at least one success, every failure is a task-lock error naming the task, and the final file contains exactly the successful writers' labels and nothing else; concurrent edits of different tasks stay independent; escape hatch bypasses the lock. Plus a cross-process proof (real CLI subprocesses) since AC #2 is about separate processes.
6. scripts/smoke-parallel-task-locking.sh: add scenario 4, parallel 'task edit' from separate CLI processes over a board pre-filled with filler tasks to widen the race window; assert every job either exits 0 or fails loudly with the contention message, and that the final file content matches exactly the jobs that exited 0.
7. Verify: bunx tsc --noEmit, bun run check ., new + existing lock/edit tests, full bun test, and the smoke script.
Out of scope (follow-ups): reorderTask/updateTasksBulk, draft edits (updateDraftFromInput), and the TUI external-editor write path.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Progress

- Ported the fail-fast task edit lock from the upstream reference.
- src/file-system/operations.ts: added FileSystem.withTaskLock, isTaskLockError, taskLockErrorMessage, and refactored withCreateLock/withLockTarget to share the proper-lockfile mechanics.
- src/core/backlog.ts: wrapped updateTaskFromInput and demoteTaskWithUpdates in fs.withTaskLock with an in-lock re-read so the whole read-modify-write is protected.
- src/server/index.ts: web PUT /api/tasks/:id now returns HTTP 409 on task lock contention.
- src/mcp/tools/tasks/handlers.ts: MCP task_edit now reports OPERATION_FAILED on task lock contention.
- scripts/smoke-parallel-task-locking.sh: added scenario 4 for parallel task editing; fixed the file lookup to use find for cross-shell compatibility.
- src/test/atomic-task-edit.test.ts: new 9-test concurrency suite covering in-process races, cross-process CLI races, demotion races, web 409, MCP OPERATION_FAILED, and the USE_GLOBAL_TASK_ID_LOCK=false escape hatch.

Verification:
- bunx tsc --noEmit passes.
- bun run check . passes (only pre-existing warnings in src/core/assets.ts remain).
- bun test src/test/atomic-task-edit.test.ts src/test/cli-zero-padded-ids.test.ts src/test/cli-commit-behaviour.test.ts: 20 pass / 0 fail.
- scripts/smoke-parallel-task-locking.sh: all 4 scenarios pass.
- Full bun test: 1804 pass / 13 skip / 39 fail across 1856 tests in 213 files. The 39 failures are unrelated to this change (multi-line CLI escape handling, priority filtering timeouts, Claude agent install content mismatch, heading/MermaidMarkdown formatting, MCP bootstrap schema docs, TUI edit timeout, and web popup documentation display). No failure involves the task edit lock path or the files modified for this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the silent-lost-update hole in the task edit funnel by adding a fail-fast, filesystem-level per-task lock.

FileSystem.withTaskLock sits beside the existing withCreateLock and shares its proper-lockfile mechanics through a new withLockTarget helper, but is configured with retries: 0. On contention the loser gets 'Edit failed: <id> is being modified by another process; retry if appropriate' immediately; nothing waits, merges, or retries. Core.updateTaskFromInput and demoteTaskWithUpdates now run their read-modify-write inside that lock, re-reading the task inside it so the critical section covers the read. Locking demoteTaskWithUpdates itself (rather than the Draft branch of updateTaskFromInput) closes the funnel for MCP's editTaskOrDraft path too. The lockfile lives under the project's backlog directory and targets the task file itself.

CLI edits already print error.message and exit non-zero, so no CLI change was needed; a test locks that behavior in. Web PUT /api/tasks/:id returns HTTP 409 on contention. MCP task_edit reports OPERATION_FAILED on contention.

Verified with a 9-test concurrency suite (src/test/atomic-task-edit.test.ts) and a new smoke scenario. Six concurrent edits leave the file matching exactly the writers told they succeeded; a real CLI subprocess is blocked by a lock held in another process and succeeds on retry; the Draft demotion race and both MCP entry points are covered. The USE_GLOBAL_TASK_ID_LOCK=false escape hatch still bypasses the lock.

bunx tsc --noEmit clean; bun run check . clean (only pre-existing src/core/assets.ts warnings remain); targeted tests pass; smoke script all four scenarios pass. Full bun test shows 1804 pass / 13 skip / 39 fail; all 39 failures are in unrelated areas (CLI multi-line escape handling, priority filtering timeouts, agent install content, UI formatting, MCP docs, TUI edit timeout, web popup docs) and none touch the modified lock/edit path.
<!-- SECTION:FINAL_SUMMARY:END -->

---
title: Fail fast instead of silently losing concurrent task edits
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - migration
  - concurrency
  - core
  - bug
source_path: backlog/tasks/back-571 - Fail-fast-instead-of-silently-losing-concurrent-task-edits.md
---

# Fail fast instead of silently losing concurrent task edits

Closed a silent data-loss hole in the task edit funnel: `updateTaskFromInput` was an unlocked read-modify-write shared by CLI `task edit`, the MCP `update_task` tool, and the web PUT handler, so two concurrent edits of the same task silently lost one write while both reported success. The fix adds a filesystem-level, fail-fast per-task lock (proper-lockfile, `retries: 0`) that protects across separate backlog processes; on contention the loser gets an immediate error, with no waiting, merging, or automatic retry. Web returns HTTP 409, MCP reports `OPERATION_FAILED`, CLI exits non-zero.

## Summary

- `src/file-system/operations.ts`: extracted shared proper-lockfile mechanics of `withCreateLock` into a private `withLockTarget(target, lockDir, settings, toError, fn)` and added `FileSystem.withTaskLock(task, fn)` beside it; new `ETASKLOCK` code with `isTaskLockError` / `taskLockErrorMessage(taskId)` producing `Edit failed: <id> is being modified by another process; retry if appropriate.`
- Lock targets the task file itself (proper-lockfile keys its in-process registry by target path, so per-task lockfile paths would corrupt concurrent in-process locks); the lockfile lives under the project's backlog directory; stale timeout 10s.
- `src/core/backlog.ts`: wrapped `updateTaskFromInput` and `demoteTaskWithUpdates` in `fs.withTaskLock` with an in-lock re-read — the re-read is required for correctness, not merging, so the critical section covers the read. Locking `demoteTaskWithUpdates` itself closes the funnel for MCP's `editTaskOrDraft` path; lock order is always task lock → create lock (no deadlock).
- Error surfacing: web PUT `/api/tasks/:id` returns 409 (extended the `isCreateLockError` mapping in `src/server/index.ts`); MCP `task_edit` throws `BacklogToolError` `OPERATION_FAILED` (`src/mcp/tools/tasks/handlers.ts`); CLI needed no change (`formatTaskEditError` already prints the message and exits 1), locked in by a test.
- `USE_GLOBAL_TASK_ID_LOCK=false` escape hatch bypasses the lock (preserved from upstream).
- Tests: new 9-test suite `src/test/atomic-task-edit.test.ts` (in-process races, cross-process CLI subprocess races, demotion races, web 409, MCP error, escape hatch); `scripts/smoke-parallel-task-locking.sh` gained scenario 4 (parallel `task edit` from separate CLI processes over a board pre-filled with filler tasks to widen the race window, asserting the final file matches exactly the jobs that exited 0).

## Acceptance Criteria

- Concurrent edits of the same task never silently lose data: one succeeds, the other fails.
- Locking protects across separate backlog processes, not just within one process.
- Losing CLI edit exits non-zero with a message naming the task and contention; web returns 409; MCP returns an operation error.
- No waiting, merging, or automatic retry on contention; a concurrency test proves lost-update protection.

## Related Concepts

- [[concepts/core-architecture]] — the lock lives in the FileSystem layer beneath Core's read-modify-write funnel
- [[concepts/task-lifecycle]] — covers both `updateTaskFromInput` and draft demotion (`demoteTaskWithUpdates`) paths

## Related Sources

- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — classified this as entry A1 (must-merge, data-loss class)
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — CLI-1 deep analysis of the upstream fix (merge `3b4fab0`, PR #860)
- [[sources/back-555-tui-live-refresh-atomic-writes]] — adjacent concurrency work on atomic writes vs. the TUI file watcher

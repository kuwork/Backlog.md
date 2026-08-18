---
title: BACK-567 Treat same-path cross-branch task versions as one identity
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - core
  - identity
  - git
source_path: backlog/tasks/back-567 - Treat-same-path-cross-branch-task-versions-as-one-identity.md
---

# BACK-567 Treat same-path cross-branch task versions as one identity

Introduced a shared task identity keyed by canonical ID plus normalized repository-relative logical path so cross-branch versions of the same task merge instead of colliding.

## Summary

- Added `src/core/task-identity-index.ts`: groups records by `canonicalTaskId + normalizeRecordPath`; deterministic winner (working copy first, then most recent, then most progressed); distinct live paths throw `AmbiguousTaskIdError`; all-archived identities hide and free the ID.
- Added `canonicalTaskId` helper in `src/utils/task-path.ts` for zero-padding-insensitive dotted-decimal grouping.
- `src/core/task-loader.ts`: branch records attach hydrated content to indexed paths.
- `src/core/backlog.ts`: removed `buildLatestStateMap` and `filterTasksByStateSnapshots`; `loadTasks`/`loadAllTasksForStatistics` build one `TaskIdentityIndex` and project via `getTasks(includeCompleted)`; `getTask` detects ambiguous IDs and fails closed.
- `src/server/index.ts` `handleGetTask`: resolves through `core.getTask` and returns `409` with candidates on ambiguity.
- Equal-timestamp resolution is now deterministic and scan-order independent, fixing the live-ID release race.

## Implementation Notes

Preserved the fork's `cross-branch-tasks.ts` `getLatestTaskStatesForIds` (recent-branches-only semantics) driving the TUI board filter; only the identity/merge layer was replaced. Used fork `getStoredUtcTimestamp` for date parsing.

## Related Concepts

- [[concepts/task-identity]] — Shared task identity model
- [[concepts/core-architecture]] — Core data flow

## Related Sources

- [[sources/back-568-core-browser-task-boundary]] — Core browser boundary builds on identity index

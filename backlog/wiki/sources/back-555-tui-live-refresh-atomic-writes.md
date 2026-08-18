---
title: BACK-555 TUI live refresh resilient to atomic writes
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - tui
  - file-watcher
  - concurrency
source_path: backlog/tasks/back-555 - Make-TUI-live-refresh-resilient-to-atomic-writes.md
---

# BACK-555 TUI live refresh resilient to atomic writes

Repairs the TUI live refresh race where CLI atomic writes emit a single filesystem event that the watcher may consume before the task file is stable and readable.

## Summary

- Reworked `src/utils/task-watcher.ts` into a bounded reconciliation model: debounce events by normalized ID, require two stable readable reads, retry transient partial/missing content within a finite budget, suppress duplicate publications, cancel stale generations, and reconcile the directory when atomic writes expose only a temporary-file event.
- Reworked inline callbacks in `src/ui/unified-view.ts` into a single `applyUnifiedTaskUpdate` callback pipeline that publishes refreshed task/configuration snapshots to both the board and the active task list while preserving fork milestone wiring.
- Added a live-update subscription option to `src/ui/task-viewer-with-search.ts` so the task list rebuilds its search index and filters from the reconciled state.
- Added `extractTaskIdFromFilename` export in `src/utils/task-path.ts` for reuse by the watcher.
- Selection stays valid when the selected task changes, moves status, archives, or deletes.

## Implementation Notes

Scope is the current checkout only; cross-branch and separate-worktree refresh are excluded. Verified by deterministic watcher tests, unified-view callback integration, and interactive PTY scenarios.

## Related Concepts

- [[concepts/cli-tui]] — TUI board and task list
- [[concepts/core-architecture]] — ContentStore and watcher data flow

## Related Sources

- [[sources/back-563-tui-intent-first-composer]] — Composer creation also refreshes the board

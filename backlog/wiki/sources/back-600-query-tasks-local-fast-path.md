---
title: BACK-600 Make common task commands avoid unnecessary cross-branch work
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - cli
  - performance
source_path: backlog/tasks/back-600 - Make-common-task-commands-avoid-unnecessary-cross-branch-work.md
---

# BACK-600 Make common task commands avoid unnecessary cross-branch work

`queryTasks` initialized the cross-branch ContentStore even when callers passed `includeCrossBranch: false`, so every local-only listing (task list, interactive pickers, parent existence checks, MCP task_list) paid for remote fetches and other-branch corpus scans before results were filtered to the working copy. This task added a local fast path that loads working-copy tasks directly from the filesystem, skipping all Git work while keeping result sets and ordering identical.

## Summary

- In `src/core/backlog.ts` `queryTasks`, an `includeCrossBranch: false` branch runs ahead of any ContentStore access: tasks load via `this.fs.listTasks()` and flow through the existing `applyFiltersAndLimit` helper, so local-only listings never initialize the ContentStore, fetch remotes, or enumerate branches.
- The free-text search branch of the fast path uses `createTaskSearchIndex` from `src/utils/task-search.ts` instead of booting SearchService.
- Default-scope queries keep full ContentStore semantics; single-task lookups keep their local-first resolution with the active-window fallback (no fail-closed behavior change).
- New `src/test/query-tasks-local-fast-path.test.ts` (6 tests) rigs `Core.loadTasks` to throw and proves the fast path resolves/filters/limits/searches without it, asserts parity against the store-backed result set, and proves default-scope queries still require the store.
- Real-repo smoke: `task list --plain` lists 305 tasks in ~0.85s wall time including Bun startup.

## Acceptance Criteria

- `queryTasks` with `includeCrossBranch: false` loads working-copy tasks through the filesystem loader without ContentStore initialization, remote fetches, or branch enumeration.
- Fast-path output matches the previous load-then-filter behavior (same task set, sort order, filters, search, limit).
- Calls without the flag keep ContentStore semantics; tests prove the Git-operation boundary.

## Related Concepts

- [[concepts/core-architecture]] — Query-layer fast path that bypasses the cross-branch corpus for local-only scopes.
- [[concepts/cli-entry]] — Local-only CLI listings (task list, pickers) as the primary beneficiaries.

## Related Sources

- [[sources/back-602-incremental-cross-branch-task-loading]] — Follow-up that made the cross-branch path itself fast and incremental, complementing this local fast path.
- [[sources/back-601-core-browser-publication-ownership]] — Part of the same B16 migration item on the cross-branch loading architecture.

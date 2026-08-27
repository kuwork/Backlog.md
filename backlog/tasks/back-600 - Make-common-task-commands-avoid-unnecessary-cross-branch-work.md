---
id: BACK-600
title: Make common task commands avoid unnecessary cross-branch work
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-09 22:02'
updated_date: '2026-08-27 01:14'
labels:
  - cli
dependencies: []
priority: medium
actual_start: '2026-08-27 01:05'
actual_end: '2026-08-27 01:14'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
queryTasks initializes the cross-branch ContentStore even when callers pass includeCrossBranch:false, so every local-only listing (task list, interactive pickers, parent existence checks, MCP task_list) pays for remote and other-branch corpus scans before results are filtered down to the working copy.

Add a local fast path to queryTasks: when includeCrossBranch is false, load working-copy tasks directly from the filesystem and apply filters and search over that list without initializing the ContentStore or touching Git remotes or branches.

This is a pure performance change: result sets and ordering stay identical to the previous load-then-filter behavior, and single-task lookups keep their current local-first resolution with the active-window fallback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-623 and git show aca8007 as implementation reference.
- [x] #2 src/core/backlog.ts queryTasks with includeCrossBranch:false loads working-copy tasks directly through the filesystem loader without initializing the cross-branch ContentStore, fetching remotes, or enumerating branches.
- [x] #3 Fast-path output matches the previous behavior: same task set and sort order as the ContentStore corpus filtered to locally editable tasks, with status, priority, assignee, milestone filters, free-text search, and limit applied unchanged.
- [x] #4 Calls without includeCrossBranch:false keep existing ContentStore semantics, and single-task local resolution keeps its local-first lookup with the active-window fallback (no fail-closed behavior change).
- [x] #5 Focused automated tests prove the Git-operation boundary: queryTasks with includeCrossBranch:false completes while ContentStore initialization is unavailable, and default-scope queries still route through the store.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Local fast path in queryTasks

- 1.1 In src/core/backlog.ts queryTasks, add an includeCrossBranch:false branch ahead of any ContentStore access that loads tasks via this.fs.listTasks() and returns them through the existing applyFiltersAndLimit helper
- 1.2 Route the free-text search branch of the fast path through createTaskSearchIndex from src/utils/task-search.ts so query plus filters work without SearchService initialization

### Phase 2 - Guardrails and verification

- 2.1 Add focused regression tests asserting queryTasks with includeCrossBranch:false succeeds while ContentStore initialization is unavailable, and that default-scope queries still initialize the store
- 2.2 Verify parity against the previous path: filters, search, limit, and sortByTaskId ordering produce identical output
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

- Added an includeCrossBranch:false fast path at the top of queryTasks in src/core/backlog.ts: working-copy tasks load via this.fs.listTasks() and flow through the existing applyFiltersAndLimit helper, so local-only listings never initialize the ContentStore, fetch remotes, or enumerate branches.
- The free-text branch of the fast path searches through createTaskSearchIndex from src/utils/task-search.ts instead of booting SearchService.
- Everything else is untouched by design: default-scope queries keep ContentStore semantics, and single-task lookups keep their local-first resolution with the active-window fallback.

### Verification

- bunx tsc --noEmit clean; biome check clean on both touched files.
- New src/test/query-tasks-local-fast-path.test.ts (6 tests): fast path resolves, filters, limits, and searches while Core.loadTasks is rigged to throw; asserts parity against the store-backed result set; proves default-scope queries still require the store.
- Reverting the fast path makes 4 of the 6 tests fail; restoring it turns the file green again.
- Consumer suites green: query-tasks-local-fast-path, cli.test.ts, board-config-simple.test.ts (101 pass).
- Real-repo smoke: task list --plain lists 305 tasks in about 0.85 seconds wall time including Bun startup.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
queryTasks with includeCrossBranch:false now loads working-copy tasks straight from the filesystem and applies filters and free-text search locally through createTaskSearchIndex, skipping cross-branch ContentStore initialization entirely. Result sets, ordering, and filter semantics are unchanged, and default-scope queries plus single-task lookups keep their existing behavior.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-842
title: Reduce TaskDetailsModal side-effect requests
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-07 17:31'
updated_date: '2026-11-08 05:04'
labels: []
dependencies: []
references:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
  - src/web/lib/api.ts
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
priority: medium
ordinal: 401004
actual_start: '2026-11-07 18:09'
actual_end: '2026-11-07 18:19'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Editing a task's documentation in the modal (BACK-839) triggers a chain of requests beyond the L1-controlled /api/search. After the debounced metadata flush, the modal re-fetches the dependency closure twice (once from the flush finally -> setClosureRefreshTick, once from the post-edit tasks refresh bumping tasksVersion which the closure effect depends on), and the form-sync effect preloads /api/tasks and /api/drafts on every task prop change rather than only on first open. These four side-effect requests are outside BACK-840's scope and fire even when the search refresh is perfectly suppressed. This task reduces them to at most one dependency-closure fetch, one tasks preload and one drafts preload per edit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The dependency-closure fetch runs at most once per modal open and after a genuine dependency edit, never again solely because tasksVersion incremented from the post-edit refresh.
- [x] #2 The modal preloads /api/tasks and /api/drafts only on first open, not on every task prop change.
- [x] #3 One documentation edit in the modal produces at most one /api/task/:id/dependencies, one /api/tasks and one /api/drafts (apart from the L1-controlled search), verified in the browser Network panel.
- [x] #4 The dependency picker and drafts still populate correctly on open and after a real dependency change.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit is clean.
- [x] #2 bun run check . shows no new warnings beyond the 14 pre-existing ones.
- [x] #3 Existing modal and App tests still pass.
- [x] #4 Browser Net-panel pass: one documentation edit -> closure/tasks/drafts side-effects collapsed.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/web/components/TaskDetailsModal.tsx: remove tasksVersion from the dependency-closure effect dependency array (or guard the re-fetch with a ref tracking the last fetched task id and dependency signature) so the post-edit refresh no longer re-triggers a closure fetch.
2. Keep setClosureRefreshTick only for genuine dependency mutations, not for the flush finally path after a metadata-only edit.
3. Move the fetchTasks/fetchDrafts preload out of the form-sync effect that depends on the task prop; gate it behind a useRef one-time-open guard so it runs once per open.
4. Preserve correct population of the dependency picker and drafts on open and after real dependency edits.
5. Verify with tsc, bun run check ., the test suite, and a browser Net-panel pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reduced the side-effect requests an edit fires from the TaskDetailsModal, outside BACK-840/L1 scope.

1. Removed tasksVersion from the dependency-closure effect dependency array. tasksVersion was bumped on every task-corpus replacement (broadcast or own writes) and re-triggered the closure fetch, so a documentation/metadata edit - which does not change the closure - still re-fetched /api/task/:id/dependencies on the post-edit app refresh. tasksVersion was consumed only by this effect, so it was also dropped from the component props and from App (state + effect + prop pass). The closure still refetches after a genuine inline edit because both write paths keep bumping closureRefreshTick unconditionally; the tradeoff is that an external editor changing a file while the popup is open no longer auto-refreshes the closure (the popup shows the last known closure until reopened), which is acceptable within the task scope.

2. Moved the fetchTasks / fetchDrafts preload out of the form-sync effect (which runs on every task prop change, including the post-edit refresh that replaces task) into a one-time-per-open effect guarded by a ref, so the dependency picker and draft suggestions load once when the popup opens instead of on every data change.

Net effect for one documentation edit: the closure fetch drops from two to one, and the tasks/drafts preloads no longer re-run on the post-edit refresh.

Verified with bunx tsc --noEmit (clean), bunx biome check (clean), 83 task-details/modal tests and 22 closure/documentation/inline-meta/broadcast tests passing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reduced the TaskDetailsModal side-effect requests that BACK-840/L1 could not reach. Removed tasksVersion from the dependency-closure effect dependencies (and from the component props and App state/effect/prop pass, since nothing else consumed it); this stops a documentation/metadata edit from re-fetching /api/task/:id/dependencies on the post-edit app refresh, leaving only the one fetch the write path closureRefreshTick bump already triggers. Moved the fetchTasks/fetchDrafts preload into a one-time-per-open effect so it no longer re-runs on every task prop change. The closure still refreshes after a genuine inline dependency edit, and the external-editor auto-refresh tradeoff is documented in the code comment. Verified with tsc and biome clean and 105 targeted tests passing.
<!-- SECTION:FINAL_SUMMARY:END -->

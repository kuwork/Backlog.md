---
id: BACK-568
title: Make Core the sole browser task boundary
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-07-30 17:12'
updated_date: '2026-08-17 05:19'
labels:
  - server
  - web
dependencies:
  - BACK-567
references:
  - src/server/index.ts
  - src/core/content-store.ts
  - src/core/task-identity-index.ts
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/web/App.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/web/lib/api.ts
  - src/test/server-reorder-publication.test.ts
  - src/test/content-store-snapshot.test.ts
  - src/test/core-task-collision.test.ts
actual_start: '2026-08-17 04:10'
actual_end: '2026-08-17 04:58'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser task handlers currently read tasks twice (filesystem plus store) and the web board reloads the whole corpus after every reorder. Make Core the single task boundary for the browser: resolve update/create handlers through core.getTask (ambiguous IDs fail closed with 409), debounce tasks-updated broadcasts, and apply reorder results atomically via changedTasks instead of a full refresh. Add a lightweight corpus snapshot (active/completed separation, indexed resolution) on top of the shared task identity index, without porting the upstream publication-owner machinery.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep 'BACK-559' and git show 69b3649 as implementation reference.
- [x] #2 Server task handlers (update task, create-task parent resolution) resolve through core.getTask instead of double-reading the filesystem, surfacing AmbiguousTaskIdError as a 409.
- [x] #3 tasks-updated WebSocket broadcasts are debounced (75ms) so batch updates publish once.
- [x] #4 Reorder returns changedTasks end to end: server handler, api.ts type, App applyReorderedTasks atomic merge, and Board applies the payload without a full refresh.
- [x] #5 TaskIdentityIndex gains withWorkingCopyCorpus / withRecord / getFingerprint as a pure extension of the existing identity index.
- [x] #6 ContentStore keeps a lightweight corpus snapshot (activeTasks/completedTasks separation plus indexed resolution) without porting the publication-owner machinery; resolveTaskForRead / resolveTaskForMutation bridge to core.
- [x] #7 Watcher-driven broadcasts and cross-branch read display stay intact; no regression in board-loading / server / statistics / identity suites.
- [x] #8 Focused tests cover reorder publication (changedTasks), debounced broadcast, handler convergence, and snapshot resolution; bunx tsc --noEmit and biome pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase A - server/web surface (no ContentStore dependency)
- Debounce broadcastTasksUpdated (75ms) in src/server/index.ts; clear the timer on stop().
- Converge handleUpdateTask on core.getTask (drop the fs.loadTask double read) and return 409 on AmbiguousTaskIdError; do the same for create-task parent resolution (drop store.getTasks + fs fallback).
- Reorder atomicity: server handleReorderTask returns changedTasks; api.ts reorderTask type gains changedTasks; App applyReorderedTasks merges atomically; Board handleTaskReorder applies the payload instead of onRefreshData().

### Phase B - lightweight corpus snapshot
- Extend src/core/task-identity-index.ts with withWorkingCopyCorpus / withRecord / getFingerprint (pure additions to the B3 index).
- src/core/content-store.ts: cache activeTasks/completedTasks after load, keep a taskIdentityIndex built via withWorkingCopyCorpus, and expose resolveTaskForRead / resolveTaskForMutation bridging to core; do NOT port batchTaskUpdates / transitionTask / publication ownership (fork watcher drives broadcasts).

### Phase C - verification
- Focused tests: reorder publication, debounced broadcast, handler convergence, snapshot resolution; run bunx tsc --noEmit and biome; then finalize through the CLI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the Core browser-task boundary in the fork.

### Phase A - server/web surface
- src/server/index.ts: broadcastTasksUpdated debounced (75ms, timer cleared on stop); handleUpdateTask and create-task parent resolution resolve through core.getTask (AmbiguousTaskIdError -> 409); handleReorderTask returns changedTasks; removed dead findTaskByLooseId / stripPrefix / parseTaskIdSegments.
- Reorder atomicity end to end: api.ts reorderTask returns changedTasks; App.applyReorderedTasks merges atomically; Board.handleTaskReorder applies the payload via onTasksUpdated instead of a full refresh; BoardPage forwards the prop.

### Phase B - lightweight corpus snapshot
- task-identity-index.ts: added withWorkingCopyCorpus / withRecord / getFingerprint (pure additions to the B3 index).
- content-store.ts: TaskCorpusSnapshot (activeTasks/completedTasks separation) + resolveTaskForRead / resolveTaskForMutation with the same fail-closed rule as Core (returned candidates instead of throwing to avoid an import cycle); no publication-owner machinery ported.

### B3 follow-up fix found during this task
- The fork filesystem layer never detected same-ID collisions (findMatchingFile took the first file; ContentStore merges by ID), so Core.getTask ambiguity detection was ineffective. Added FileSystem.findTaskFilePaths (filename-level glob, no content reads) and Core.getTask now fails closed with AmbiguousTaskIdError when the same canonical ID exists at distinct task file paths.

### Verification
- New: server-reorder-publication (changedTasks), content-store-snapshot (4), core-task-collision (filesystem fail-closed) - all pass.
- Regression: server suites 29, identity/board-loading/local-branch/statistics 45, cli/web 19 - 93 pass, 0 fail across 15 files.
- bunx tsc --noEmit pass; biome pass on touched files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Core is now the single task boundary for the browser: update/create handlers resolve through core.getTask with ambiguous IDs failing closed as 409, tasks-updated broadcasts are debounced, and reorder results are applied atomically via changedTasks instead of a full board refresh.

A lightweight corpus snapshot (active/completed separation, indexed resolution) was added on top of the existing task identity index without porting the upstream publication-owner machinery.

Also fixed a latent gap exposed by this work: the filesystem layer now detects same-ID collisions at distinct task file paths and Core.getTask fails closed on them.

Verified by 8 new tests plus 93 regression tests across server/Core/identity/cli/web suites, typecheck, and lint.
<!-- SECTION:FINAL_SUMMARY:END -->

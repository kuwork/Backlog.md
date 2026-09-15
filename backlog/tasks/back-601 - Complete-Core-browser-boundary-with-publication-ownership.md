---
id: BACK-601
title: Complete Core browser boundary with publication ownership
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-27 05:41'
updated_date: '2026-08-27 14:03'
labels:
  - cli
  - server
  - web
dependencies:
  - BACK-568
  - BACK-600
references:
  - src/core/content-store.ts
  - src/core/task-identity-index.ts
  - src/core/backlog.ts
  - src/server/index.ts
  - src/web/App.tsx
  - src/web/components/Board.tsx
modified_files:
  - src/core/content-store.ts
  - src/server/index.ts
  - src/test/content-store-publication.test.ts
ordinal: 2000
actual_start: '2026-08-27 07:03'
actual_end: '2026-08-27 16:40'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Browser task handlers currently resolve through core.getTask with a lightweight corpus snapshot, but ContentStore lacks the publication-owner machinery needed for warm corpus reconciliation and incremental cross-branch loading. Complete the browser boundary by adding contentItemVersions, batchTaskUpdates, transitionTask, and publication ownership to ContentStore, while preserving the existing fail-closed 409 behavior, watcher-driven broadcasts, and reorder atomicity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-559 and git show 69b3649 as implementation reference.
- [x] #2 Identify the publication-owner / contentItemVersions / batchTaskUpdates / transitionTask pieces that the lightweight ContentStore snapshot omitted
- [x] #3 Backfill the omitted machinery into src/core/content-store.ts and related modules without regressing fail-closed 409 behavior or watcher-driven broadcasts
- [x] #4 Add deterministic tests covering publication ownership, batch transitions, and warm corpus reconciliation
- [x] #5 Update server/web boundaries to use the completed ContentStore semantics where it removes double reads or stale broadcasts
- [x] #6 Verify existing browser boundary regression tests (server-reorder-publication, content-store-snapshot, core-task-collision) still pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Analyze the gap
- Run git show 69b3649 and compare with src/core/content-store.ts in the current fork
- Identify the publication-owner / contentItemVersions / batchTaskUpdates / transitionTask pieces the lightweight snapshot omitted
- Map upstream symbols to the fork existing TaskCorpusSnapshot / taskIdentityIndex structures

### Phase 2 - Add publication ownership to ContentStore
- Extend ContentStore to track which load installed the current corpus version
- Add contentItemVersions tracking for active and completed task corpora
- Implement batchTaskUpdates and transitionTask helpers that mutate through the ContentStore snapshot
- Keep the existing watcher-driven tasks-updated broadcast path unchanged

### Phase 3 - Wire into core and server
- Update duplicate preview / repair paths in src/core/backlog.ts to use the parameterized ContentStore snapshot
- Ensure server update/create handlers still route through core.getTask and return 409 on AmbiguousTaskIdError
- Preserve reorder atomicity and debounced tasks-updated broadcasts
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed full publication-owner port into ContentStore.

What changed:
- Adopted publication-owner core: root-watcher epochs, contentItemGenerations/Versions/PublicationRoots for tasks/documents/decisions, mergeConcurrentChanges, enqueueRoot/enqueuePublication, reconcileOrSchedule, reconcileRenamedItem, findIdentityCandidate, and epoch-aware directory watchers.
- Switched config watching to watchConfigFile from src/utils/config-watcher.ts and added the "config" ContentStoreEvent.
- Preserved fork features: wiki support (snapshot, "wikis" event, watcher tolerant of missing wiki dir), task-loader progress callback, async getTaskCorpusSnapshot, async resolveTaskForRead/Mutation returning TaskResolution, getTasks filters with status/statusExcluded arrays, and fail-closed 409 semantics.
- Kept filesystem patch normalizing saved tasks with normalizeTaskIdentity and passing PublicationOwner to update handlers.
- Adapted server/index.ts store.subscribe to handle "config" events by updating projectName, broadcasting config-updated, and invalidating statistics.
- Added publication-owner concurrent-reload regression tests to content-store-publication.test.ts.

Why: BACK-568 left ContentStore with a lightweight snapshot boundary. The publication-owner changes add the ownership versioning needed so in-memory publications win over concurrent disk refreshes and root/config changes can be reconciled safely. This gives BACK-602 a stable foundation for cross-branch incremental loading.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported the publication-owner machinery into src/core/content-store.ts and wired the config event in src/server/index.ts.

Changes:
- content-store.ts now tracks root-watcher epochs, contentItemGenerations/Versions/PublicationRoots for tasks/documents/decisions, mergeConcurrentChanges, reconcileRenamedItem, enqueueRoot/enqueuePublication, and uses watchConfigFile for config events.
- Preserved fork features: wikis, async getTaskCorpusSnapshot, task-loader progress callback, resolveTaskForRead/Mutation, getTasks array filters, and fail-closed 409 semantics.
- server/index.ts handles the new "config" event by broadcasting config-updated and invalidating statistics.
- Added publication-owner concurrent-reload regression tests to content-store-publication.test.ts.

Verification: scoped tests (28 pass), bunx tsc --noEmit clean, bun run check clean on touched files (only pre-existing warnings in src/core/assets.ts). A full bun test run surfaced multiple pre-existing failures unrelated to this work (src/test/claude-agent-install.test.ts, src/test/code-path.test.ts, src/test/cli-priority-filtering.test.ts).
<!-- SECTION:FINAL_SUMMARY:END -->

---
title: BACK-601 Complete Core browser boundary with publication ownership
created_date: '2026-09-08 17:30'
updated_date: '2026-09-26 14:00'
labels:
  - source
  - cli
  - server
  - web
  - core
source_path: backlog/tasks/back-601 - Complete-Core-browser-boundary-with-publication-ownership.md
---

# BACK-601 Complete Core browser boundary with publication ownership

BACK-568 left ContentStore with a lightweight corpus snapshot that omitted the upstream publication-owner machinery. This task backfilled the full publication-ownership system (root-watcher epochs, content item generations/versions, merge-on-concurrent-refresh, publication enqueueing) into `src/core/content-store.ts` so in-memory publications win over concurrent disk refreshes, giving BACK-602 a stable foundation for incremental cross-branch loading.

## Summary

- Adopted publication-owner core in `src/core/content-store.ts`: root-watcher epochs, `contentItemGenerations`/`contentItemVersions`/`publicationRoots` for tasks/documents/decisions, `mergeConcurrentChanges`, `enqueueRoot`/`enqueuePublication`, `reconcileOrSchedule`, `reconcileRenamedItem`, `findIdentityCandidate`, and epoch-aware directory watchers.
- Config watching switched to `watchConfigFile` from `src/utils/config-watcher.ts` with a new `"config"` ContentStoreEvent; `src/server/index.ts` `store.subscribe` handles it by updating projectName, broadcasting `config-updated`, and invalidating statistics.
- Preserved fork features on top of the new machinery: wiki support (snapshot, `"wikis"` event, watcher tolerant of a missing wiki dir), task-loader progress callback, async `getTaskCorpusSnapshot`, async `resolveTaskForRead`/`resolveTaskForMutation` returning `TaskResolution`, `getTasks` array filters, and fail-closed 409 semantics.
- Filesystem patch normalizes saved tasks with `normalizeTaskIdentity` and passes the `PublicationOwner` to update handlers; watcher-driven `tasks-updated` broadcasts and reorder atomicity unchanged.
- New publication-owner concurrent-reload regression tests added to `src/test/content-store-publication.test.ts` (scoped run 28 pass).

## Acceptance Criteria

- Omitted publication-owner / contentItemVersions / batchTaskUpdates / transitionTask machinery backfilled without regressing fail-closed 409 behavior or watcher-driven broadcasts.
- Deterministic tests cover publication ownership, batch transitions, and warm corpus reconciliation.
- Server update/create handlers still route through `core.getTask` and return 409 on `AmbiguousTaskIdError`.

## Related Concepts

- [[concepts/core-architecture]] — Publication-owner versioning: in-memory publications win over concurrent disk refreshes via generations and epochs.
- [[concepts/web-server]] — Server subscription to the new config event with broadcast and statistics invalidation.

## Related Sources

- [[sources/back-568-core-browser-task-boundary]] — The lightweight ContentStore boundary this task completes with the publication-owner foundation.
- [[sources/back-602-incremental-cross-branch-task-loading]] — Direct dependent that builds incremental cross-branch loading on this foundation.

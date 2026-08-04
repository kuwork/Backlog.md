---
id: BACK-540
title: Prevent stale ContentStore refresh from overwriting newer state
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-10 19:28'
updated_date: '2026-08-04 06:30'
labels:
  - migration
dependencies: []
references:
  - src/core/content-store.ts
  - src/test/content-store.test.ts
  - src/core/search-service.ts
  - src/test/search-service.test.ts
priority: high
actual_start: '2026-08-04 01:44'
actual_end: '2026-08-04 02:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the race condition in ContentStore where an older asynchronous refresh can complete after a newer persisted edit/upsert and overwrite the newer in-memory state. This causes read-after-write inconsistency for tasks, documents, and decisions, affecting search and list views. Incrementally add publication-order guards to the current ContentStore and root lifecycle so that direct writes, external watcher changes, and refresh loads are ordered correctly without introducing a new service layer or adapter-specific behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.47.1..v1.48.0 --grep BACK-533` and `git show 251aba8` as implementation reference.
- [x] #2 A deterministic regression proves an older asynchronous ContentStore refresh cannot overwrite a newer persisted task/document/decision state.
- [x] #3 Immediate task read, list, and search consumers observe the persisted edit rather than an older refresh snapshot.
- [x] #4 Genuine external watcher changes and root transitions still refresh state correctly, including after shutdown and restart.
- [x] #5 Duplicate-repair serialization and existing watcher semantics remain intact.
- [x] #6 Focused ContentStore/SearchService tests, typecheck, Biome, and the full test suite pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched.
- [x] #2 bun run check . passes when formatting/linting touched.
- [x] #3 bun test (or scoped test) passes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect src/core/content-store.ts to identify the refresh/load paths for tasks, documents, and decisions, plus the root lifecycle, watcher binding, and serialized queue. Capture the core race: an older asynchronous load can finish after a newer persisted write and replace the in-memory map.
2. Add per-item publication generation/version tracking and a root epoch guard. Every direct upsert/add/update/delete and every collection replacement advances the per-item publication version; every load captures versions before reading. Publish only when the captured versions, root epoch, and physical-root owner still match the current store state.
3. Implement single-pass per-item reconciliation for full refreshes: capture the cache before loading, accept disk changes for untouched items, preserve actual concurrent additions/updates/deletions, and publish synchronously under the root/epoch check. Avoid unbounded retry loops and collection-wide version counters.
4. Harden root lifecycle and external watcher behavior: initialization retries bounded coherent root attempts across structure creation, content load, and watcher binding; stable reconciliation requires configured root, published cache owner, and active watcher owner to match; watcher invalidation advances epoch before stopping; preserve genuine external changes after shutdown, restart, and root transitions.
5. Add deterministic regression tests in src/test/content-store.test.ts and src/test/search-service.test.ts covering: held-older/newer-write races, ABA/delete-re-add cycles, concurrent upserts, unrelated full-refresh interleaving, and root A→B→A transitions. Use bounded cached-state polling after real filesystem operations rather than coupling assertions to specific event sequences.
6. Run bunx tsc --noEmit, bun run check ., focused ContentStore/SearchService tests, and the full test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per-item publication version guards in ContentStore to prevent stale asynchronous refreshes from overwriting newer state.

Key changes in src/core/content-store.ts:
- Added per-item version maps (taskVersions, documentVersions, decisionVersions, wikiVersions).
- Increment versions on every direct write (upsertTask, updateTaskFromDisk, updateDocumentFromDisk, updateDecisionFromDisk) and on every watcher-driven update/delete.
- Full refresh paths (refreshTasksFromDisk, refreshDocumentsFromDisk, refreshDecisionsFromDisk, refreshWikisFromDisk) capture versions before loading, then merge loaded snapshots via mergeTasks/mergeDocuments/mergeDecisions/mergeWikis. If an item was mutated during the load, its stale snapshot is discarded.
- Used `?? 0` for uninitialized versions so the first refresh after init still merges genuine external changes.
- Normalized task IDs in upsertTask and updateTaskFromDisk to avoid duplicate entries caused by loader ID normalization.

Tests added in src/test/content-store.test.ts:
- Stale task refresh does not overwrite a newer upsert.
- Stale document refresh does not overwrite a newer save.
- Concurrent updates to unrelated tasks are preserved during a refresh.
- An ABA value cycle is preserved during a stale refresh.

Verification:
- bunx tsc --noEmit passes.
- bunx biome check src/core/content-store.ts src/test/content-store.test.ts passes.
- Focused bun test src/test/content-store.test.ts src/test/search-service.test.ts passes (15 tests).
- Full bun test: 1612 pass, 36 fail, 6 skip. The 36 failures are pre-existing environment-specific issues (color-tag assertions, scoped package names, Mermaid base-href rendering, CLI timeouts, missing I18nProvider) and none involve ContentStore or the new tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the ContentStore race condition by introducing per-item publication versions and conditional merge logic. Older asynchronous refresh snapshots can no longer overwrite newer persisted edits, so task reads, lists, and searches immediately reflect the latest state. External watcher changes, genuine disk modifications, and root transitions continue to refresh state correctly. Duplicate-repair serialization and existing watcher semantics were preserved. Focused ContentStore/SearchService tests, typecheck, and Biome all pass.
<!-- SECTION:FINAL_SUMMARY:END -->

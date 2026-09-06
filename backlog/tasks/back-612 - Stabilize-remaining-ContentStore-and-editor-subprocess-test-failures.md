---
id: BACK-612
title: Stabilize remaining ContentStore and editor-subprocess test failures
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 08:16'
updated_date: '2026-09-06 19:47'
labels: []
dependencies: []
references:
  - src/test/content-store.test.ts
  - src/test/tui-edit-session.test.ts
  - src/test/task-watcher.test.ts
  - src/core/content-store.ts
modified_files:
  - src/core/content-store.ts
  - src/test/content-store.test.ts
  - src/test/tui-edit-session.test.ts
  - src/test/task-watcher.test.ts
ordinal: 217400
actual_start: '2026-09-06 08:17'
actual_end: '2026-09-06 08:43'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three ContentStore stale-refresh tests fail deterministically since BACK-602 added store-installing-only publication gating to upsertTask: upserts without a filePath under the backlog root or a matching publication owner are silently ignored, so the tests' synthetic upserts never apply. One of the three also feeds the store raw lowercase task IDs (task-1) from its disk loader while the store exposes normalized uppercase IDs (TASK-1), so the stale refresh never matches the upserted entries. Separately, the Core.editTaskInTui tests and the real-filesystem task watcher reconciliation test keep hitting Bun's default 5000ms per-test timeout on Windows under full-suite parallel load even though their internal waits are already platform-scaled. Update the ContentStore tests to pass a publication owner rooted at the test backlog directory and normalize the loader-provided IDs with normalizeTaskId, and raise the per-test/default timeout for the editor-subprocess and watcher test files, following the setDefaultTimeout pattern already used in cli-dependency.test.ts. The publication gating itself is intended BACK-602 behavior and must not be weakened.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The three stale-refresh ContentStore tests pass with publication ownership provided
- [x] #2 tui-edit-session and task-watcher tests no longer die on Bun's 5000ms default under load
- [x] #3 bun test src/test/content-store.test.ts src/test/tui-edit-session.test.ts src/test/task-watcher.test.ts passes
- [x] #4 bunx tsc --noEmit and bun run check pass on touched files
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. content-store.test.ts: pass a publication owner ({root: resolved backlogDir}) to the upsertTask calls in the three stale-refresh tests; normalize the disk-snapshot task IDs via normalizeTaskId (store and upstream normalizeId expose uppercase IDs) so loader data matches the store's canonical IDs, and keep assertions on uppercase TASK-1/TASK-2
2. tui-edit-session.test.ts and task-watcher.test.ts: raise the per-test timeout (setDefaultTimeout pattern) above Bun's 5000ms default
3. Run the three scoped test files plus tsc/biome
4. Confirm disappearance in the next full bun test run
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root-cause findings beyond the description: (1) Real bug in ContentStore.upsertTask — the identity-index rebuild branch used this.activeTasks as the base for withWorkingCopyCorpus, so a second in-memory upsert rebuilt from a stale activeTasks and evicted the first upsert; fixed to use this.cachedTasks (src/core/content-store.ts). (2) The concurrent-updates test also asserted uppercase TASK-1 while fixtures use lowercase task-1, and its custom loader returned raw lowercase IDs that never matched the store's normalized IDs. (3) The stale-refresh tests' synthetic tasks had no filePath, so the upsertTask filePath-based replacement filter treated unrelated fixtures as the same file; the test now takes a disk snapshot via normalizeIds(filesystem.listTasks()) after ensureInitialized and upserts tasks carrying their real filePaths. BACK-602 publication gating left untouched as intended behavior. Verification: scoped run of the three files 29 pass / 0 fail; bunx tsc --noEmit clean; biome clean on touched files (3 pre-existing warnings in src/core/assets.ts only); full bun test: 2071 tests, 0 fail, 13 skip (full-test-612.log).

Correction to the plan wording: assertions were never changed to lowercase. Store IDs are normalized to uppercase (same as upstream normalizeId in prefix-config.ts); the fix normalizes the test loader's disk-snapshot IDs via normalizeTaskId so they match the store's canonical uppercase IDs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the last 7 full-suite failures. Source change: ContentStore.upsertTask identity-index branch now rebuilds from cachedTasks instead of activeTasks, fixing consecutive in-memory upserts evicting each other (a real store bug). Test changes: content-store.test.ts stale-refresh tests now pass a publication owner rooted at the test backlog dir, use disk-snapshot tasks with real filePaths, and assert normalized task IDs; tui-edit-session.test.ts and task-watcher.test.ts use setDefaultTimeout(20000) for real editor-subprocess/watcher waits. BACK-602 publication gating not weakened. Verification: scoped 29/29 pass; tsc and biome clean; full bun test 2071 tests, 0 fail, 13 skip.
<!-- SECTION:FINAL_SUMMARY:END -->

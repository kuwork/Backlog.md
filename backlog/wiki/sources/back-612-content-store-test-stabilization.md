---
title: BACK-612 Stabilize remaining ContentStore and editor-subprocess test failures
created_date: '2026-09-06 19:47'
updated_date: '2026-09-06 19:47'
labels:
  - source
  - test
  - core
  - ci
  - bug
source_path: backlog/tasks/back-612 - Stabilize-remaining-ContentStore-and-editor-subprocess-test-failures.md
---

# BACK-612 Stabilize remaining ContentStore and editor-subprocess test failures

Fixed the last 7 full-suite failures: three ContentStore stale-refresh tests broke deterministically after BACK-602's publication-owner gating made their synthetic upserts silently ignored, plus two test files died on Bun's 5000ms default timeout on Windows. Root-causing surfaced a real store bug — the identity-index rebuild branch rebuilt from a stale `activeTasks` corpus, evicting earlier in-memory upserts — fixed by rebuilding from `cachedTasks`.

## Summary

- Real bug fix: `src/core/content-store.ts` `upsertTask` identity-index branch now rebuilds from `this.cachedTasks` instead of `this.activeTasks`, so consecutive in-memory upserts no longer evict each other
- `src/test/content-store.test.ts`: stale-refresh tests pass a publication owner rooted at the test backlog dir and upsert disk-snapshot tasks with real filePaths (synthetic no-filePath upserts are dropped by the BACK-602 replacement filter); loader IDs normalized via `normalizeTaskId` to the store's canonical uppercase IDs
- `src/test/tui-edit-session.test.ts` and `src/test/task-watcher.test.ts`: `setDefaultTimeout(20000)` (cli-dependency.test.ts pattern) for real editor-subprocess/watcher waits
- BACK-602 publication gating deliberately left untouched as intended behavior
- Verified: scoped 29/29; full bun test 2071 pass / 0 fail / 13 skip (`full-test-612.log`)

## Acceptance Criteria

- The three stale-refresh ContentStore tests pass with publication ownership provided
- tui-edit-session and task-watcher tests no longer die on Bun's 5000ms default under load
- `bun test` on the three files passes
- `bunx tsc --noEmit` and `bun run check` pass on touched files

## Related Concepts

- [[concepts/core-architecture]] — ContentStore upsert/identity-index internals and publication-owner gating
- [[concepts/task-identity]] — normalizeTaskId canonical uppercase identity matching the store

## Related Sources

- [[sources/back-561-autocommit-exact-files]] — neighboring stabilization task in the same test-reliability wave

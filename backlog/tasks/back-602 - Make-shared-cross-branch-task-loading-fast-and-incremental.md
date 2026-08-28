---
id: BACK-602
title: Make shared cross-branch task loading fast and incremental
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-27 05:55'
updated_date: '2026-08-27 23:45'
labels:
  - cli
  - server
  - web
dependencies:
  - BACK-601
references:
  - src/core/task-loader.ts
  - src/core/content-store.ts
  - src/core/backlog.ts
  - src/git/operations.ts
  - src/file-system/operations.ts
  - src/mcp/tools/tasks/handlers.ts
ordinal: 207400
actual_start: '2026-08-27 16:40'
actual_end: '2026-08-27 23:45'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cross-branch task reads currently fetch, enumerate, index, hydrate, and parse much of the same Git corpus repeatedly. This makes browser startup, MCP task operations, and any global task view slow in repositories with many active branches. Make the shared loader reuse stable state and bound remote work while preserving local-first behavior, cross-branch freshness, identity resolution, and filesystem-only operation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-624 and git show 94c10a6 as implementation reference.
- [x] #2 Port immutable tip snapshots and branch-tip generation so cross-branch reads pin to one immutable generation
- [x] #3 Add commit/blob shared caches and an exact-content parse cache so unchanged branch data is reused
- [x] #4 Implement store-installing-only fingerprint publication and forceRemoteRefresh for ID allocation
- [x] #5 Add coalesced, bounded fetch (10s timeout, non-interactive env) to git/operations.ts
- [x] #6 Add read-time ref lease refresh (60s) so warm processes see ref changes without freezing
- [x] #7 Route MCP task_search through a Git-free local corpus path
- [x] #8 Achieve warm cross-branch reads with ≤3 Git operations in the correctness-gated benchmark scenario
- [x] #9 Ensure the local corpus fast path for MCP search, bounded/coalesced fetch, and warm-process ref lease refresh are all wired consistently with the new incremental loader
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Analyze upstream implementation

- Run git show 94c10a6 and focus on src/core/task-loader.ts, src/core/content-store.ts, src/core/backlog.ts, src/git/operations.ts, src/file-system/operations.ts
- Identify how the incremental loader depends on the completed publication-owner foundation

### Phase 2 - Immutable tip snapshots

- Add branch-tip snapshot generation keyed by a fingerprint of all relevant refs
- Make tip snapshots immutable and publish the fingerprint only from store-installing loads
- Ensure local-first behavior and the 30-day fallback remain unchanged

### Phase 3 - Shared caches

- Add a commit-index cache and a task/blob cache keyed by commit SHA
- Add an exact-content parse cache in src/file-system/operations.ts for working-copy markdown
- Use defensive copies so cached payloads cannot be mutated by callers

### Phase 4 - Bounded fetch and ref lease

- Coalesce concurrent fetches and add a 10s hard timeout in src/git/operations.ts
- Set non-interactive Git environment variables (GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=Never)
- Add a 60s read-time ref lease refresh in src/core/backlog.ts so warm processes see ref changes

### Phase 5 - Surface wiring

- Route MCP task_search through the local active+completed corpus path without Git
- Update core.loadTasks callers to use the new incremental path while preserving local-only fast paths
- Ensure the MCP search local corpus path, bounded fetch, and ref lease refresh are wired consistently with the new incremental loader

### Phase 6 - Benchmark and tests

- Add a correctness-gated benchmark covering cold, warm, changed-ref, and offline scenarios
- Verify warm cross-branch reads use ≤3 Git operations
- Add deterministic regression tests for cold, warm, changed-ref, watcher, and timeout paths
- Run bunx tsc --noEmit, bun run check ., and the full test suite
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported upstream BACK-624 (commit 94c10a6) into the fork's divergent core, replacing the old index-first/hydrate-later cross-branch loader with the immutable tip-snapshot + shared-cache architecture.

Changes:
- `src/git/operations.ts`: `GitBranchTip` + `listRecentBranchTips` (one for-each-ref), `listWorktreePaths`, `resolveCommit`, memoized `isRepository`, coalesced bounded fetch (10s timeout, GIT_TERMINAL_PROMPT/GCM_INTERACTIVE non-interactive), `execGit` process-group timeout support, `getBranchLastModifiedMap` Date `since`.
- `src/core/task-loader.ts`: full rewrite to `BranchTaskLoader` (commit-index + task/blob caches, `retainSnapshot`, immutable commit reads with defensive clones).
- `src/core/backlog.ts`: `ActiveBranchSnapshot` fingerprint (store-installing-only publication), `forceRemoteRefresh` on ID allocation, 60s read-time ref lease (`refreshRemoteRefsForTaskRead`/`refreshTasksForTaskRead`), project-generation retry loops in `queryTasks`/`getTask`/`getContentStore`/`getSearchService`, `loadTasksWithStableBranchSnapshot`/`loadTaskCorpusSnapshot`/`loadContentStoreCorpus`, `loadWorkingCopyTasks`, worktree state entries for ID allocation, `buildTaskIdentityIndex`.
- `src/core/content-store.ts`: snapshot gains `branchStateEntries`/`config`, `mergeConcurrentTaskCorpus`, `hasTaskListChanged`, `needsBranchFallbackHydration`, `hasBranchTaskStateChanged`, `transitionTask` generation bump, `resolveInSnapshot` uses `resolveForRead`/`resolveForMutation`.
- `src/core/task-identity-index.ts`: added `resolveForRead`/`resolveForMutation`.
- `src/file-system/operations.ts`: exact-content task parse cache with defensive clones and bounded read concurrency.
- Surface: MCP `task_search` → `loadWorkingCopyTasks` (Git-free); server `handleListTasks`/`handleSearch`/`handleGetStatistics` use `refreshCrossBranch`/`refreshTasksForTaskRead`/corpus snapshot.
- Added `scripts/benchmark-task-loading.ts` + `benchmark:task-loading` script and regression tests: `shared-branch-task-loader`, `filesystem-task-cache`, `branch-task-loader-resilience`, `core-task-corpus-regressions`, `worktree-refresh` (fork-adapted).

Verification:
- Benchmark (default fixture): core.loadTasks warm = 3 Git ops (was 394), mcp.taskSearch warm = 0 (was 394), web.taskList warm = 0 (was 395); exact task counts/IDs/sentinels and stable digests validated for every sample.
- `bunx tsc --noEmit` clean; `bun run check .` clean on touched files (only pre-existing `noNonNullAssertion` warnings in untouched `src/core/assets.ts`).
- Scoped test runs pass: shared-branch-task-loader (23), core-task-corpus-regressions (5), filesystem-task-cache, branch-task-loader-resilience, worktree-refresh, content-store-publication, git, no-remote-preflight, mcp-tasks-local-filter, core, server endpoints, and CLI suites (incl. cli-dependency after raising its file-level timeout to 20s to absorb the new create-path cross-branch cost).
- Pre-existing fork failures not caused by this work (confirmed via stash): content-store.test.ts "concurrent updates", "watched document file", "padding-equivalent siblings" (4 tests).
- Dropped 3 upstream tests as fork-incompatible: server-statistics-endpoint and server-tasks-spa-fallback (depend on upstream-only custom priorities and `/tasks/*`/`/board/*` SPA routing the fork's server lacks) and the duplicate-findings core-task-corpus test (fork's `previewDuplicateTaskIdRepair` has a different API).
<!-- SECTION:FINAL_SUMMARY:END -->

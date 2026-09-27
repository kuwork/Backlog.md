---
title: BACK-602 Make shared cross-branch task loading fast and incremental
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - cli
  - server
  - web
  - performance
source_path: backlog/tasks/back-602 - Make-shared-cross-branch-task-loading-fast-and-incremental.md
---

# BACK-602 Make shared cross-branch task loading fast and incremental

Cross-branch task reads repeatedly fetched, enumerated, indexed, hydrated, and parsed the same Git corpus, making browser startup, MCP task operations, and global task views slow in repos with many branches. This task ported upstream BACK-624 (commit `94c10a6`), replacing the index-first/hydrate-later loader with an immutable branch-tip-snapshot plus shared-cache architecture, cutting warm cross-branch reads from ~394 Git operations to ≤3.

## Summary

- `src/git/operations.ts`: `GitBranchTip` + `listRecentBranchTips` (one for-each-ref), `listWorktreePaths`, `resolveCommit`, memoized `isRepository`, coalesced bounded fetch (10s hard timeout, process-group kill, `GIT_TERMINAL_PROMPT=0`/`GCM_INTERACTIVE=Never`), `execGit` timeout support, `getBranchLastModifiedMap` Date `since`.
- `src/core/task-loader.ts`: full rewrite to `BranchTaskLoader` with commit-index and task/blob caches keyed by commit SHA, `retainSnapshot`, immutable commit reads with defensive clones.
- `src/core/backlog.ts`: `ActiveBranchSnapshot` fingerprint published only from store-installing loads, `forceRemoteRefresh` on task-ID allocation (bypasses the 60s coalesced refresh window so two clones cannot hand out the same numeric ID), 60s read-time ref lease (`refreshRemoteRefsForTaskRead`/`refreshTasksForTaskRead`), project-generation retry loops, `loadTasksWithStableBranchSnapshot`/`loadTaskCorpusSnapshot`/`loadContentStoreCorpus`/`loadWorkingCopyTasks`, worktree state entries, `buildTaskIdentityIndex`.
- `src/core/content-store.ts`: snapshot gains `branchStateEntries`/`config`, `mergeConcurrentTaskCorpus`, `hasTaskListChanged`, `needsBranchFallbackHydration`, `hasBranchTaskStateChanged`, `transitionTask` generation bump, `resolveInSnapshot` via `resolveForRead`/`resolveForMutation`; `src/core/task-identity-index.ts` gained `resolveForRead`/`resolveForMutation`.
- `src/file-system/operations.ts`: exact-content task parse cache with defensive clones and bounded read concurrency.
- Surfaces: MCP `task_search` routes through `loadWorkingCopyTasks` (Git-free local corpus); server `handleListTasks`/`handleSearch`/`handleGetStatistics` use refresh/corpus-snapshot paths; document/decision-only searches skip task refresh.
- Correctness-gated benchmark (`scripts/benchmark-task-loading.ts`): Core `loadTasks` warm = 3 Git ops (was 394), MCP `taskSearch` warm = 0 (was 394), web `taskList` warm = 0 (was 395); every sample validates exact counts, IDs, sentinels, and stable digests.
- Fork adaptations: dropped 3 upstream tests as incompatible (server-statistics-endpoint, server-tasks-spa-fallback, duplicate-findings corpus test); raised cli-dependency file timeout to 20s for the new create-path cross-branch cost; regression suites added (shared-branch-task-loader, filesystem-task-cache, branch-task-loader-resilience, core-task-corpus-regressions, worktree-refresh).

## Acceptance Criteria

- Immutable tip snapshots and branch-tip generation pin cross-branch reads to one immutable generation.
- Commit/blob shared caches and an exact-content parse cache reuse unchanged branch data.
- Store-installing-only fingerprint publication and `forceRemoteRefresh` for ID allocation.
- Coalesced bounded fetch (10s timeout, non-interactive env) and 60s read-time ref lease refresh.
- MCP `task_search` routed through a Git-free local corpus; warm cross-branch reads use ≤3 Git operations in the benchmark scenario.

## Related Concepts

- [[concepts/core-architecture]] — Immutable tip snapshots, publication-owner generations, and shared caches as the cross-branch loading architecture.
- [[concepts/browser-loading]] — Browser/web task-list warm reads reusing the shared corpus instead of re-indexing branches.
- [[concepts/mcp-server]] — Git-free local corpus path for MCP task_search.

## Related Sources

- [[sources/back-601-core-browser-publication-ownership]] — Publication-owner foundation this task depends on.
- [[sources/back-600-query-tasks-local-fast-path]] — Complementary local-only fast path in queryTasks.
- [[sources/back-567-cross-branch-task-identity]] — Cross-branch task identity model the incremental loader must preserve.

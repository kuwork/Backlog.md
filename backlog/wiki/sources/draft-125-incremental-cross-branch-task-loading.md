---
title: draft-125 Make shared cross-branch task loading fast and incremental
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - draft
  - performance
  - core
source_path: backlog/drafts/draft-125 - Make-shared-cross-branch-task-loading-fast-and-incremental.md
---

# draft-125 Make shared cross-branch task loading fast and incremental

Original upstream task record (imported as a draft) for the incremental cross-branch task loading work: cross-branch reads repeatedly fetched, enumerated, indexed, hydrated, and parsed the same Git corpus, making browser startup, MCP task operations, and global task views slow in repos with many branches. The fork implemented it as BACK-602 (port of upstream BACK-624, commit `94c10a6`), building on the publication-owner foundation from BACK-601.

## Summary

- Core design: one shared immutable branch-tip snapshot per generation; cross-branch reads fetch once, validate structured before/after tip snapshots, pin reads to commit SHAs, deduplicate branch aliases and commit:path hydration, and reuse tree/history/task-payload work across unchanged generations.
- Working-copy active and completed Markdown uses an exact-content parse cache with defensive clones, bounded parallel reads, and path/root generations; warm reads reconcile local changes without re-indexing branches.
- MCP `task_search` uses the local active+completed identity corpus without Git; web task list/search/statistics reuse the shared corpus; document/decision-only searches skip task refresh.
- Concurrency hardening: only ContentStore corpus loads publish shared cross-branch freshness (`publishSharedState`), so standalone loads cannot freeze stale data; task-ID allocation sets `forceRemoteRefresh` to bypass the 60s coalesced refresh window (preventing duplicate numeric IDs across clones); cancellation checked before remote refresh.
- Correctness-gated benchmark (80 active / 20 completed / 6 branches × 12 tasks, 3 samples): Core cold improved from 534 ms / 394 Git processes to ~184–190 ms / 76; Core warm from 554 ms / 394 to ~27 ms / 3; MCP search warm from ~531 ms / 394 to ~4 ms / 0; every sample validates exact counts, IDs, sentinels, and stable digests.
- Regression coverage: deterministic tests for cold, warm, changed-ref, watcher, root/config, ambiguity, completed-task, and timeout paths (no wall-clock thresholds).

## Acceptance Criteria

- Cold shared-corpus load does not redundantly fetch/enumerate/resolve the same branch tips within one load.
- Repeated web and MCP reads reuse the initialized corpus without re-indexing unchanged tips; ref changes refresh only affected results.
- Remote refresh work is coalesced and time-bounded; before/after benchmark evidence records Git subprocess counts and elapsed time.

## Related Concepts

- [[concepts/core-architecture]] — Immutable tip snapshots, shared caches, and publication-gated freshness as the incremental loading design.
- [[concepts/browser-loading]] — Warm browser/web reads served from the shared corpus with no branch re-indexing.

## Related Sources

- [[sources/back-602-incremental-cross-branch-task-loading]] — The fork implementation task that fulfilled this draft.
- [[sources/back-601-core-browser-publication-ownership]] — The publication-owner foundation the design builds on.

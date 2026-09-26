---
title: BACK-699 Stop findIdentity rename fallback from publishing freshness without installing the corpus
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - core
  - bug
  - cross-branch
source_path: backlog/tasks/back-699 - Stop-findIdentity-rename-fallback-from-publishing-freshness-without-installing-the-corpus.md
---

# BACK-699 Stop findIdentity rename fallback from publishing freshness without installing the corpus

When a task file was renamed or deleted away with no branch-side copy, `ContentStore.findIdentity`'s rename fallback loaded the whole corpus to resolve one identity and threw it away — but the load went through the publishing loader, advancing `Core.activeBranchFingerprint` without installing anything. The next read then skipped the real refresh and served stale pre-move branch content.

## Summary

- `ContentStore` gained `TaskLoaderOptions = { publish?: boolean }`, threaded from `loadTasksWithLoader` into the `taskLoader` call; the rename fallback calls it with `{ publish: false }` because its load only resolves one identity and is discarded
- `src/core/backlog.ts`: the Core loader closure forwards the option into `loadContentStoreCorpus`, whose `publishSharedState` defaults to `true` — so `loadCurrentContent` and `refreshTasksFromDisk` keep publishing and publish-on-equal-corpus behavior is preserved
- The trigger proved narrower than assumed: the store runs one publishing config-stable read right after binding its watchers, which installs a fresh corpus and masks the fingerprint side effect — the first version of the regression case passed against the unfixed code
- Determinism comes from a `settleInitialContentReload(store)` helper that waits on the store's own `config` publication via `store.subscribe` instead of sleeping, so the worktree tip move cannot straddle the initial reload
- The second regression case (`reuses the warm store across reads`) was added after rollback variant D (flipping the default for installing callers) came back green — nothing pinned that installing callers still publish; it counts `refreshTasks` invocations rather than timing
- Verification: five-variant rollback matrix over three suites, each variant reddening only its causally responsible case; `core-task-corpus-regressions` 8 pass, `content-store` 16, `search-service` 7, `task-search-parity` 14; upstream reference `cd8f1297` (BACK-628) applied 1:1

## Acceptance Criteria

- The rename fallback either installs the corpus it loads or performs a non-publishing load (chose the latter)
- A non-publishing load no longer advances `activeBranchFingerprint`; installing callers keep publishing
- A regression test reproduces the trigger (warm corpus, out-of-band worktree tip move, delete local-only task, read) and fails pre-fix

## Related Concepts

- [[concepts/task-identity]] — `findIdentity` and its rename fallback
- [[concepts/core-architecture]] — ContentStore publication and the branch fingerprint

## Related Sources

- [[sources/back-567-cross-branch-task-identity]] — the cross-branch identity machinery the fallback belongs to
- [[sources/back-601-core-browser-publication-ownership]] — publication ownership rules this fix respects
- [[sources/back-602-incremental-cross-branch-task-loading]] — the corpus-loading path the fallback misused
- [[sources/back-540-content-store-stale-refresh-guard]] — an earlier stale-refresh guard on the same store

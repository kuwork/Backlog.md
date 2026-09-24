---
id: BACK-699
title: >-
  Stop findIdentity rename fallback from publishing freshness without installing
  the corpus
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-10 06:37'
updated_date: '2026-09-24 00:26'
labels: []
dependencies: []
references:
  - 'src/core/content-store.ts:31'
  - 'src/core/content-store.ts:157'
  - 'src/core/content-store.ts:1089'
  - 'src/core/content-store.ts:2188'
  - 'src/core/backlog.ts:358'
  - 'src/core/backlog.ts:3970'
  - 'src/test/core-task-corpus-regressions.test.ts:79'
  - 'src/test/core-task-corpus-regressions.test.ts:284'
  - 'src/test/core-task-corpus-regressions.test.ts:330'
modified_files:
  - src/core/content-store.ts
  - src/core/backlog.ts
  - src/test/core-task-corpus-regressions.test.ts
actual_start: '2026-09-24 00:00'
actual_end: '2026-09-24 00:26'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a task file is renamed or deleted away and neither the local tree nor any branch has a matching candidate, ContentStore.findIdentity's rename fallback loads the whole task corpus just to resolve a single task's identity, uses one entry of it and throws the rest away. That load goes through the publishing loader the store uses to install shared cross-branch state, so the throwaway load also advances Core.activeBranchFingerprint. The next read then sees the fingerprint already match and skips the full corpus refresh, serving the pre-move branch content until an unrelated ref or config change happens to heal it.

The trigger is narrow: the fallback only runs when the renamed-away task has no branch-side copy either (a fallback that does find a branch candidate forces a healing refresh instead). The fix direction is to stop that throwaway load from publishing on the store's behalf: either install the corpus it loads, or load it without publishing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-628 and git show cd8f1297 as implementation reference.
- [x] #2 The findIdentity rename fallback either installs the corpus it loads or performs a non-publishing load.
- [x] #3 A non-publishing fallback load no longer advances activeBranchFingerprint, while loadCurrentContent and refreshTasksFromDisk keep publishing what they install, so publish-on-equal-corpus behavior is preserved.
- [x] #4 A regression test reproduces the trigger (warm the shared corpus, move a branch tip out-of-band through a worktree, delete a local-only task with no branch-side copy, then read) and fails against the pre-fix code.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Stop the fallback load from publishing

- 1.1 In `src/core/content-store.ts`, add `TaskLoaderOptions = { publish?: boolean }` (`:31`) and widen the `ContentStore` constructor's `taskLoader` parameter to accept it as a second argument (`:157`).
- 1.2 Thread the option through `loadTasksWithLoader(progressCallback?, options?)` (`:2188`) into the `taskLoader` call (`:2194`), keeping the existing post-step that backfills `completedTasks`.
- 1.3 In the rename fallback (`:1089`), call `loadTasksWithLoader(undefined, { publish: false })` with a comment recording that this load only resolves one identity and is discarded, so it must not publish shared freshness state on the store's behalf.
- 1.4 In `src/core/backlog.ts`, forward the options through the ContentStore closure (`:358`) into `loadContentStoreCorpus(progressCallback?, options?)` (`:3944`) and change its last line (`:3970`) to `publishSharedState: options?.publish ?? true`, so `loadCurrentContent` and `refreshTasksFromDisk` keep publishing by default.

### Phase 2 - Regression coverage

- 2.1 Add "keeps serving fresh branch state after a rename fallback that never installed a corpus" (`:284`) to `src/test/core-task-corpus-regressions.test.ts`, modeled on the existing ID-allocation freshness case (`:256`): warm the shared corpus, move the `feature-stale` tip from a second worktree, delete the local-only task so the fallback runs, wait on `store.resolveTaskForRead("TASK-2")` becoming `not-found`, then assert `getTask("TASK-1")` returns the moved tip's title.
- 2.2 Add "reuses the warm store across reads instead of reloading the corpus every time" (`:330`), which pins the other half of AC #3: a store that installed its corpus must not reload on the next read. Counting `store.refreshTasks` invocations (instead of timing) shows the per-caller default still publishes.
- 2.3 Add a `settleInitialContentReload(store)` helper (`:79`) that waits for the single `config` publication the store performs right after binding its watchers (`store.subscribe`, bounded by `getPlatformTimeout(3000)`). That reload installs a fresh corpus, so a tip move straddling it masks the fallback's effect and leaves the case green against the buggy code.
- 2.4 Run both new cases before the fix and confirm they are red, then apply Phase 1 and confirm they turn green.

### Phase 3 - Gates and rollback matrix

- 3.1 `bunx tsc --noEmit`, `bun run check .`, and the touched suites plus the loaders' own suites (`core-task-corpus-regressions.test.ts`, `content-store.test.ts`, `content-store-publication.test.ts`, `search-service.test.ts`, `task-search-parity.test.ts`).
- 3.2 Rollback matrix (`tmp/rollback-699-in-place.py`) over three suites (regressions / store / publication), reverting one half at a time: A the fallback call site, B the option threading, C the Core-side default, D flipping the default for the installing callers, E the closure no longer forwarding the option. Each variant must redden only the cases it is causally responsible for.
- 3.3 Not in scope: `src/test/test-utils.ts` already exports `waitUntil`, which the new case reuses. The local copy in `content-store.test.ts` has a different signature (two parameters, 1000 ms default) and seven call sites, so folding it into the shared helper is a style-only rewrite that would move the existing cases' wait boundaries - left untouched.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Upstream reference `cd8f1297` (BACK-628) touches the same two files. Fork's rename fallback (`content-store.ts:1089`) and the Core loader closure (`backlog.ts:358`) were identical in shape to upstream's pre-fix code, so the patch applied 1:1; only the line numbers differ (this Plan was rewritten against fork's actual anchors - the draft said `:1080-1083` for the fallback and `:3936` for the loader).
- **The trigger is narrower than the draft assumed, and the first version of the case passed against the unfixed code.** A probe (`tmp/probe-699.ts`, instrumenting `Core.loadContentStoreCorpus` with a call stack) showed the fallback load does run at `content-store.ts:1089` - but the store also runs one *publishing* config stable read right after binding its watchers, which installs a fresh corpus and masks the fingerprint side effect. Reading `src/utils/config-watcher.ts` confirmed it fires on its first stable read after bind even with no content change (`cachedConfigContent` is still empty at that point).
- Determinism comes from waiting on the store's own `config` event via `store.subscribe` instead of sleeping: the helper returns as soon as that publication lands, so the tip move cannot straddle it. With that, the case reproduced reliably red (`Received: "Before ref move"`).
- AC #3's second half had no coverage at first: matrix variant D (flip the default for the installing callers) came back fully green, i.e. nothing pinned that `loadCurrentContent`/`refreshTasksFromDisk` still publish. The `reuses the warm store across reads` case was added for it (counts `refreshTasks` calls, so it is insensitive to timing); D now reddens exactly that case.
- Final matrix: A/B/C/E redden only the rename-fallback case, D reddens only the publication-direction case; the store and publication suites stay green in every variant, and sources are restored byte-exact.
- Gates: `bunx tsc --noEmit` clean; `bun run check .` exit 0; `core-task-corpus-regressions.test.ts` 8 pass, `content-store.test.ts` 16, `content-store-publication.test.ts` green, `search-service.test.ts` 7, `task-search-parity.test.ts` 14.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed `ContentStore.findIdentity`'s rename fallback so its throwaway corpus load no longer publishes shared freshness state. The store now threads a `{ publish?: boolean }` option from `loadTasksWithLoader` into the Core loader; the fallback requests `{ publish: false }`, while the per-caller default keeps `loadCurrentContent`/`refreshTasksFromDisk` publishing so that matching refs still short-circuit a reload. Two regression cases cover both directions (the fallback must not claim moved refs; an installing caller must still install), and a five-variant rollback matrix reddens only the causally responsible cases. `bunx tsc --noEmit` clean, `bun run check .` clean, touched suites green.
<!-- SECTION:FINAL_SUMMARY:END -->

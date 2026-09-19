---
id: BACK-660
title: Prevent forced allocation refresh from joining an in-flight stale fetch
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-10 06:37'
updated_date: '2026-09-19 01:30'
labels: []
dependencies: []
references:
  - 'src/core/backlog.ts:497'
  - 'src/core/backlog.ts:508'
  - 'src/core/backlog.ts:514'
  - 'src/test/core-task-corpus-regressions.test.ts:302'
  - 'src/test/shared-branch-task-loader.test.ts:584'
  - 'src/test/shared-branch-task-loader.test.ts:623'
  - 'src/test/shared-branch-task-loader.test.ts:663'
modified_files:
  - src/core/backlog.ts
  - src/test/core-task-corpus-regressions.test.ts
  - src/test/shared-branch-task-loader.test.ts
actual_start: '2026-09-19 01:24'
actual_end: '2026-09-19 01:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task-ID allocation forces a remote-ref refresh past the 60s lease, but `Core.refreshRemoteRefsForTaskRead` (`src/core/backlog.ts:481`) starts a new fetch only when its single `remoteRefRefreshPromise` slot is empty. A forced call that lands while a non-forced read's fetch is already in flight therefore joins that fetch and returns. The joined fetch captured remote state before the forced request arrived, so a push landing during its remaining duration (typically under 2s, capped at 10s) stays invisible and allocation can hand out a numeric ID another clone already published. The fork's method body is identical to the upstream pre-fix version, and its only allocation regression test completes the push before allocation starts, so the race is uncovered here too.

Fix: wait out whatever refresh is already in flight before joining or starting one, so the fetch a forced request ultimately observes always started after the request arrived. That wait opens an interleaving window the previous synchronous join-or-start did not have — `reinitializeProjectRoot` during it clears the slot and swaps `this.git`/`this.fs` — so the git handle is re-checked after the wait, mirroring the entry guard.

Out of scope, recorded for the record: `generateNextDocId`/`generateNextDecisionId` call `core.gitOps.fetch()` directly and bypass the Core slot, so a concurrent doc/decision allocation can still join an older git-level fetch. Closing that means deciding whether two concurrent fetches on one remote are acceptable, which is larger than this fix. A push landing during the post-request fetch itself also stays invisible; that needs server-side reservation, not a client-side wait.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-627` and `git show bc79cba50`, and confirm each stated change against the fork before porting it.
- [x] #2 A forced refresh that arrives while another refresh is in flight waits that refresh out and then fetches for itself, so the refs it ends up with come from a fetch that started after the request arrived.
- [x] #3 A forced refresh with nothing in flight still issues exactly one fetch, and a non-forced request keeps the join-or-start coalescing.
- [x] #4 The wait re-checks the git handle before starting its own fetch, so a project root swap during the wait cannot park an old-root fetch in the new project refresh slot.
- [x] #5 `Core.refreshRemoteRefsForTaskRead` matches the upstream post-fix body byte for byte.
- [x] #6 Regression tests cover the push-during-in-flight-fetch allocation race (allocation lands past the pushed task in exactly 2 fetches), the fetch-after-wait contract, the single fetch with nothing in flight, and the root swap.
- [x] #7 `bunx tsc --noEmit`, `bun run check .` and the touched suites pass, and every new case was first confirmed red against the unmodified code.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In `Core.refreshRemoteRefsForTaskRead` (`src/core/backlog.ts:481`) keep the non-forced lease short-circuit and the existing join-or-start coalescing unchanged, and hoist the force test into a local so both branches read the same decision.
2. Add the forced-only pre-wait ahead of the join-or-start: anything present in the slot at that moment started before the request, so awaiting it leaves the slot empty and the fetch joined below necessarily starts afterwards.
3. Re-check `git !== this.git` immediately after the wait. `reinitializeProjectRoot` runs synchronously through `disposeContentStore`, so a root swap during the wait would otherwise let the forced continuation install an old-project fetch into the new project's slot.
4. Add a regression test to `src/test/core-task-corpus-regressions.test.ts`: gate a mocked `git.fetch` so the real fetch captures remote state before a contributor push but withholds resolution, push a task from a clone while that fetch is in flight, then drive a concurrent `generateNextId()`; the allocation must land past the pushed task using exactly 2 fetches.
5. Add a regression test to `src/test/shared-branch-task-loader.test.ts` next to the existing old-root lease test, using that file's lightweight scaffolding: park a forced refresh in the pre-wait, swap the project root, release, and assert exactly one old-root fetch.
6. Confirm both new cases fail with `src/core/backlog.ts` reverted to HEAD, restore, then run `bunx tsc --noEmit`, `bun run check .` and the two suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The fork's `refreshRemoteRefsForTaskRead` was byte-identical to the upstream pre-fix body, so the race ported as-is: the only fork adjustment was the surrounding context (the force test is hoisted into a local so the lease check and the new pre-wait read the same flag).

Three parts, matching upstream:

1. Forced pre-wait. Any promise sitting in the single `remoteRefRefreshPromise` slot when the forced request arrives began before that request, so its captured refs can predate a push the caller must see. The forced path now awaits it first; the slot's clear handler is registered at creation, so it empties the slot ahead of any later awaiter's continuation, and the join-or-start below therefore always begins a fetch that starts after the request. Non-forced requests keep the plain join-or-start, and a forced request with an empty slot behaves exactly as before.

2. Post-wait re-check. `reinitializeProjectRoot` runs synchronously through `disposeContentStore`, which nulls the slot and swaps `this.git`/`this.fs`. Without the re-check, a forced continuation parked in the wait would resume on an empty slot and install an old-root fetch into the new project's slot, where a new-project read could join it and skip the refresh it needs. Returning early is safe for the old-project caller because `loadTasksWithStableBranchSnapshot` re-checks `projectChanged()` right after the refresh and retries.

3. Regression coverage. Four cases: the end-to-end allocation race (a gated `git.fetch` captures remote state before a contributor push but withholds resolution, a concurrent `generateNextId()` must land on TASK-3 in exactly 2 fetches), the fetch-after-wait contract, the single fetch when nothing is in flight, and the root swap during the wait.

Fork-specific test finding: `src/test/core-task-corpus-regressions.test.ts:262` already needed remote-tracking refs, and a sandboxed run on this machine cannot create `refs/remotes/origin/*` anywhere inside the workspace (`git update-ref refs/remotes/origin/x HEAD` exits 0 and leaves the ref absent, while the same command works outside the checkout), so that pre-existing case fails here regardless of this change - verified by reverting the implementation and reproducing the same TASK-2 result. The new allocation case therefore builds its project under `mkdtemp()` outside the checkout, which also keeps git from resolving upward to the source repository. The single-fetch half of AC #3 is asserted directly in the forced-refresh test rather than relying on that environment-sensitive sibling.

Residual risks, recorded rather than fixed: a push landing during the post-request fetch is still invisible to that allocation (needs server-side reservation), and `generateNextDocId`/`generateNextDecisionId` call `core.gitOps.fetch()` directly, bypassing the Core slot, so a concurrent doc/decision allocation can still join an older git-level fetch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the forced-refresh join race in `Core.refreshRemoteRefsForTaskRead`. A forced allocation refresh that arrived while a non-forced fetch was already in flight joined that fetch and returned, and because that fetch captured remote state before the force request, a push landing during its remaining duration stayed invisible: allocation could hand out a numeric ID another clone had already published. The forced path now waits out whatever refresh is already in flight before joining or starting one, so the refs it ends up with always come from a fetch that started after the request arrived. A forced request with nothing in flight still issues exactly one fetch, and non-forced reads keep the previous coalescing.

Because that wait is asynchronous, the git handle is re-checked after it: `reinitializeProjectRoot` during the wait nulls the refresh slot and installs new git/fs handles, and without the check the forced continuation would park an old-root fetch in the new project's slot, where a new-project read could join it and skip the refresh it needs.

The ported method body is byte-identical to the upstream post-fix version. Added four regression cases in two suites; the end-to-end allocation race lives outside the checkout because remote-tracking refs cannot be created under the workspace here, and that same limitation is why the pre-existing sibling allocation case fails in a sandboxed run with or without this change.
<!-- SECTION:FINAL_SUMMARY:END -->

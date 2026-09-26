---
title: BACK-660 Prevent forced allocation refresh from joining an in-flight stale fetch
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - core
  - git
  - concurrency
  - upstream-migration
source_path: backlog/tasks/back-660 - Prevent-forced-allocation-refresh-from-joining-an-in-flight-stale-fetch.md
---

# BACK-660 Prevent forced allocation refresh from joining an in-flight stale fetch

Task-ID allocation forces a remote-ref refresh past the 60s lease, but `Core.refreshRemoteRefsForTaskRead` only started a new fetch when its single promise slot was empty — a forced call landing while a non-forced fetch was in flight joined that stale fetch, so a push arriving during its remaining duration stayed invisible and allocation could hand out an ID another clone had already published. The forced path now waits out the in-flight refresh before joining or starting one.

## Summary

- Forced pre-wait: any promise in the single `remoteRefRefreshPromise` slot when the forced request arrives began before that request, so the forced path awaits it first; the slot's clear handler empties it ahead of any later continuation, so the fetch joined below always starts after the request — non-forced reads keep the plain join-or-start coalescing
- Post-wait git-handle re-check: the async wait opens an interleaving window where `reinitializeProjectRoot` nulls the slot and swaps `this.git`/`this.fs`; without the re-check a forced continuation would park an old-root fetch in the new project's slot
- The ported method body is byte-identical to the upstream post-fix version; the only fork adjustment is hoisting the force test into a local so the lease check and the pre-wait read the same flag
- Residual risks recorded, not fixed: a push landing during the post-request fetch itself stays invisible (needs server-side reservation), and `generateNextDocId`/`generateNextDecisionId` call `core.gitOps.fetch()` directly, bypassing the Core slot
- Test finding: a sandboxed run on this machine cannot create `refs/remotes/origin/*` inside the workspace (a pre-existing sibling allocation case fails here regardless), so the new end-to-end race case builds its project under `mkdtemp()` outside the checkout
- Four regression cases: the end-to-end allocation race (gated `git.fetch` + concurrent `generateNextId()` landing past the pushed task in exactly 2 fetches), the fetch-after-wait contract, single fetch with nothing in flight, and the root swap during the wait

## Acceptance Criteria

- A forced refresh arriving while another is in flight waits it out and then fetches for itself
- A forced refresh with nothing in flight issues exactly one fetch; non-forced requests keep join-or-start coalescing
- The wait re-checks the git handle so a project-root swap cannot park an old-root fetch in the new project's slot
- `Core.refreshRemoteRefsForTaskRead` matches the upstream post-fix body byte for byte
- Regression tests cover the push-during-in-flight allocation race, fetch-after-wait, single fetch, and root swap

## Related Concepts

- [[concepts/core-architecture]] — Core's remote-ref refresh slot and allocation path
- [[concepts/task-identity]] — numeric ID allocation correctness across clones
- [[concepts/upstream-migration]] — ports upstream BACK-627 (bc79cba50)

## Related Sources

- [[sources/back-571-fail-fast-concurrent-task-edits]] — sibling concurrency-hardening work in Core
- [[sources/back-538-duplicate-task-id-recovery]] — the failure mode allocation races can produce

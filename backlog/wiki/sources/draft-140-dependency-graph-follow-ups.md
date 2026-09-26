---
title: draft-140 Dependency graph follow-ups from BACK-548 review
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - graph
  - dependencies
  - web-ui
  - tui
source_path: backlog/drafts/draft-140 - Dependency-graph-follow-ups-from-BACK-548-review.md
---

# draft-140 Dependency graph follow-ups from BACK-548 review

Upstream BACK-663 (doc-12 CORE-28) imported as a draft: seven low-severity findings deferred from the PR #960 review of the bidirectional dependency graph. Disposition: five fixed, two closed as accepted behavior with reasoned notes; all upstream ACs checked.

## Summary

- Fixed: iterative explicit-stack walks in `appendTreeEntries` (`src/formatters/dependency-graph-text.ts`) and `buildDependencyTree` so a pathological chain (2500-deep test) can't exhaust the call stack; cursor-index BFS replacing quadratic `queue.shift()` in both traversals
- Fixed: filtered TUI corpus merge (`mergeDependencyCorpusTasks`) merges claimant **groups** instead of one record per canonical ID — uniquely claimed identities still get the live overlay, multiply claimed identities keep every claimant so `createTaskRecordIndex` reports ambiguous, matching the CLI's fail-closed answer
- Fixed: web graph corpus (`loadTaskCorpus` cross-branch path) now joins completed records from the identity index that the local completed corpus lacks — cross-branch completed dependencies resolve as completed instead of missing; regression test verified to fail without the fix
- Fixed: `App.tsx` modal sync effect requires matching task IDs before comparing dependency lists, stopping a redundant fetch after graph-link navigation
- Accepted as behavior: TUI readiness snapshot staleness (existing watcher covers most cases; a second subscription is disproportionate) and open-modal dependents staleness from other clients (display-only list correcting on reopen)
- Review follow-up: ambiguity is now sourced from the index itself — `TaskIdentityIndex.getContestedIds()` reports IDs claimed by more than one live identity, carried on `TaskCorpus.ambiguousIds` and seeded into `createTaskRecordIndex`, covering readiness and the dependency graph together

## Acceptance Criteria

- Each of the seven listed review items is fixed or explicitly closed as accepted behavior with a note

## Related Concepts

- [[concepts/task-identity]] — contested-ID reporting (`getContestedIds`) as the single ambiguity source
- [[concepts/web-ui-features]] — modal sync-effect guard and corpus loading behavior
- [[concepts/upstream-migration]] — imported as DRAFT#140 (doc-12 CORE-28), sequenced after CORE-2

## Related Sources

- [[sources/draft-121-bidirectional-dependency-graphs]] — the BACK-548 work these follow-ups review
- [[sources/back-602-incremental-cross-branch-task-loading]] — the cross-branch identity index extended with contested-ID reporting
- [[sources/back-567-cross-branch-task-identity]] — cross-branch identity semantics underlying item 4

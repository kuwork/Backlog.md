---
title: draft-135 Reject self-referential and cyclic task dependencies
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - dependencies
  - validation
  - cli
source_path: backlog/drafts/draft-135 - Reject-self-referential-and-cyclic-task-dependencies.md
---

# draft-135 Reject self-referential and cyclic task dependencies

Upstream BACK-656 (doc-12 CORE-23) imported as a draft: dependency validation must reject self-dependencies (including alias spellings like `task-1`/`TASK-001`) and any dependency that would close a cycle, with the error naming the full cycle path. All ACs checked upstream; fork migration pending.

## Summary

- Single validation owner: `validateDependencies` (`src/utils/task-builders.ts`) takes the task being edited as an optional target; `taskIdsEqual` catches case/zero-padding aliases; CLI, MCP, web, and draft edits all inherit through the shared core path (`createTaskFromInput`/`updateTaskFromInput`/`applyTaskUpdateInput`)
- Cycle detection reuses the BACK-548 graph model: one `buildDependencyGraph` call over the corpus validation already loads, plus new `findCycleThroughRoot` (BFS over built edges, resolved nodes only, shortest cycle path) — no second traversal; every new cycle must run through the edited task so per-edit checking is complete
- Review-round hardening (PR #978): create could materialize a cycle when a dangling reference named the next allocated ID → validation moved inside the create lock with the allocated identity as target; promotion/demotion re-validate the stored list against the allocated identity; ambiguous identities reached mid-path fail closed naming `backlog doctor`
- Repair trap fixed: the graph's reverse-declarers map re-injected the target's stored edges, so replacing a legacy cycle's dependency list was itself rejected — the target's stored record is excluded from the graph corpus since the proposed list supersedes it
- `backlog doctor` gains `findDependencyDefects`: report-only findings for stored self-dependencies and cycles (deduped by rotation from smallest canonical member), exit 1, `--fix` refuses them as not auto-repairable
- Explicitly refuted/deferred: no global graph lock (per-task locks deliberately don't serialize; merged branches can still create cycles — doctor is the designed backstop); full elementary-cycle enumeration out of scope (doctor is iterative)

## Acceptance Criteria

- Creating/editing a task with itself as dependency fails with a clear error on CLI, MCP, and web, alias spellings included
- Adding a dependency that closes a cycle is rejected with an error naming the cycle path
- Cycle detection reuses the shared dependency-graph model; no second traversal
- `backlog doctor` reports existing self-dependencies and cycles

## Related Concepts

- [[concepts/task-identity]] — `taskIdsEqual` alias matching and ambiguous-identity fail-closed behavior
- [[concepts/upstream-migration]] — imported as DRAFT#135 (doc-12 CORE-23), merged with CORE-30 in the same wave

## Related Sources

- [[sources/draft-121-bidirectional-dependency-graphs]] — BACK-548 graph model reused for cycle detection
- [[sources/draft-142-residual-self-dependency-gaps]] — residual gaps from this task's review
- [[sources/draft-92-clear-task-dependencies-cli]] — related dependency-clearing CLI surface
- [[sources/back-615-dependency-readiness-guidance]] — readiness treats self-blocked tasks; this prevents creating them

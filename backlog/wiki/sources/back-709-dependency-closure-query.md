---
title: BACK-709 Answer dependency closure and hop counts from the task corpus
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - dependencies
  - web-ui
  - api
source_path: backlog/tasks/back-709 - Answer-dependency-closure-and-hop-counts-from-the-task-corpus.md
---

# BACK-709 Answer dependency closure and hop counts from the task corpus

One query answers the three dependency questions no surface could: what a task transitively depends on and at what distance, what transitively depends on it, and which unfinished task is the real root blocker — plus the dangling/ambiguous references and cycles a traversal must make visible. Exposed as `GET /api/task/:id/dependencies` and rendered in the task details modal.

## Summary

- Corpus decision (2026-09-24): answered from the local corpus (tasks + completed), never from the graph service — the default backend is a pure-JS map (kuzu segfaults under Bun), GraphStore has no multi-hop call, and only the web host starts the service; a traversal over records on disk is the only and cheapest path for CLI, TUI, MCP and web alike
- `src/utils/dependency-closure.ts` extended (not replaced): reverse index `dependentsOf`, `closureFrom` (BFS, one row per task at its shortest hop count, sorted by hops then id), `cycleThrough`; a visited set bounds cyclic corpora and a re-reached subject is reported as a cycle, not an error; unresolved references ride along in the result
- `DependencyQuery` (`src/utils/dependency-query.ts`) answers `answer()`/`answerBoth()` per request; subject identity resolves through the gate's `matchRecords` rule — the earlier `canonicalTaskId` map lookup read "414" as TASK-414 in a `back`-prefixed project and silently kept the last of two colliding records
- Corpus rules asserted in tests: completed directory is the completion evidence, milestones excluded, drafts walk one way (may depend on tasks and may be a subject when asked, never returned as a dependency; without the ask flag a draft subject answers `null`, not an empty closure)
- Endpoint: one request answers both directions with hops, blockers, cycle, unresolved and a corpus summary; 404 unknown subject, 400 malformed maxHops; the PUT handler now attaches machine-readable `code` + `detail` (dependency_cycle / self_dependent / ineligible_target) to gate rejections so clients localize them
- Modal (landed with BACK-710's commit): fetches once per open, once per settled inline edit (a `finally` tick, never on optimistic state — a refetch at removal time re-reports the just-removed cycle), and on external `tasksVersion` refresh; runtime shape-checked answers render "Waits for" / "Waited on by" rows with hop counts, highlighted root blockers, cycle and unresolved references; a rejected edit rolls the optimistic chip back and shows the localized reason, auto-dismissed after 6s
- Fork-native work: upstream ships no graph database; the Kuzu graph serves visualization only. Tests: dependency-closure 14, server endpoint 3, modal 6; browser-verified on BACK-495.3 and BACK-218

## Acceptance Criteria

- Corpus-only answers on every host; drafts never returned as dependencies; one row per task with stable order and shortest hop count; diamonds dedupe
- Reverse closure and root blockers identifiable; unresolved references surfaced; cyclic corpus terminates and flags the cycle
- Web surface renders forward/reverse/hops from one request per popup open, no polling

## Related Concepts

- [[concepts/web-ui-features]] — task modal dependency UX this extends
- [[concepts/web-server]] — hosts the new endpoint
- [[concepts/task-lifecycle]] — completed-directory-as-evidence corpus rule

## Related Sources

- [[sources/back-707-dependency-gate-cycles]] — write gate sharing the traversal and corpus definition (same batch)
- [[sources/back-708-doctor-dependency-defects]] — doctor report over the same corpus walk (same batch)
- [[sources/back-710-task-modal-relationship-graph]] — sibling modal surface for dependencies (same batch)
- [[sources/back-615-dependency-readiness-guidance]] — readiness, whose semantics the blocker identification mirrors

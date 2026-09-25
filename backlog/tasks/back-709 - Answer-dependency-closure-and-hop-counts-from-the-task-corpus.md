---
id: BACK-709
title: Answer dependency closure and hop counts from the task corpus
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 22:46'
updated_date: '2026-09-25 07:14'
labels:
  - web-ui
  - api
dependencies: []
ordinal: 279400
actual_start: '2026-09-25 01:58'
actual_end: '2026-09-25 07:14'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: one query answers the three dependency questions no surface can answer today - what a task transitively depends on and at what distance, what transitively depends on it, and which unfinished task is the real blocker at the end of each chain - together with the defects a traversal must make visible: dangling and ambiguous references, and cycles.

The query answers from the local corpus, never from the graph service (decided 2026-09-24): the corpus is tasks + completed, the same pool BACK-707's gate enforces, BACK-708's report walks and readiness already loads. A completed file's directory is the completion evidence; milestones are not in the pool; a draft is in scope only as a subject the caller asks for - a draft may depend on tasks, but no closure ever returns a draft as a dependency. The graph path was ruled out on measurement: the default backend is a pure-JS map (the kuzu binding segfaults under Bun), the GraphStore contract has no multi-hop call, and only the web host ever starts the service - a traversal over the records on disk is both the only and the cheapest path for CLI, TUI and MCP alike.

Semantics pinned down: one row per task at its shortest hop count in a stable order (a variable-length path set is not a node set - a diamond must report C once); unresolved references are carried alongside the closure instead of being dropped, resolved against the same corpus as the gate; a cyclic corpus terminates through a visited set and reports the cycle it walked through.

This is fork-native work, not an upstream port: upstream ships no graph database, and the fork's Kuzu graph (doc-014, BACK-702..704) serves the visualization surfaces only. The traversal is shared, not owned: the same src/utils/dependency-closure.ts answers BACK-707's write gate and BACK-708's doctor report; this task adds the read side - src/utils/dependency-query.ts with forward and reverse closures, hop counts, root blockers, cycles and unresolved references - exposed as GET /api/task/:id/dependencies, one request answering both directions, with bare numbers resolved through the same matchRecords rule the gate uses.

Out of scope: the write gate (BACK-707), the doctor defect report (BACK-708), and new CLI/TUI/MCP UI, which reuse the same answers from the same corpus.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The query is answered from the local corpus on every host - CLI, TUI, MCP and web - with no graph service started and none required
- [x] #2 The corpus is the target pool the write gate enforces and the doctor report walks: tasks + completed, with a completed file's directory as the completion evidence; drafts are never returned as dependencies, and a draft's own edges are included only when the caller asks for them
- [x] #3 Forward and reverse traversal both return one row per task with a hop count, in a stable order for identical input
- [x] #4 A diamond (A depends on B and C, B depends on C) reports C exactly once, at the hop count the documented semantics prescribe
- [x] #5 The reverse direction lists every task that transitively depends on a target, with hop counts, which no surface can answer today
- [x] #6 The unfinished root of a closure - a member that is not in a terminal status and has no dependencies of its own - is identifiable from the returned data
- [x] #7 An unresolved dependency (dangling or ambiguous) is surfaced alongside the closure instead of being silently dropped, resolved against the same corpus as the gate
- [x] #8 A cyclic corpus neither hangs nor hides the cycle: the traversal terminates with a bounded result and flags the cycle it walked through
- [x] #9 The web surface renders forward, reverse and hop information from one request per popup open, without adding a polling loop
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - One traversal over a node and edge list
- 1.1 src/utils/dependency-closure.ts (new): build a DependsOn adjacency index from a node and edge list and answer forward closure, reverse closure, shortest hop counts and root blockers. Plain lists only, so a single implementation serves this query, BACK-707's write gate and BACK-708's doctor report.
- 1.2 Keep a visited set and an explicit hop bound so a cyclic corpus terminates; treat a task reappearing inside its own closure as a cycle diagnostic rather than an error.
- 1.3 Carry the unresolved-reference reports through the result so dangling and ambiguous targets are never dropped on the floor.
### Phase 2 - One corpus, one shape
- 2.1 Build the node and edge lists from the definition the gate enforces and readiness.ts already uses - tasks + completed - adding a draft's outgoing edges only when the caller asks, so the closure, the write gate and the doctor report cannot drift.
- 2.2 A completed file's directory is the completion evidence, milestones are not part of the corpus, and a draft is never returned as a dependency; assert all three in a test rather than leaving them implicit.
- 2.3 The result describes the corpus it was computed over, so a caller can tell which records were in scope without the shape changing.
### Phase 3 - Surface
- 3.1 src/server/index.ts: expose the query as its own endpoint rather than folding it into /api/graph, which serves the visualization payload, with direction and hop semantics explicit in the contract. It is registered where the rest of the task routes live, /api/task/:id/dependencies, so the UI reads it next to the task it describes and a bare number works there the way it does in the CLI (the web route /task/:id already exists and serves the app shell; the API sits under /api).
- 3.2 landed 2026-09-25 once BACK-710 was committed (afa2f34e): TaskDetailsModal fetches /api/task/:id/dependencies once per open and again when the dependency list is edited inline, never on a timer, and renders "Waits for" / "Waited on by" rows with hop counts, the root blockers highlighted, the cycle, and the unresolved references that only this answer can see. The answer is shape-checked at runtime because a stubbed or misbehaving backend can resolve with anything, and a non-answer renders as a muted "unavailable" note rather than a crash. Verified in a real browser: opening the popup on BACK-495.3 fires the request once and shows BACK-495.2 (1 hop), BACK-495.1 (2 hops) forward and BACK-495 (1 hop), BACK-516 (2 hops) reverse; BACK-218 lists its four task-NNN defects. A rejected inline edit (dependency gate, lock) rolls the optimistic chip back and surfaces the server's reason next to the input, localized from the machine-readable code the PUT handler now returns for the gate's rejections.
### Phase 4 - Tests and gates
- 4.1 src/test/dependency-closure.test.ts: chain, diamond, reverse, root blocker, dangling reference, cycle, and the corpus-definition assertions.
- 4.2 Mutation check: drop the visited set or the dedup rule and confirm the cycle and diamond cases go red.
- 4.3 bunx tsc --noEmit; bunx biome check on the touched files; bun test on the affected suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### Phase 1 - Traversal (src/utils/dependency-closure.ts)

- Extended the BACK-708 class, did not replace it: added a reverse index (`dependentsOf`), `closureFrom` (breadth-first, one row per task at its shortest hop count, sorted by hops then id so identical corpora answer identically) and `cycleThrough` (the chain that returns to the subject).
- A visited set bounds a cyclic corpus; a subject reachable from one of its own neighbours is reported as a cycle, not an error.
- Unresolved references ride along in the result; they are recomputed against the corpus, never taken from the file's prose reports.

### Phase 2 - Corpus

- One definition everywhere: tasks + completed (the completed directory is the completion evidence), milestones excluded, drafts walk one way - a draft may depend on tasks and may be a subject when the caller asks, but is never returned as a dependency. Without the ask flag a draft subject answers `null`, not an empty closure, so "depends on nothing" can never be faked by unwalked edges.
- `DependencyQuery` (src/utils/dependency-query.ts) is built once per request and answers `answer()` / `answerBoth()`. Subject identity resolves through `matchRecords` - the gate's rule - which is what makes bare numbers work; the earlier `canonicalTaskId` map lookup read "414" as TASK-414 in a `back`-prefixed project and silently kept the last of two colliding records.

### Phase 3 - Surfaces

- Endpoint: `GET /api/task/:id/dependencies` (src/server/index.ts), one request answering both directions with hops, blockers, cycle, unresolved and a corpus summary; 404 unknown subject, 400 malformed maxHops, no alias for the never-released old path. The PUT handler now attaches machine-readable `code` + `detail` (dependency_cycle / self_dependent / ineligible_target) to gate rejections so the client can localize them.
- Popup: fetches once per open and once per settled inline edit (a `finally` tick after `updateTask`, never on the optimistic state - a refetch fired at removal time re-reports the cycle that was just removed), and once on every external tasks refresh via App's `tasksVersion`. Answers are runtime shape-checked; a non-answer renders a muted "unavailable" note. A rejected edit rolls the optimistic chip back (snapshot before set) and shows the server's reason next to the input, localized from the code, auto-dismissed after 6s - without the rollback, `preserveDirtyRefreshValue` would keep the rejected chip on screen forever.
- Closure rendering follows the readiness badge style; all copy lives in `taskDetails.closure*` / `dependencyError*` locale entries (en, zh-CN, zh-TW, ja).

### Phase 4 - Verification

- dependency-closure.test.ts (14) and server-dependencies-endpoint.test.ts (3, real server, bare-number and prefix-rejection cases); web-task-details-modal-dependency-closure.test.tsx (6, client render with mocked apiClient). Mutation check: reverting `subjectRecord` to map-only resolution turns exactly the bare-number cases red.
- Full modal batch 74 pass / 0 fail; `tsc` and `biome` clean. Browser-verified on BACK-495.3 and BACK-218.

<!-- SECTION:NOTES:END -->

---
id: BACK-707
title: >-
  Refuse cycles in the shared validateDependencies gate, and tolerate
  unresolvable dependencies only where they are already stored
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 22:20'
updated_date: '2026-09-25 01:05'
labels: []
dependencies: []
modified_files:
  - src/utils/dependency-closure.ts
  - src/utils/task-builders.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/server/index.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/test/dependency.test.ts
  - src/test/cli-dependency.test.ts
ordinal: 277400
actual_start: '2026-09-25 00:29'
actual_end: '2026-09-25 00:38'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: validateDependencies refuses a write whose dependency list makes the task its own predecessor - by naming the task itself, or by naming a task that already reaches it - so a cyclic dependency can no longer be persisted, and the error names the offending chain (TASK-1 -> TASK-2 -> TASK-1) rather than just the ID. The same gate stops refusing a reference that resolves to nothing only where that spelling was already on disk: an ID the write carries over unchanged from the stored record is written through as typed with a warning, while anything the write introduces fresh - any dependency named on a create, or a newly added or rewritten ID on an edit - is still refused exactly as it is today. In one line: the gate tolerates history, not new mistakes.

Context: the existence refusals date to TASK-287 (commit 049a9afc, the three throws in src/core/backlog.ts, untouched by BACK-664's own commit), BACK-664 added the rest of the gate - completed records in the pool, ambiguous identities failing closed - and self-reference and cycles were the two classes it never had. The tolerance exists to unblock real records: measured 2026-09-24, 78 of the 147 edges in this repository resolve to nothing (53%, all task-NNN spellings against the back prefix), three sit on open tasks, and BACK-217 (which stores [task-213]) cannot be written back at all - even re-submitting its own list is refused - so a title fix on those records fails. The split is judged per candidate, never by comparing the two lists as wholes: a write that carries a stale ID over while adding a good one is the normal case, not an error.

Rules, along two axes decided 2026-09-24 - whether the target is eligible at all, and whether this write is what put it there. Hard, unchanged: ambiguous identity; a draft target, which is a lifecycle direction rather than a typo; a milestone target, refused today and left refused; and an unresolvable ID this write introduces - a create has no stored list to compare against, so every dependency it names must resolve ("when creating, it has to exist"), and an edit that adds or rewrites an ID into an unresolvable spelling is refused the same way. Hard, new: a dependency that can already reach the task being written. Soft, new: an unresolvable ID already in the stored list, carried through unchanged and reported as a warning on every host (CLI stderr, JSON/MCP data) - an ID whose only record sits under backlog/archive follows the same split, since being out of the pool it resolves to nothing. The target pool is a task or a completed task, nothing else; taking drafts out of the resolvable pool also deletes a live disagreement - the gate accepted a draft edge that readiness (which never loads drafts) read back as missing within the same second - while a draft may still carry dependencies on tasks, which is what makes promotion safe. The stored list is already in hand at the gate (it receives the freshly loaded record), so the split costs no extra read; the create call site is left strict by design, not by oversight.

Shape: the cycle walk is one breadth-first traversal in src/utils/dependency-closure.ts shared with BACK-709, with chain reconstruction for the error message; it builds adjacency from the `known` array (tasks + completed) the gate already assembles, and never from the task graph - only BacklogServer starts one, its snapshot can lag the write being judged, and the gate runs on the write path. Only the two edit branches in src/core/backlog.ts (:1953 replacement, :1967 addDependencies) can trip the cycle check today; the create path allocates its ID after the gate has run, so it inherits the check but cannot trip it. Canonicalisation is the persistence catch: a tolerated ID is written back in the spelling the record holds (a stored task-213 stays task-213) while resolvable candidates are still canonicalised (a bare 358 still becomes BACK-358). The ambiguity and ineligible-target refusals keep today's corpus and behaviour, and relations.ts creates no edge at all for a dangling or ambiguous target, so nothing downstream starts pretending an unresolved edge resolved - readiness still fails closed and BACK-708 is the corpus-level report that carries it. Out of scope: reporting cycles already on disk (BACK-708) and POST /tasks/:id/complete, a bare rename that never rewrites frontmatter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Replacing a task's dependency list with one that names the task itself is refused, and the record on disk keeps its previous dependencies
- [x] #2 Adding a dependency that can already reach the task, directly or through a chain, is refused and the message names the chain, for example TASK-1 -> TASK-2 -> TASK-1
- [x] #3 Valid edits still pass unchanged: a shared predecessor, a diamond, a dependency on a completed task, and re-submitting the current list
- [x] #4 Dropping the edge that closed the cycle succeeds, because a replacement list is judged as a whole
- [x] #5 The walk is answered from the records the gate already loads (tasks + completed; drafts are never targets), with no graph service involved on any host
- [x] #6 Ambiguity and the ineligible-target refusals keep their current behaviour: a draft target and the milestone target that is refused today are still refused, and an ID that resolves to nothing is still refused whenever this write introduces it - including every dependency named on a create - while an ID that resolves to nothing and already sits in the stored record is written through as typed with a warning
- [x] #7 src/test/dependency.test.ts covers self-reference, a two-node cycle, a three-node cycle, the draft-target refusal on both edit branches, the milestone-target refusal, the no-false-positive cases, and the existence split on the edit path - introduced refused, carried over tolerated with a warning, a stored ID rewritten into an unresolvable spelling refused - while src/test/cli-dependency.test.ts asserts the draft direction at the CLI level in place of the assertion that a task may depend on a draft
- [x] #8 A dependency naming a draft is refused on the create path and on both edit branches, and a draft depending on an existing task is accepted: a draft is never a valid target for any record
- [x] #9 The warning reaches every host - printed by the CLI, carried as data by the JSON/MCP result - and it covers only the carried-over IDs: the stored list keeps the caller's spelling for those while still canonicalising the ones that did resolve (a bare 358 still becomes BACK-358)
- [x] #10 On an edit, an unresolvable ID already present in the stored record is tolerated while the same ID introduced by that same write is refused, and a create naming an unresolvable ID is refused: a stored spelling survives every later re-write of its record without becoming a way to add new ones
- [x] #11 An ID whose only record sits under backlog/archive follows the same split - refused when a create or a fresh edit names it, tolerated when the stored record already carries it - and once a new record claims that ID the reference resolves to the new holder: the archived file never enters the pool, so the reused-ID behaviour BACK-664 established survives
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Give the gate a subject
- 1.1 src/utils/task-builders.ts: extend validateDependencies so it also receives the record being written (its id plus the dependency list that will replace the stored one), while keeping the current two-argument shape working for callers that cannot supply a subject.
- 1.2 Refuse a candidate that resolves to the subject's own id before any walk.
- 1.3 Move listDrafts() out of the resolvable pool and into an eligibility check, alongside listMilestones(), and update the comment that states the corpus (src/utils/task-builders.ts:76-88), so the gate can still refuse a draft or a milestone target while a target nobody claims is written through. A draft's own dependencies resolve against the same pool, which is what keeps draft -> task legal.
### Phase 2 - One reachability walk over the corpus the gate already loads
- 2.1 Reuse src/utils/dependency-closure.ts (BACK-709 Phase 1) for the "can this candidate already reach the subject" walk; if it has not landed yet, introduce it in that shape and leave BACK-709 to reuse it - do not fork a second reachability implementation.
- 2.2 Follow dependencies from each candidate and refuse it once the subject's id is reachable; reconstruct the chain and put it into the thrown error so the message is actionable.
- 2.3 Build the adjacency from the `known` array the gate already assembles (tasks + completed, src/utils/task-builders.ts:83-88) and the dependencies each record carries - no extra corpus load, no graph service, no injection point.
- 2.4 Keep the ambiguity check on the corpus it uses today and keep one defect reported per candidate; the existence answer moves to Phase 3 rather than disappearing.
### Phase 3 - Split the refusal from the warning by who introduced the ID
- 3.1 Give validateDependencies the stored dependency list, through the subject from Phase 1, and split its result three ways instead of valid/invalid: resolved; unresolvable but already present in the stored list; unresolvable and introduced by this write. Only the third is an error. Compare per candidate, never the two lists as wholes, and canonicalise both sides the same way before comparing: normalizeDependencies runs normalizeTaskId over the candidates before the gate ever sees them, so a stored task-213 arrives as TASK-213, and a stored list left uncanonicalised would make the caller's own spelling look freshly introduced and the tolerance would never fire. That is also the catch for what gets persisted: the tolerated ID has to be written back in the spelling the record holds, not the normalised candidate - AC #9 asks for the caller's spelling to survive, and normalisation alone would hand TASK-213 back to a file that holds task-213.
- 3.2 Change the two edit branches only (src/core/backlog.ts:1953 and :1967). There the third class throws exactly as it does today, and the second class is carried through and surfaced as a warning: printed by the CLI (console.warn, the convention at src/cli.ts:6088) and carried as data by the JSON/MCP result, so a host with no stderr is not left guessing. **Leave the create call site (:1574) alone** - it has no stored list, every dependency it names must resolve, and its throw is the rule rather than a legacy this task retires.
- 3.3 Three of the four assertion sites do not change, so check them rather than rewriting: src/test/cli-dependency.test.ts:125, src/test/dependency.test.ts:409 and :439 all go through createTaskFromInput, which stays strict, and :412 (`resolves an archived id to the task that reused it`) stays green. The fourth is the exception and it is inverted rather than kept - src/test/cli-dependency.test.ts:193 `should handle dependencies on draft tasks` asserted exactly the behaviour this task removes, a task depending on a draft written through as `dependencies: [DRAFT-1]`, so it now asserts the refusal: exit 1, the ineligible message on stderr, and nothing written. What is missing is edit-path coverage - an edit that introduces an unresolvable ID (refused), one that carries a stored unresolvable ID over (tolerated, warning), and one that rewrites a stored ID into an unresolvable spelling (refused).
### Phase 4 - Call sites
- 4.1 Supply the subject and its stored dependency list at the two edit branches (src/core/backlog.ts:1953 and :1967), and the subject alone at create (:1574) for the cycle and self-reference checks; confirm there is no other caller of validateDependencies. Passing no stored list at create is what keeps that path strict on existence.
### Phase 5 - Tests and gates
- 5.1 src/test/dependency.test.ts: self-reference, two-node cycle, three-node cycle, shared predecessor, diamond, completed predecessor, unchanged resubmit, cycle-breaking replace, draft target refused, draft source accepted; then the existence split - a create naming an unresolvable ID refused, an edit introducing one refused, an edit rewriting a stored ID into an unresolvable spelling refused, an edit carrying a stored unresolvable ID over tolerated with a warning (the BACK-200/217/218 shape: re-writing that record must succeed), an archived-only target refused when introduced and tolerated when carried over, and a released ID a later task re-claimed still resolving to the new holder.
- 5.2 Mutation check: relax the new guard and confirm the new cases go red, then restore and confirm green.
- 5.3 bunx tsc --noEmit; bunx biome check on the touched files; bun test on dependency + cli-dependency and the atomic task edit suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### Phase 1 - Gate signature and pool (src/utils/task-builders.ts)

- validateDependencies grew a subject: the record being written, carrying its id and the stored dependency list. Self-reference is refused before any walk.
- listDrafts() moved out of the resolvable pool into an eligibility check alongside listMilestones(). Drafts are still read, but for the other role - they are what lets the gate say "this id exists and is still not eligible": a draft target is refused, a draft depending on a task resolves against the same pool and stays legal.

### Phase 2 - The walk (src/utils/dependency-closure.ts)

- One breadth-first reachability walk: adjacency built from the `known` array (tasks + completed) plus each record's dependencies, a visited set, and chain reconstruction for the error message. BACK-709 Phase 1 reuses it unchanged.
- Sound on a corpus still holding the old list: the walk asks whether a candidate reaches the subject and stops at the first arrival, so the subject's own outgoing edges - about to be replaced by this write - are never traversed.

### Phase 3 - Refusal/warning split (src/core/backlog.ts)

- Only the two edit branches pass the stored list: list replacement (:1953) and addDependencies (:1967). Per candidate, three-way: resolved; unresolvable but already stored (carried through as typed, warned on CLI stderr and carried as data by the JSON/MCP result); unresolvable and introduced by this write (throw). The create call site (:1574) is untouched - strict by design.
- Canonicalisation is the persistence catch: a tolerated ID is written back in the spelling the record holds (a stored task-404 stayed task-404), while resolvable candidates are still canonicalised (a bare 358 still becomes BACK-358).

### Phase 4 - Verification

- dependency.test.ts: self-reference, two- and three-node cycles, shared predecessor, diamond, completed predecessor, unchanged resubmit, cycle-breaking replace, draft target refused / draft source accepted, the existence split on the edit path (introduced refused, carried over tolerated with a warning, stored ID rewritten into an unresolvable spelling refused), the archive-only split, and a released ID a later task re-claimed still resolving to the new holder. cli-dependency.test.ts: the draft-dependency assertion inverted to the refusal, plus edit-path coverage.
- Mutation check: relaxing the new guard turns exactly the new cases red, then green again after restore; `tsc` and `biome` clean.

<!-- SECTION:NOTES:END -->

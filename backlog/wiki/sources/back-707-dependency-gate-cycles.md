---
title: BACK-707 Refuse cycles in validateDependencies; tolerate stored unresolvable deps
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - dependencies
  - core
  - cli
source_path: backlog/tasks/back-707 - Refuse-cycles-in-the-shared-validateDependencies-gate-and-tolerate-unresolvable-dependencies-only-where-they-are-already-stored.md
---

# BACK-707 Refuse cycles in validateDependencies; tolerate stored unresolvable deps

The shared `validateDependencies` write gate gained the two defect classes it never had — self-reference and cycles — while learning to "tolerate history, not new mistakes": an unresolvable dependency already stored on disk is written through as typed with a warning, but anything a write introduces fresh is still refused.

## Summary

- Motivation measured on this repo: 78 of 147 dependency edges (53%) resolve to nothing (legacy `task-NNN` spellings), three on open tasks, and records like BACK-217 (`[task-213]`) could not be written back at all — even re-submitting their own list was refused, so a title fix failed
- New hard refusals: a candidate resolving to the subject's own id, and a candidate that can already reach the subject — refused with the chain in the message (`TASK-1 -> TASK-2 -> TASK-1`); unchanged hard rules: ambiguous identity, draft target, milestone target, any unresolvable ID a write introduces (all creates stay strict — no stored list to compare)
- New soft rule: an unresolvable ID carried over unchanged from the stored record passes with a warning printed on CLI stderr and carried as data in JSON/MCP results; judged per candidate, never by comparing lists as wholes; archive-only ids follow the same split (out of pool, may re-bind)
- Drafts moved out of the resolvable pool into an eligibility check: a draft is never a valid target (killing a live disagreement where the gate accepted an edge readiness read back as missing), while a draft may still depend on tasks — which keeps promotion safe
- The cycle walk is one breadth-first reachability in `src/utils/dependency-closure.ts`, shared with BACK-709, with adjacency built from the `known` array (tasks + completed) the gate already loads — never from the graph service, whose snapshot can lag the write being judged
- Persistence catch: tolerated IDs are written back in the spelling the record holds (`task-213` stays `task-213`) while resolvable candidates are still canonicalised (`358` → `BACK-358`); both sides must be canonicalised the same way before the carried-over comparison or the tolerance never fires
- Only the two edit branches (list replacement, addDependencies) pass the stored list; create allocates its id after the gate and cannot trip cycles; extensive dependency.test.ts / cli-dependency.test.ts coverage with mutation checks

## Acceptance Criteria

- Self-reference and cycles (direct or chained) refused with the chain named; disk record untouched
- Diamonds, shared predecessors, completed-task targets and unchanged resubmits still pass; dropping the cycle-closing edge succeeds
- Draft/milestone targets refused; unresolvable IDs refused when introduced, tolerated with a host-visible warning when carried over in their stored spelling
- The walk runs over the gate's own corpus (tasks + completed) with no graph service on any host

## Related Concepts

- [[concepts/task-identity]] — canonicalisation and prefix-independent matching the gate relies on
- [[concepts/task-lifecycle]] — draft/completed/archive states that define the target pool

## Related Sources

- [[sources/back-708-doctor-dependency-defects]] — corpus-level report complementing this write-time gate (same batch)
- [[sources/back-709-dependency-closure-query]] — read side sharing `dependency-closure.ts` (same batch)
- [[sources/back-615-dependency-readiness-guidance]] — readiness semantics the gate must not contradict
- [[sources/back-577-clear-deps-refs-docs-empty-setter-rejection]] — earlier dependency-list write semantics

---
title: draft-142 Close residual self-dependency gaps from the BACK-656 review
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - dependencies
  - validation
  - cli
source_path: backlog/drafts/draft-142 - Close-residual-self-dependency-gaps-from-the-BACK-656-review.md
---

# draft-142 Close residual self-dependency gaps from the BACK-656 review

Upstream BACK-669 (doc-12 CORE-30) imported as a draft: two small residual defects deferred at the PR #978 merge of the self/cyclic-dependency validation. All ACs checked upstream (PR #982); fork migration pending. Note the upstream BACK-669 number collides with the fork's unrelated web-loading BACK-669.

## Summary

- Defect 1: a legacy draft carrying a dangling dependency reference equal to the **next allocated** task ID slipped past validation on promotion — resolution returned null, the invalid list was ignored on that path, and the reference was written under the new ID as a direct self-dependency (demotion had the mirror problem with draft IDs)
- Fix: `validateDependencies` runs a raw-spelling self-check against `target.id` via `taskIdsEqual` **before** corpus resolution, so dangling refs equal to the allocated promotion/demotion ID fail closed; a review round reordered unique corpus resolution ahead of the raw check to preserve bare-number resolution to existing records (`1` → `DRAFT-1`)
- Defect 2: `doctor --fix` based its final dependency-findings exit status on the pre-repair snapshot, so a self-dependency resolved by the duplicate-ID repair still exited 1
- Fix: `doctor --fix` re-runs `findDependencyDefects` after `repairDuplicateTaskIds` and gates the findings message/exit code on the repaired corpus; post-repair defects report prints before the findings-remain line
- Tests: promotion and demotion with a dangling ref equal to the allocated ID are rejected writing nothing; doctor `--fix` exits 0 when the rename resolves the finding

## Acceptance Criteria

- Promoting or demoting a record with a dangling reference equal to the allocated ID is rejected; no self-dependency can be written
- `doctor --fix` exit status reflects the post-repair corpus
- Tests cover both scenarios

## Related Concepts

- [[concepts/task-identity]] — allocated-ID self-check and bare-number alias resolution ordering
- [[concepts/task-lifecycle]] — promotion/demotion paths where the defect lived
- [[concepts/upstream-migration]] — imported as DRAFT#142 (doc-12 CORE-30)

## Related Sources

- [[sources/draft-135-reject-self-referential-cyclic-dependencies]] — the BACK-656 validation work whose review deferred these gaps
- [[sources/draft-121-bidirectional-dependency-graphs]] — shared dependency-graph model underpinning the validation
- [[sources/back-538-duplicate-task-id-recovery]] — doctor's duplicate-ID repair that the exit-status fix interacts with

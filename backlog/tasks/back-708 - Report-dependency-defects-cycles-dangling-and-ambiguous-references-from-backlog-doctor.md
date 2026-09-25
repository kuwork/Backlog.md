---
id: BACK-708
title: >-
  Report dependency defects (cycles, dangling and ambiguous references) from
  backlog doctor
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 22:31'
updated_date: '2026-09-25 01:05'
labels: []
dependencies:
  - BACK-707
modified_files:
  - src/utils/dependency-defects.ts
  - src/utils/dependency-closure.ts
  - src/utils/task-builders.ts
  - src/cli.ts
  - src/test/cli-doctor.test.ts
ordinal: 278400
actual_start: '2026-09-25 00:48'
actual_end: '2026-09-25 01:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Outcome: backlog doctor reports the dependency defects that only a whole-corpus view can see - a cycle in the DependsOn graph (with its id order), a dependency that resolves to nothing (per referring task), a dependency naming a draft (a forbidden direction, not a missing id), one whose only record sits under backlog/archive (a released id that may re-bind), and one claimed by more than one record (ambiguous, cross-referenced to the duplicate-ID section). All of it is a warning: the run still exits 0 and ends with "Dependency defects are warnings, so this command still succeeds; resolve them by hand."

Context: the write gate is being changed separately (BACK-707), and after that change it refuses a cycle and any unresolvable reference a write introduces while tolerating one the stored record already carries - so a corpus may keep such edges that no write blocks any more. Nothing existing reports them at corpus level: readiness answers one task at a time and skips terminal tasks entirely (a dangling reference on a completed task is seen by nothing at all), and the gate never looks at what is already on disk. Archiving and demoting both clean their referrers up (measured: "Removed references to TASK-4 from TASK-3"), and a milestone target is refused - what is left is a hand edit, a merge, a git rm of the target file, or a corpus predating the existence check itself (TASK-287). Measured on 2026-09-24 on a throwaway corpus: a cycle and a dangling reference written to disk left doctor printing "No duplicate task IDs found." and exiting 0, and doctor's clean path returns early (src/cli.ts:6018), so a new signal has to join that condition or it is unreachable.

The corpus encodes the rule decided with BACK-707 - a target is a task or a completed task, a draft is never valid, a draft may depend on a task - which gives the reference axis two classes: a target no record claims, and a target that is a draft, worded as the direction it is since the file exists. The released-id sub-case earns its own wording because the file does exist and the id is free: the reader must be told the reference may re-bind the moment that id is claimed again. Sources examined are tasks, completed and drafts (a draft's own references are validated by the same gate, and drafts are one place a historical misspelling survives - measured 2026-09-24, 5 drafts carry task-7/task-8 spellings that resolve to nothing); the target pool stays tasks + completed. No graph, by the same decision BACK-707 carries: doctor is a one-shot CLI command, a graph service would be cold-started for a single answer, and the report must stay correct with no server running. Implemented and measured 2026-09-25 on this repository: 78 references resolve to nothing (5 on drafts), 0 cycles, 0 ineligible targets, 0 released ids, 0 ambiguous - nothing on disk is a cycle, so the gate refuses no record that exists today.

A report, not a repair: a cycle has no canonical edge to cut and an unresolvable or ambiguous reference has no target to point at, so --fix never touches them - the draft-identity report already set the diagnostic-only precedent, whose note (src/cli.ts:6030-6034) had to be generalized rather than reused verbatim, since it names draft identity specifically. Decided 2026-09-25, diverging from the draft-identity report on the exit code: a diagnosis command should not treat a standing corpus condition as a failure - a non-zero exit after a report that ran to completion reads as an interrupted run, and failing every run over 78 spellings this repository arrived with would make the command useless rather than informative; the findings that have a repair path (duplicate IDs) or describe a configuration fault (draft identity, reserved prefix) keep theirs. The section is printed on every diagnostic path including --fix, never blocks or is claimed by the duplicate repair, and is absent from --commit/--rollback, which return before any diagnosis (:5986-5996). Out of scope: a repair path for these findings, and "a completed task whose dependency is still unfinished" - readiness deliberately skips terminal tasks, and whether such a record is wrong is policy, not structure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog doctor on a corpus holding a dependency cycle reports the cycle with its ids in order, as a warning rather than a failure - the run still exits 0 - instead of printing "No duplicate task IDs found."
- [x] #2 A dependency that resolves to nothing is reported per referring task, naming the id, in a section of its own rather than inside the duplicate-ID report - this report is now the only corpus-level place such an edge appears, since the gate tolerates one the record already carries, which is exactly why it can outlive every later edit - and a target that is a draft is reported as a forbidden direction rather than as a missing id, while a target whose only record sits under backlog/archive is named as a released id rather than folded into the typo count
- [x] #3 A dependency naming an id claimed by more than one record is reported as ambiguous and cross-referenced to the duplicate-ID section, not counted as simply missing
- [x] #4 A clean corpus still prints "No duplicate task IDs found." and exits 0: the new section never appears when there is nothing to report
- [x] #5 The new report is diagnostic-only and offers no repair flag: --fix keeps repairing duplicate task IDs and nothing else, the duplicate-ID preview/repair flow, --yes, --commit, --rollback, and the reserved-prefix and draft-identity findings with their exit codes are all unchanged, no code path rewrites a dependencies list, and the dependency findings themselves never set an exit code
- [x] #6 src/test/cli-doctor.test.ts covers the cycle, the dangling, the ambiguous, the draft target and the clean cases
- [x] #7 The report is produced through the same corpus index as the write gate, built from tasks + completed - drafts never valid targets - with no graph service involved
- [x] #8 When the only findings are dependency defects, backlog doctor --fix prints the section, exits 0 and never reaches the confirmation prompt, taking the same early return the draft-identity report takes without taking its exit code
- [x] #9 On a corpus carrying both a duplicate group and a dependency defect, --fix repairs the duplicate only and still prints the dependency section, which leaves the exit code alone: the run succeeds, mirroring the post-repair note the draft-identity report prints at src/cli.ts:6069-6072 without mirroring its failure
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - One corpus walk, shared with the write gate
- 1.1 Build the corpus index and the traversal in one place, src/utils/dependency-closure.ts (BACK-709 Phase 1, reused by BACK-707), so doctor and the gate cannot drift: doctor needs every cycle in the corpus, the gate needs "does this candidate reach the subject".
- 1.2 Resolve against the target pool the gate enforces - tasks + completed, archive excluded, drafts never valid targets - so a reference with no target there is reported as dangling rather than silently dropped, a reference to a draft is reported as the forbidden direction it is, and a reference whose only record is in backlog/archive is called out as a released id: the distinction matters because such an id can be claimed again, which re-binds the stored edge, and BACK-707 leaves that visible here rather than refusing it at write time.
- 1.3 Keep it offline: doctor is a one-shot CLI command with no server to ask, so the walk runs over the corpus it loads itself rather than through any graph service.
### Phase 2 - The report
- 2.1 One section per defect class, following the shape of printDraftIdentityReport (src/cli.ts:5918): cycles with their id order, dangling listed per referring task, ambiguous pointing at the duplicate-ID section.
- 2.2 Join the clean-path early return (src/cli.ts:6018 gates on plan.groups.length === 0 && !draftIdentityBroken), otherwise a corpus carrying only a dependency defect still prints "No duplicate task IDs found." - but not the exit-code rollup: these findings are warnings and leave the exit code to the findings that have a repair path or describe a configuration fault.
- 2.3 Print the section on every diagnostic path, --fix included: the dependency findings must survive a successful duplicate repair the way the draft-identity note does at src/cli.ts:6069-6072, and must not be swallowed by the early return at :6030-6034 or by the --fix prompt at :6047. Only the exit code is left alone, so remove it from the three places the draft-identity findings set it (:6055, :6065, :6092) and keep it there.
- 2.4 Generalize the diagnostic-only note at src/cli.ts:6030-6034 ("Draft identity findings are diagnostic only; resolve them by hand.") instead of reusing it verbatim - it names draft identity specifically, so a corpus whose only defect is a dependency one would be told the wrong thing. Do not add the report to the --commit/--rollback paths (:5986-5996): those are repair-lifecycle commands that return before any diagnosis, the same way the draft-identity report is absent from them.
- 2.5 Update the command help schema - reads at src/cli.ts:5945 and output at :5955 - so the dependency report is declared, marked as warnings that do not fail the command, and the reads line admits drafts, milestones and archived records; the writes line at :5953-5954 keeps describing the duplicate-ID repair only (it must not imply --fix repairs a dependency defect).
### Phase 3 - Tests and gates
- 3.1 src/test/cli-doctor.test.ts: cycle including a self-loop, dangling on an open task, dangling on a completed task, a dependency naming a draft, a dangling target whose only record is archived (reported as a released id, not as a typo), ambiguous, a clean corpus, and the duplicate-repair flow still reporting as before.
- 3.2 Cover the --fix interaction in both shapes: dependency defects alone (section printed, exit non-zero, no prompt) and a duplicate group alongside a dependency defect (duplicate repaired, section still printed, exit still non-zero).
- 3.3 Leave the read surfaces alone: readiness keeps skipping terminal tasks, which is why doctor is the only place a dangling reference on a completed task can appear.
- 3.4 bunx tsc --noEmit; bunx biome check on the touched files; bun test on the cli-doctor and duplicate-repair suites.
<!-- SECTION:PLAN:END -->
## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### Phase 1 - One corpus walk, shared with the write gate

- The corpus index and traversal live in src/utils/dependency-closure.ts, the same one BACK-707 uses for reachability, so doctor and the gate cannot drift; the defect classification itself is in src/utils/dependency-defects.ts.
- Resolved against the gate's target pool - tasks + completed, archive excluded, drafts never valid targets. Classes: cycle (via cycleThrough, ids in order), dangling, draft target (forbidden direction, worded as such), released id (the re-bind warning), ambiguous (cross-referenced to the duplicate-ID section). Drafts are examined as sources, not targets.
- Offline by construction: the walk runs over the corpus doctor loads itself, no graph service.

### Phase 2 - The report (src/cli.ts)

- One section per class, following the printDraftIdentityReport shape. The clean-path early return (:6018) was joined by the dependency signal so a corpus carrying only dependency defects still prints; the exit-code rollup was left alone - these findings are warnings and never set an exit code.
- The diagnostic-only note (:6030-6034) was generalized rather than reused verbatim, since it named draft identity specifically; the section prints on every diagnostic path including --fix, and is absent from --commit/--rollback (:5986-5996), which return before any diagnosis. A --fix run repairs duplicates only and never reaches its prompt when dependency defects are the sole finding.
- Help schema updated (reads at :5945, output at :5955): the report is declared as warnings that do not fail the command, and the reads line admits drafts, milestones and archived records; the writes line still describes the duplicate-ID repair only.

### Phase 3 - Verification

- cli-doctor.test.ts: cycle including a self-loop, dangling on an open task and on a completed task, a draft target, a dangling target whose only record is archived (reported as a released id, not a typo), ambiguous, a clean corpus, and the --fix interactions in both shapes (dependency defects alone; a duplicate group alongside - duplicate repaired, section still printed, exit 0).
- Measured on this repository: 78 dangling (5 on drafts), everything else 0, exit 0 with the warnings note. Mutation check on the joined early-return condition; `tsc` and `biome` clean.

<!-- SECTION:NOTES:END -->

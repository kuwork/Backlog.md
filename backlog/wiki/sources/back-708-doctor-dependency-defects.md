---
title: BACK-708 Report dependency defects from backlog doctor
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - dependencies
  - cli
source_path: backlog/tasks/back-708 - Report-dependency-defects-cycles-dangling-and-ambiguous-references-from-backlog-doctor.md
---

# BACK-708 Report dependency defects from backlog doctor

`backlog doctor` now reports the dependency defects only a whole-corpus view can see — cycles, dangling references, draft targets, released (archive-only) ids, and ambiguous references — all as warnings: the run still exits 0.

## Summary

- Five defect classes, one section each following the `printDraftIdentityReport` shape: cycles with id order (incl. self-loops), dangling per referring task, draft targets worded as the forbidden direction, released ids with a re-bind warning, ambiguous cross-referenced to the duplicate-ID section
- Fills a real gap: readiness answers one task at a time and skips terminal tasks (a dangling reference on a completed task was seen by nothing), and after BACK-707 the write gate tolerates stored defects — doctor is now the only corpus-level place they appear
- Deliberate divergence from the draft-identity report on exit code: a diagnosis command should not treat a standing corpus condition as failure — failing every run over the 78 legacy spellings this repo arrived with would make doctor useless; findings with a repair path (duplicates) or a configuration fault keep their exit codes
- Diagnostic-only, no repair: a cycle has no canonical edge to cut and a dangling reference has no target, so `--fix` repairs duplicates only; the section prints on every diagnostic path including `--fix` and is absent from `--commit`/`--rollback`; the diagnostic-only note was generalized rather than reused verbatim
- Implementation: classification in `src/utils/dependency-defects.ts` over the shared `dependency-closure.ts` corpus walk (same one the write gate uses, so doctor and the gate cannot drift); offline by construction — doctor is a one-shot CLI command and the report must be correct with no server running
- The clean-path early return (`plan.groups.length === 0 && !draftIdentityBroken`) was joined by the dependency signal so a defect-only corpus still prints; help schema updated (reads admits drafts/milestones/archive; writes still describes duplicate repair only)
- Measured on this repo: 78 dangling (5 on drafts), 0 of everything else, exit 0; cli-doctor.test.ts covers all classes plus both `--fix` interaction shapes

## Acceptance Criteria

- Cycles, dangling, draft targets, released ids and ambiguous references each reported as warnings; exit stays 0
- Clean corpus still prints "No duplicate task IDs found."; section absent when nothing to report
- `--fix` never touches dependency lists; duplicate repair flow, `--commit`/`--rollback` and other exit codes unchanged
- Same corpus index as the write gate (tasks + completed), no graph service

## Related Concepts

- [[concepts/cli-entry]] — doctor command surface and help schema
- [[concepts/task-identity]] — duplicate/ambiguous id semantics the report cross-references

## Related Sources

- [[sources/back-707-dependency-gate-cycles]] — the write gate whose tolerated defects this report surfaces (same batch)
- [[sources/back-709-dependency-closure-query]] — shares `dependency-closure.ts` traversal (same batch)
- [[sources/back-538-duplicate-task-id-recovery]] — the duplicate-ID repair flow doctor already had

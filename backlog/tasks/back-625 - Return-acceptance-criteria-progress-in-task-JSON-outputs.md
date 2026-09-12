---
id: BACK-625
title: Return acceptance criteria progress in task JSON outputs
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-09 21:52'
updated_date: '2026-09-12 07:07'
labels: []
dependencies: []
references:
  - src/formatters/json-output.ts
modified_files:
  - src/formatters/json-output.ts
  - src/test/cli-json-output.test.ts
priority: medium
actual_start: '2026-09-12 06:51'
actual_end: '2026-09-12 07:07'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Machine-readable task summaries currently omit acceptance-criteria progress, so consumers must load and inspect full checklist data. Return the completed acceptance-criteria count and total acceptance-criteria count consistently anywhere the canonical CLI emits task list or task detail JSON, including task results in search output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-622 and git show 5158868 as implementation reference.
- [x] #2 Task list JSON includes completed and total acceptance-criteria counts for every task summary
- [x] #3 Task detail JSON includes the same acceptance-criteria counts alongside the full checklist
- [x] #4 Task results in search JSON use the same acceptance-criteria count fields as task list output
- [x] #5 Tasks without acceptance criteria return zero for both counts
- [x] #6 Focused automated tests cover complete, partial, and empty acceptance-criteria progress
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Add AC progress counts to task JSON summaries

- 1.1 In src/formatters/json-output.ts toTaskSummaryJson, compute acceptanceCriteriaCompleted and acceptanceCriteriaCount from task.acceptanceCriteriaItems so task list, task view, and search JSON share the fields
- 1.2 Keep the field names acceptanceCriteriaCompleted / acceptanceCriteriaCount and leave the existing normalizePublicDate date handling plus the details-layer structure untouched
- 1.3 Confirm tasks without acceptance criteria emit 0 for both counts

### Phase 2 - Focused tests

- 2.1 Extend src/test/cli-json-output.test.ts with list/view/search JSON cases covering complete, partial, and empty acceptance-criteria progress
- 2.2 Run bunx tsc --noEmit, bun run check ., and the focused test file, then the full suite if needed
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

- src/formatters/json-output.ts: TaskSummaryJson gains acceptanceCriteriaCompleted and acceptanceCriteriaCount, and toTaskSummaryJson computes both from task.acceptanceCriteriaItems (checked count and total), defaulting to 0/0 when the task has no items. Task list, task view, and search task results all flow through this one formatter, so every surface picks up the fields together.
- The existing date fields (dueDate, plannedStart/End, actualStart/End), normalizePublicDate localization, and the details-layer checklist structure are untouched.
- src/test/cli-json-output.test.ts: the list/view/search envelope assertions now pin the new fields, and a new focused test adds partial (1/2) and empty (0/0) fixtures next to the existing complete (1/1) one, asserting all three across task list, task view, and search JSON.

### Verification

- bunx tsc --noEmit clean; bun run check . exits 0 (its 3 warnings are pre-existing in unrelated files); biome check on both touched files clean.
- bun test src/test/cli-json-output.test.ts: 9 pass, 0 fail (81 assertions), including the new complete/partial/empty test.
- Full bun test: 2243 pass, 1 fail - the parallel task-edit locking contention test, a load-sensitive flake that passes 9/9 when the file runs in isolation and is unrelated to the JSON formatter.
- End-to-end smoke on this repository: task list/view/search --json all report BACK-625 progress as 0/6.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added acceptanceCriteriaCompleted and acceptanceCriteriaCount to the shared task summary JSON formatter so task list, task view, and search task results expose acceptance-criteria progress (0/0 when a task has no criteria) without consumers loading the full checklist. Existing date normalization and the details-layer checklist shape are unchanged. Focused tests pin the fields on all three JSON surfaces for complete, partial, and empty progress; typecheck, Biome, the focused suite, and an end-to-end smoke on this repository pass. The full suite shows one load-sensitive failure in the parallel task-edit locking test, which passes in isolation and is unrelated to this change.
<!-- SECTION:FINAL_SUMMARY:END -->

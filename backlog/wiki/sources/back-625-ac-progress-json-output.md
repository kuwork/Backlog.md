---
title: BACK-625 Return acceptance criteria progress in task JSON outputs
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
labels:
  - source
  - cli
  - json
  - api-contract
source_path: backlog/tasks/back-625 - Return-acceptance-criteria-progress-in-task-JSON-outputs.md
---

# BACK-625 Return acceptance criteria progress in task JSON outputs

Machine-readable task summaries omitted acceptance-criteria progress, so any consumer wanting the `4/7` signal had to fetch a task's full checklist. This task adds the completed/total counts to the single shared summary formatter, which simultaneously upgrades task list, task view, and search task results.

## Summary

- `src/formatters/json-output.ts`: `TaskSummaryJson` gains `acceptanceCriteriaCompleted` and `acceptanceCriteriaCount`; `toTaskSummaryJson` derives them from `task.acceptanceCriteriaItems` (checked count / total) and defaults to `0`/`0` when a task has no criteria
- One funnel, three surfaces: task list, task view, and search task results all flow through `toTaskSummaryJson`, so no per-surface wiring was needed
- Deliberately untouched: existing date fields (`dueDate`, `plannedStart/End`, `actualStart/End`), `normalizePublicDate` localization, and the details-layer checklist structure
- Tests: `src/test/cli-json-output.test.ts` (9 pass, 81 assertions) pins the new fields on all three JSON surfaces across complete (1/1), partial (1/2), and empty (0/0) progress
- Reference implementation: upstream `git show 5158868` (upstream BACK-622); field names intentionally kept identical for cross-fork consumers
- Verification: typecheck, Biome, focused suite green; end-to-end smoke shows BACK-625 reporting `0/6` through list/view/search `--json`; the full suite's single failure was the known load-sensitive parallel task-edit locking test, unrelated and green in isolation

## Acceptance Criteria

- Task list JSON exposes completed and total acceptance-criteria counts per task summary
- Task detail JSON exposes the same counts alongside the checklist
- Search JSON task results use the same fields as list output
- Tasks without acceptance criteria return `0` for both counts
- Focused tests cover complete, partial, and empty progress

## Related Concepts

- [[concepts/json-output]] — the versioned `--json` contract these fields extend
- [[concepts/task-lifecycle]] — acceptance criteria as task content consumed by the counts

## Related Sources

- [[sources/back-562-stable-json-output]] — BACK-562 established the summary formatter and schemaVersion 1 envelope
- [[sources/back-569-acceptance-criteria-progress-ui]] — BACK-569 put the same `checked/total` progress into TUI/Web task summaries

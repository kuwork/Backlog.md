---
id: BACK-697
title: Add references and modifiedFiles to task list --json
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-30 19:00'
updated_date: '2026-09-23 21:33'
labels: []
dependencies: []
references:
  - 'src/formatters/json-output.ts:15'
  - 'src/formatters/json-output.ts:146'
  - 'src/formatters/json-output.ts:242'
  - 'src/test/cli-json-output.test.ts:86'
  - 'src/test/cli-json-output.test.ts:129'
modified_files:
  - src/formatters/json-output.ts
  - src/test/cli-json-output.test.ts
actual_start: '2026-09-23 21:25'
actual_end: '2026-09-23 21:35'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
External tools consuming `backlog task list --json` need the references and modifiedFiles of each task without fetching the tasks one by one, and today those two arrays only travel on the detail payload. This puts both on the summary projection that the list and search rows are built from, next to the acceptance-criteria counts the summary already carries, so one list read is enough.

The change is additive under `schemaVersion 1`. The list and search task rows gain two keys, and the detail payload keeps the same content because the fields move up into the shared summary type that the detail type already extends - nothing is renamed, no existing key changes value, and the fork's own summary fields stay exactly as they are.

The list rows are the same records the `--watch` stream republishes, so a live consumer sees both fields on every replacement without any further work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-662 and git show 28f74ef9 as implementation reference.
- [x] #2 Every task in `task list --json` carries `references` and `modifiedFiles`, as empty arrays when the task has neither.
- [x] #3 `search --json` task results carry both fields as well.
- [x] #4 `task view --json` keeps the same payload content: both arrays still present, no key renamed, dropped or retyped.
- [x] #5 The fork's summary-only fields (`dueDate`, `plannedStart`, `plannedEnd`, `actualStart`, `actualEnd`, `isReady`, `source`) are unchanged.
- [x] #6 The addition stays additive under `schemaVersion 1`: no existing key changes value or type.
- [x] #7 Tests pin a populated list row, a task that has neither field, and an unchanged view payload.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Move the two fields onto the summary projection
- 1.1 Add references and modifiedFiles to TaskSummaryJson in src/formatters/json-output.ts, right after the acceptance-criteria counts, so the summary reads in the same order as the rest of the envelope.
- 1.2 Fill both in toTaskSummaryJson from task.references ?? [] and task.modifiedFiles ?? []. The fork projects a TaskListItem, which extends Task, so the record already carries them.
- 1.3 Drop the two declarations from TaskDetailsJson: it extends the summary, so the detail payload keeps both fields without restating them.

### Phase 2 - Keep the rest of the summary shape intact
- 2.1 Leave the summary-only fields alone (dueDate, plannedStart, plannedEnd, actualStart, actualEnd, isReady, source) and keep the fork acceptance-criteria field naming; the two new keys are additive and nothing else moves.
- 2.2 Walk the consumers of summary rows before touching them: the plain and JSON list path, search --json (same projection), the --watch stream (which republishes the same envelope) and the MCP read surfaces (which build their own shape and are out of scope). Pin the search surface in a test rather than changing it.

### Phase 3 - Tests
- 3.1 Extend the compact list-envelope case in src/test/cli-json-output.test.ts with both arrays, and add a case for a task that has neither, which must come back as empty arrays.
- 3.2 Keep the view case as the guard that the detail payload is unchanged, and assert the same two fields on a search result in the same file.

### Phase 4 - Verification
- 4.1 Repair the pre-existing red in the list-envelope case of the same file first, so the assertions this task adds are actually evaluated instead of dying on an unrelated mismatch.
- 4.2 Rollback verification by script (never git checkout --): revert the projection edits, confirm the new assertions fail, then write the fixed block back and re-grep to prove the restore.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation (2026-09-23)
- src/formatters/json-output.ts: TaskSummaryJson declares references and modifiedFiles right after the acceptance-criteria counts, and toTaskSummaryJson fills both from the record with an empty array as the default. TaskDetailsJson drops its two duplicate declarations and its projection stops restating them: it extends the summary, so the spread carries them into the view payload unchanged.
- The summary is projected from a TaskListItem, which extends Task, so no read path had to change for the values to be available. Nothing else moved: the fork summary keeps its own extra fields (dueDate, plannedStart, plannedEnd, actualStart, actualEnd, isReady, source) and the acceptance-criteria field naming, so the addition stays inside schemaVersion 1.
- The projection has three call sites, all in the same file: taskListJson (the task list envelope, which the --watch stream republishes verbatim through the same emit callback), the search envelope, and the detail payload. All three inherit the two fields from the one edit, and no other module needed a change. The MCP read surfaces build their own shape and are out of scope.
- Documentation: the upstream commit only edits a sentence in its CLI-INSTRUCTIONS.md that enumerates the compact summary fields. This fork has no such sentence anywhere in its shipped surface - no shipped guide, no CLI guide section and no help schema enumerates the summary field list - so there was no anchor to rewrite and inventing one would add a new contract the fork does not maintain. The landing is recorded in the ledger entry instead.

### Verification
- src/test/cli-json-output.test.ts: the compact list-envelope case now pins both arrays on the row, a new case covers a task that has neither (both come back as empty arrays), and the search row and the view payload assert them as well. 11 tests in the file, all green.
- The same file carried a pre-existing red at HEAD: the expected object of the list-envelope case was missing the source key the completed-corpus work added to the summary, so that case failed before this task touched anything. The expectation is repaired inside the same assertion block, and the rollback matrix pins it as a real repair rather than a no-op (variant C is red on that case alone).
- Rollback matrix tmp/rollback-697-json-summary.py, 4 variants x 4 cases with each case run on its own: reverting the projection while leaving the fields on the detail type (the shape before this task) makes the list row, the empty-array case and the search row red while the view case stays green, which is what shows the list/search half and the view half are independent; extending the type without filling it makes all four red, because the detail payload spreads the summary and loses them too; restoring the missing source expectation makes only the list case red; the fixed sources are all green. Sources restored byte-exact.
- bunx tsc --noEmit clean; biome clean on the two touched files; bun run check . exits 0 repo-wide (its three warnings - one useTemplate in src/test/board-tui-draft-create.test.ts and two noNonNullAssertion in src/core/assets.ts - predate this task and are untouched).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both arrays now travel on the task summary, so a tool that needs the references and modified files of a task no longer has to fetch that task on its own.

Changes:/n- src/formatters/json-output.ts: TaskSummaryJson declares references and modifiedFiles and toTaskSummaryJson fills them, with an empty array as the default; TaskDetailsJson drops its duplicate declarations because it extends the summary, so the view payload keeps both fields through the spread.
- The fork summary extra fields and its source bucket are untouched, and the addition stays additive under schemaVersion 1.

Verification:/n- src/test/cli-json-output.test.ts - 11 tests green, including a task with neither field, the search row and an unchanged view payload
- tmp/rollback-697-json-summary.py - 4 variants x 4 cases pin each clause of the change
- bunx tsc --noEmit clean; bun run check . exits 0
<!-- SECTION:FINAL_SUMMARY:END -->

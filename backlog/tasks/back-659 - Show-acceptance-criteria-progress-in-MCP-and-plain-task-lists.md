---
id: BACK-659
title: Show acceptance criteria progress in MCP and plain task lists
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-29 17:53'
updated_date: '2026-09-18 22:00'
labels:
  - cli
dependencies: []
references:
  - 'src/ui/acceptance-criteria-progress.ts:13'
  - 'src/mcp/tools/tasks/handlers.ts:93'
  - 'src/mcp/tools/tasks/handlers.ts:97'
  - 'src/cli.ts:64'
  - 'src/cli.ts:2583'
  - 'src/cli.ts:2616'
  - 'src/test/mcp-tasks.test.ts:150'
  - 'src/test/cli-task-list.test.ts:67'
  - 'src/test/cli-task-list.test.ts:79'
modified_files:
  - src/ui/acceptance-criteria-progress.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/cli.ts
  - src/test/mcp-tasks.test.ts
  - src/test/cli-task-list.test.ts
actual_start: '2026-09-18 21:49'
actual_end: '2026-09-18 22:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task list --json` already publishes per-task acceptance criteria progress (`acceptanceCriteriaCompleted` / `acceptanceCriteriaCount`), and the TUI board/list and the web UI already render it, but two list surfaces still hide it: the MCP `task_list` summary lines and `backlog task list --plain`. Both build their rows inline instead of going through a shared formatter, so the same progress has to be added at each call site. Close the gap so every list surface reports the same progress, and leave tasks without criteria rendering exactly as they do today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-642` and `git show 5d727d61b`, and confirm each stated change against the fork before porting it.
- [x] #2 MCP `task_list` summary lines carry acceptance criteria progress as checked/total for every task that has criteria.
- [x] #3 `backlog task list --plain` carries the same checked/total progress per task in both of the row builders that command uses.
- [x] #4 Tasks without acceptance criteria render exactly as before on both surfaces, with no progress noise.
- [x] #5 The suffix is status-independent: a task with criteria that is not In Progress still reports its progress on both list surfaces, unlike the TUI progress bar, which is gated on that status.
- [x] #6 `task list --json` output is unchanged.
- [x] #7 Automated tests cover the MCP list and the plain list with checked, unchecked and absent criteria.
- [x] #8 `bunx tsc --noEmit`, `bun run check .` and the touched suites pass, and every new case was first confirmed red against the unmodified code.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Shared suffix helper

- Add `formatAcceptanceCriteriaSummarySuffix(task)` next to the existing `formatAcceptanceCriteriaProgress` in `src/ui/acceptance-criteria-progress.ts`: return ` (ac: checked/total)` when the task has acceptance criteria and an empty string otherwise.
- Count checked criteria from `task.acceptanceCriteriaItems`, the same source the JSON formatter reads. No status gate - a list shows progress for any task that has criteria, unlike the TUI progress bar which only renders while a task is In Progress.

### Phase 2 - Wire the two surfaces

- MCP: append the suffix in `formatTaskSummaryLine` (`src/mcp/tools/tasks/handlers.ts`), after the status text. This fork's builder renders only a priority indicator, so add the acceptance-criteria fragment and nothing else.
- CLI plain list: `runTaskList` builds rows inline in two places in `src/cli.ts` - the `--sort priority` branch and the status-grouped branch. Append the suffix to both, after the status indicator in the branch that prints one.
- Out of scope, keep unchanged: the JSON path (`src/formatters/json-output.ts`), `formatTaskPlainText`, task detail output, and the plain search results in `printSearchResults` (which prints `[PRIORITY]` and a score rather than this row shape).

### Phase 3 - Tests

- Append a case to `src/test/mcp-tasks.test.ts`: create a task with three criteria and check the first, create a second task without criteria, then assert `TASK-1 - Task with criteria (ac: 1/3)`, `TASK-2 - Task without criteria`, and that a criteria-less title is never followed by ` (ac:`.
- Create `src/test/cli-task-list.test.ts` for the plain surface, since this fork never had that file: seed one task with criteria and one without, run `task list --plain`, assert the same three properties.

### Phase 4 - Verification

- `bunx tsc --noEmit`, `bun run check .`, and scoped `bun test` over the two touched files plus the adjacent task-list suites.
- Revert the implementation first and confirm the new cases are red, then restore and confirm green.
- Real-data smoke: `bun src/cli.ts task list --plain` on this repository shows ` (ac: n/total)` after the status for tasks that have criteria and is byte-identical for the rest.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape of the fork. There was no shared row formatter to reconcile: the two list surfaces each build their own lines, so only the acceptance-criteria fragment is shared (`src/ui/acceptance-criteria-progress.ts:13`). The helper sits beside the TUI progress bar and deliberately has no status gate - a list reports progress for any task that has criteria, while the bar only renders for In Progress tasks. The MCP builder renders a priority indicator and, when asked, a status, but no type or project indicator in this fork, so it gained nothing except the new fragment (`src/mcp/tools/tasks/handlers.ts:93`, `src/mcp/tools/tasks/handlers.ts:97`). There is no `formatPlainTaskListRow` here: `runTaskList` builds rows inline in two branches, the `--sort priority` view and the status-grouped view, and both needed the suffix (`src/cli.ts:2583`, `src/cli.ts:2616`). The grouped branch prints no status per row because the status is the section header; the priority branch does print one, and the suffix follows it.

Kept out of scope. The JSON path already publishes the same counts (`acceptanceCriteriaCompleted` / `acceptanceCriteriaCount`), so it was left alone, as were `formatTaskPlainText` and task detail output. The plain search results in `printSearchResults` still print their own shape (a trailing `[PRIORITY]` plus a score) rather than this row, and were not changed.

Where the fork has no target. No shipped guide documents the plain list row layout - the CLI guides only point at `task list --plain` as a way to browse tasks (`src/guidelines/agent-guidelines.md:637`, `src/guidelines/cli-instructions/overview.md:215`) - and the MCP guides describe `task_list` filters rather than its line format, so the row shape is not part of any documented contract here and the guides needed no edit.

Verification. The three new cases were red first against the unmodified code: the MCP and grouped-list cases failed on the missing suffix, and the priority view failed expecting `TASK-1 - Task With Criteria (To Do) (ac: 3/3)`. Restored, `src/test/cli-task-list.test.ts` and `src/test/mcp-tasks.test.ts` are 33 pass with 0 fail, and `cli-task-list-ready.test.ts` plus `cli-json-output.test.ts` are 15 pass with 0 fail. `bunx tsc --noEmit` is clean and `bun run check .` reports 422 files with 0 errors and the three pre-existing `assets.ts` non-null-assertion warnings.

Real CLI on this repository: `task list --plain` carries ` (ac: n/total)` on 339 rows and no row renders `(ac: 0/0)`; a criteria-less task such as BACK-24.02 still prints its bare row; `--sort priority` places the suffix after the status (`[HIGH] BACK-345.10 - Fix ID generation bugs and cleanup prefix-config leftovers (Done) (ac: 7/7)`); and `task list --json` is unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog task list --plain` and the MCP `task_list` summary lines now report acceptance criteria progress as ` (ac: checked/total)`, closing the last two list surfaces that hid the counts the JSON output already publishes. One shared helper supplies the fragment (`src/ui/acceptance-criteria-progress.ts:13`) with no status gate, and tasks without criteria render exactly as before. Both of the fork's inline plain-list row builders were wired (`src/cli.ts:2583`, `src/cli.ts:2616`), as was the MCP summary line (`src/mcp/tools/tasks/handlers.ts:93`); the JSON path, `formatTaskPlainText`, task detail output and the plain search results are untouched. Verified by first reverting the implementation (all three new cases red, the priority view failing on `(To Do) (ac: 3/3)`), then 33 cases green across the two touched suites and 15 across the adjacent task-list and JSON suites, a clean type check and Biome run, and a real-repository smoke run where 339 rows carry the suffix, no row renders `(ac: 0/0)` and the JSON read is unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->

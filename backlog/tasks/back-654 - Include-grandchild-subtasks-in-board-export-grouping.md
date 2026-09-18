---
id: BACK-654
title: Include grandchild subtasks in board export grouping
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-30 15:23'
updated_date: '2026-09-18 07:06'
labels: []
dependencies: []
references:
  - 'src/board.ts:128'
  - 'src/board.ts:310'
  - 'src/test/board.test.ts:171'
  - 'src/test/board.test.ts:228'
  - 'src/test/board.test.ts:387'
modified_files:
  - src/board.ts
  - src/test/board.test.ts
actual_start: '2026-09-18 07:03'
actual_end: '2026-09-18 07:05'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The markdown board export builds a children map only for tasks whose parent is a top-level task, then emits each status column as the top-level tasks plus their direct children. A subtask whose parent is itself a subtask is therefore filed under the intermediate subtask id, which is never walked, so it is silently dropped from the exported board. The fork code at src/board.ts:128-139 is the same single-level flattening as upstream before the fix, so the fork has the bug.

This task flattens each column depth-first over the existing children map. The per-level ID-ascending sort and the existing └─ subtask rendering shape stay as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-659 and git show ea809c223 as implementation reference.
- [x] #2 generateKanbanBoardWithMetadata emits a subtask of a subtask in the exported board, in the same column as its ancestors and directly under its own parent.
- [x] #3 The flat parent/child export output is unchanged: the one-level case still renders in the same order with the same └─ prefix and the same row content.
- [x] #4 The flattening is depth-first over the existing children map, keeps the per-level ID-ascending sort, and grandchildren keep the single └─ subtask prefix rather than gaining extra indent levels.
- [x] #5 A regression test in src/test/board.test.ts pins the nested parent/child/grandchild chain with exact expected output and is red against the pre-fix board.ts.
- [x] #6 A second test in src/test/board.test.ts pins the exact flat parent/child output, and generateMilestoneGroupedBoard is covered by a case showing it already lists a grandchild, so it needs no change.
- [x] #7 bunx tsc --noEmit, bun run check . and the scoped board test files pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In src/board.ts generateKanbanBoardWithMetadata, replace the one-level build of the final column list (the loop that pushes each top-level task and then spreads its direct children) with a pushWithChildren recursion that walks the existing children map depth-first. Keep the per-level ID-ascending sort and the single └─ prefix at src/board.ts:154.
2. Leave buildKanbanStatusGroups alone: it only partitions tasks by status and never nests them.
3. Check generateMilestoneGroupedBoard as the analysis report asks. Its section builder maps every task in a status straight to a line (src/board.ts:305), with no parent/child filtering, so it cannot drop a grandchild. Confirm that with a test rather than a code change.
4. Add cases to src/test/board.test.ts: an exact-output nested parent/child/grandchild export, an exact-output flat parent/child export, and a milestone-board case covering a grandchild.
5. Verify with bunx tsc --noEmit, bun run check . and the scoped board test files, and revert-check the nested case against the pre-fix board.ts before marking the task done.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline: generateKanbanBoardWithMetadata (src/board.ts:128-139) built each status column as the top-level tasks plus their direct children only, the same shape as upstream before the fix. The children map is keyed by parent id, so a subtask whose parent is itself a subtask was filed under the intermediate subtask id, which the emit loop never walked, and it disappeared from the export.

Reproduced: the new nested case (task-10 Epic, task-11 Child, task-12 Grandchild) fails against the pre-fix board.ts with the TASK-12 row missing, while the flat case and the milestone case stay green.

Change: the final column list is now built depth-first by a pushWithChildren recursion over the existing children map (src/board.ts:128-147). Each level keeps its own ID-ascending sort, and grandchildren render with the single existing prefix at src/board.ts:154, so no new indentation shape was introduced. The working-tree blob is 752346c4b, and the changed hunk is byte-identical to the one in upstream ea809c223; the full-file blob differs only because the fork has diverged elsewhere (buildKanbanStatusGroups canonicalization, milestone board).

buildKanbanStatusGroups was left alone: it only partitions tasks by status and never nests them. The analysis report also asked to check generateMilestoneGroupedBoard. It was checked and needs no change: generateMilestoneSection (src/board.ts:310) maps every task in a status straight to a line with no parent/child filtering, so it cannot drop a grandchild, and a test now pins that.

Tests: two cases added to the existing exportKanbanBoardToFile block in src/test/board.test.ts, the nested chain with exact expected output and the flat parent/child output with exact expected output, plus a case in the generateMilestoneGroupedBoard block showing a grandchild is listed.

Verification: bunx tsc --noEmit clean; bun run check . 417 files, 0 errors (the 3 noNonNullAssertion warnings in assets.ts predate this change); board.test.ts + board-command.test.ts + board-render.test.ts + readme-board.test.ts + board-hide-empty-columns.test.ts + cli-board-integration.test.ts 42 pass / 0 fail; cli.test.ts board view command 7 pass / 0 fail.

Revert check: swapping the hunk back to the pre-fix code (blob 30f70404b) turns exactly the nested case red and leaves the flat case green, which is the byte-identical-flat-output proof. The fix was restored afterwards and the blob hash re-checked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The markdown board export no longer drops subtasks of subtasks. generateKanbanBoardWithMetadata now flattens each status column depth-first over the existing children map instead of one level deep, so a grandchild stays under its parent chain in the same column. Sorting and rendering are unchanged: each level keeps its ID-ascending order and grandchildren still use the single subtask prefix.

The fork code at src/board.ts:128-139 was the same single-level flattening as upstream before the fix, so the bug was real here too; the new nested test fails against the pre-fix blob (30f70404b) with the TASK-12 row missing. Flat parent/child output is byte-identical: its exact-output test passes on both the pre-fix and the fixed code.

generateMilestoneGroupedBoard was checked as the report asked and deliberately left alone. Its section builder maps every task in a status straight to a line, so it cannot drop a grandchild; a test pins that instead of a code change.

Verified with tsc, biome (417 files, 0 errors), 42 board tests across six files plus 7 board CLI cases, and the revert check above.
<!-- SECTION:FINAL_SUMMARY:END -->

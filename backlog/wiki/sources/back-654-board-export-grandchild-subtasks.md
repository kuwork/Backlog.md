---
title: BACK-654 Include grandchild subtasks in board export grouping
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - board-export
  - task-hierarchy
  - upstream-migration
source_path: backlog/tasks/back-654 - Include-grandchild-subtasks-in-board-export-grouping.md
---

# BACK-654 Include grandchild subtasks in board export grouping

The markdown board export built each status column as top-level tasks plus their direct children only; a subtask whose parent was itself a subtask was filed under the intermediate id, which the emit loop never walked, so grandchildren silently disappeared from the export. This task flattens each column depth-first over the existing children map.

## Summary

- `generateKanbanBoardWithMetadata` (`src/board.ts:128-147`) now builds the final column list with a `pushWithChildren` recursion that walks the existing children map depth-first; each level keeps its ID-ascending sort and grandchildren keep the single `└─` subtask prefix — no new indentation shape
- Flat parent/child output is byte-identical: an exact-output test passes on both the pre-fix and fixed code, and the changed hunk is byte-identical to upstream ea809c223
- `buildKanbanStatusGroups` left alone (it only partitions by status, never nests); `generateMilestoneGroupedBoard` was checked and deliberately not changed — its section builder maps every task in a status straight to a line, so it cannot drop a grandchild; a test pins that instead
- Tests: three cases added to `src/test/board.test.ts` — nested parent/child/grandchild exact output, flat parent/child exact output, and a milestone-board grandchild case
- Verified with tsc, Biome, 42 board tests across six files plus 7 board CLI cases, and a revert check turning exactly the nested case red

## Acceptance Criteria

- A subtask of a subtask appears in the exported board, in the same column as its ancestors and directly under its own parent
- Flat parent/child export output is unchanged (same order, same `└─` prefix, same row content)
- Flattening is depth-first over the existing children map with per-level ID-ascending sort
- Regression tests pin the nested chain and the flat case with exact expected output; the milestone board is covered by a grandchild case without code change

## Related Concepts

- [[concepts/upstream-migration]] — ports upstream BACK-659 (commit ea809c223)
- [[concepts/task-lifecycle]] — parent/subtask hierarchy the export now walks fully

## Related Sources

- [[sources/back-653-readme-board-export-in-memory]] — sibling board-export fix; BACK-653 declined the non-mutating sort this task's report also flagged
- [[sources/subtask-grouping-fix]] — BACK-496 subtask grouping in board/list views
- [[sources/back-628-task-hierarchy-section]] — hierarchy rendering in the web task modal

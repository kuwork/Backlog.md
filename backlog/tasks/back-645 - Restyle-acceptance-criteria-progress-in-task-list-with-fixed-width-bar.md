---
id: BACK-645
title: Restyle acceptance criteria progress in task list with fixed-width bar
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-17 08:32'
updated_date: '2026-09-17 15:15'
labels:
  - web-ui
dependencies:
  - BACK-630
ordinal: 245400
actual_start: '2026-09-17 08:32'
actual_end: '2026-09-17 08:55'
---

## Description

The all-tasks list (TaskList) still renders the acceptance-criteria progress as the monospace `[██████░░░░] 4/7` indicator, which is visually inconsistent with the board cards and the task modal after BACK-630 restyled those to the rounded-track bar. Switch the task list to the same bar style, with a fixed width so it does not stretch with the flexible title column.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The task list renders the acceptance-criteria progress with the BACK-630 bar style: a rounded track with an emerald fill sized to the completion percentage and the checked/total fraction to the right of the track, replacing the monospace cells indicator
- [x] #2 The indicator has a fixed width in the list (w-20 outer, shrink-0) and does not stretch to fill the parent title cell
- [x] #3 Board cards (TaskCard) are unchanged: the indicator keeps filling the available header space there via flex-1 on the outer span
- [x] #4 Gating is unchanged: only In Progress tasks with at least one acceptance criterion render the indicator, and role=progressbar with aria-valuenow/aria-valuemax and the title text are kept
- [x] #5 The tsc noEmit check passes
- [x] #6 bun run check . passes with 0 errors
- [x] #7 Scoped tests pass: web-acceptance-criteria-progress (6 pass, one new fixed-width case) and the three web-task-list test files (15 pass)
- [x] #8 Real-browser check in both themes: the list renders the bar correctly for a 2/4 partial task and an 0/4 task, with an identical fixed footprint on every row
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan
1. In src/web/components/AcceptanceCriteriaProgress.tsx change the bar-variant track from `flex-1 min-w-0` to `w-full`, so the width is controlled by the outer span className instead of the track stretching on its own.
2. In src/web/components/TaskList.tsx switch the indicator from `cells={10}` to `variant="bar"` with a fixed-width className.
3. Add a test for the fixed-width usage and run the task-list test files to confirm the table width budget is not affected.
4. Verify in the real browser in both themes with a throwaway In Progress task at 2/4 plus an existing 0/4 task.

## Implementation Notes
- `AcceptanceCriteriaProgress`: the bar-variant track is now `w-full` instead of `flex-1 min-w-0`. The width therefore comes from the outer span: TaskCard passes `flex-1 min-w-[2.5rem]` (fills the header row, unchanged rendering) and TaskList passes `w-20 shrink-0` (fixed 80px footprint). One component serves both width modes; no new variant needed.
- Inside the fixed 80px outer span the fraction text is shrink-0, so the track flexes down to roughly 55px; the overall footprint stays identical on every row regardless of the fraction text length.
- The `data-cell-count` attribute and the `cells` prop only apply to the cells variant, which remains available but is no longer used by any view.

## Verification
- bunx tsc --noEmit passes; bun run check . reports 0 errors (3 pre-existing warnings in src/core/assets.ts).
- bun test src/test/web-acceptance-criteria-progress.test.tsx: 6 pass / 0 fail, including the new case asserting the fixed-width className passthrough, the absence of flex-1 on the track, and the 50% fill width.
- bun test on web-task-list-labels-menu / web-task-list-sort / web-task-list-table-width: 15 pass / 0 fail (Title stays the only flexible column).
- Real-browser walkthrough on /tasks?status=In Progress: the served chunk was grepped for the new class string first; a throwaway In Progress task with 2/4 checked criteria rendered a 50% emerald fill on a gray-200/gray-500 track with the fraction to its right, and an existing 0/4 task rendered the empty track; identical fixed footprint in light and dark themes. The throwaway task was removed afterwards.

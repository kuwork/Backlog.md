---
id: BACK-630
title: Restyle and reposition acceptance criteria progress on web board cards
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-14 03:44'
updated_date: '2026-09-14 04:03'
labels:
  - web-ui
dependencies:
  - BACK-569
priority: medium
ordinal: 231400
actual_start: '2026-09-14 03:40'
actual_end: '2026-09-14 04:20'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On the web kanban board the acceptance-criteria progress indicator (BACK-569) sits below the card title as a monospace [██████░░░░] 4/7 bar, which is wide and visually detached from the task identity.

Move it into the card header row immediately to the right of the task ID, and render it with the same progress style the task modal already uses for the SUBTASKS section (BACK-628): the checked/total fraction followed by a rounded track with an emerald fill.

Scope: web kanban cards (TaskCard) only. The task list view (TaskList) keeps the existing monospace indicator, and the data semantics are unchanged - only In Progress tasks that have at least one acceptance criterion render it, derived live from the checklist.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The board card header row shows the acceptance-criteria progress immediately to the right of the task ID, on the same row as the planned dates and priority badge; the indicator no longer renders below the title
- [x] #2 The card indicator uses the BACK-628 progress style: a rounded full-height-2 track with a bg-emerald-500 fill sized to the completion percentage and the exact checked/total fraction to the right of the track; the track stays distinguishable from the card surface in both themes (bg-gray-200 in light, bg-gray-500 in dark)
- [x] #3 Gating is unchanged: only In Progress tasks with at least one acceptance criterion render the indicator, and a card without it keeps the previous header layout (task ID left, planned dates and priority badge right)
- [x] #4 The indicator keeps role=progressbar with aria-valuenow/aria-valuemax and the checked/total title text
- [x] #5 The task list view (TaskList) rendering is unchanged (monospace cells indicator)
- [x] #6 The tsc noEmit check passes and the acceptance-criteria web tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend src/web/components/AcceptanceCriteriaProgress.tsx with a variant prop: cells (current monospace indicator, default) and bar (fraction + rounded emerald track mirroring src/web/components/TaskHierarchySection.tsx).
2. In src/web/components/TaskCard.tsx move the indicator from below the title into the header row, wrapping the task ID and the indicator in a flex-1 group so the planned dates and priority badge stay pinned right.
3. Add a web test for the bar variant and keep the existing cells-variant tests green.
4. Verify in the real browser: board card renders ID + fraction + emerald bar in both themes, layout unchanged for cards without the indicator.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in src/web/components/AcceptanceCriteriaProgress.tsx and src/web/components/TaskCard.tsx.

- AcceptanceCriteriaProgress gains a variant prop. cells (default) is the unchanged monospace ASCII indicator still used by TaskList; bar renders the modal style copied from TaskHierarchySection.tsx: a rounded h-2 track with a bg-emerald-500 fill at the completion percentage, followed by the checked/total fraction to the right of the track. The cells prop is now optional (default 10) and applies only to the cells variant; data-cell-count is emitted only there. Gating (In Progress + at least one acceptance criterion) and the role/aria/title attributes are unchanged, and no progress value is persisted.
- TaskCard header row now renders a flex-1 group holding the task ID plus the indicator (variant bar, flex-1, 2.5rem minimum), while the planned-date and priority group stays pinned right (shrink-0). The standalone indicator below the title was removed, so the header comment now names the progress too.
- Refinement 1: the fraction text was moved from the left of the track to its right, so a card reads task ID, bar, 2/4, then the badges - the same direction as the cells variant in the task list view.
- Refinement 2 (user report: the track is invisible on dark cards): the card surface is dark:bg-gray-700 and the track was dark:bg-gray-700 too, i.e. literally the same colour. The track is now dark:bg-gray-500.

Contrast evidence for the dark track (computed oklch to relative luminance over the gray-700 card, and confirmed on rendered pixels): gray-700 = 1.00 (the reported bug), gray-600 = 1.36 (faint), gray-500 = 2.13 (chosen), gray-400 = 3.96 against the card but only 1.06 against the emerald fill, so it would erase the fill. Pixel sampling of the rendered board confirmed track rgb(106,114,130) against card rgb(54,65,83) = 2.13 and fill rgb(0,188,125) against the track = 1.96. For reference the light theme track (gray-200 on a white card) measures about 1.18, so the dark track is now the higher-contrast of the two.

Verification against the real app (browser server started from src/cli.ts on port 6611 without auto-open, driven by Chromium; the server was restarted after the colour change because the web bundle is built when the server starts):
- A throwaway In Progress task with 4 acceptance criteria and 2 checked rendered a 109px fill on a 217px track (50%), with the fraction past the track right edge; an 0/4 and a 1/4 card rendered the empty remainder of the track.
- The indicator shares the task ID row and sits above the title in both themes; indicator-free cards keep the previous header layout with no overlap or stray gaps.
- The throwaway task was deleted again on each pass and its card disappeared from the board.

Tests: bun test src/test/web-acceptance-criteria-progress.test.tsx - 5 pass / 0 fail (the bar-variant case asserts the fraction, width:50%, aria-valuenow/max, the absence of data-cell-count, and that the fraction appears after the bar in the markup). The tsc noEmit check passes. bun run check . reports 3 pre-existing warnings and no errors (biome.json ignores src/web and src/test, so the touched files are outside its scope).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved the web board card acceptance-criteria progress into the card header row, immediately right of the task ID, and restyled it as the task modal progress bar from BACK-628: the checked/total fraction followed by a rounded emerald track.

Why: the previous indicator sat below the title as a wide monospace string, visually detached from the card identity row and inconsistent with the modal subtask progress.

Changes:
- src/web/components/AcceptanceCriteriaProgress.tsx: new variant prop - cells (default, unchanged) and bar (modal style)
- src/web/components/TaskCard.tsx: indicator moved into the header row next to the task ID; below-title placement removed
- src/test/web-acceptance-criteria-progress.test.tsx: bar-variant test added

Verification:
- tsc noEmit check passes
- bun test src/test/web-acceptance-criteria-progress.test.tsx (5 pass)
- real browser walkthrough on the board in light and dark themes, including a card at 2/4 partial progress and cards without an indicator
<!-- SECTION:FINAL_SUMMARY:END -->

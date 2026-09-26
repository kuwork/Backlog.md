---
title: BACK-630 Restyle and reposition acceptance criteria progress on web board cards
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - board
source_path: backlog/tasks/back-630 - Restyle-and-reposition-acceptance-criteria-progress-on-web-board-cards.md
---

# BACK-630 Restyle and reposition acceptance criteria progress on web board cards

The acceptance-criteria progress indicator on web kanban cards sat below the title as a wide monospace `[██████░░░░] 4/7` bar, visually detached from the task identity. This task moved it into the card header row next to the task ID and restyled it as the rounded emerald progress bar the task modal already uses for subtasks.

## Summary

- `AcceptanceCriteriaProgress.tsx` gained a `variant` prop: `cells` (default, unchanged monospace indicator still used by TaskList) and `bar` (rounded h-2 track with `bg-emerald-500` fill plus the checked/total fraction to the right of the track, mirroring `TaskHierarchySection.tsx`)
- `TaskCard.tsx` renders the indicator in a flex-1 group with the task ID so planned dates and the priority badge stay pinned right; the below-title placement was removed
- Gating unchanged: only In Progress tasks with at least one acceptance criterion render it, derived live from the checklist; `role=progressbar` with aria attributes kept; no progress value persisted
- Dark-theme contrast bug found by user report: the track was `dark:bg-gray-700`, literally the same colour as the card surface; changed to `dark:bg-gray-500` after computing relative luminance (2.13 against the card vs 1.00 before; gray-400 would erase the emerald fill at 1.06)
- Verified in a real browser (Chromium against the dev server) in both themes with 0/4, 1/4 and 2/4 cards, plus pixel sampling of track/fill colours
- Tests: 5 cases in `web-acceptance-criteria-progress.test.tsx` covering the bar variant (fraction, width, aria values, markup order)

## Acceptance Criteria

- Board card header shows AC progress immediately right of the task ID; the below-title indicator is gone
- Bar variant uses rounded track with emerald fill and the exact fraction, distinguishable from the card surface in both themes
- Gating, aria attributes and title text unchanged; indicator-free cards keep the previous header layout
- Task list view (TaskList) rendering unchanged

## Related Concepts

- [[concepts/web-ui-features]] — board card and modal progress presentation conventions
- [[concepts/task-lifecycle]] — acceptance criteria checklist progress the indicator derives from

## Related Sources

- [[sources/back-628-task-hierarchy-section]] — BACK-628 modal subtask progress bar style reused for the bar variant
- [[sources/back-569-acceptance-criteria-progress-ui]] — BACK-569 original AC progress indicator this task restyles

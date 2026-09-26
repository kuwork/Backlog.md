---
title: BACK-645 Restyle acceptance criteria progress in task list with fixed-width bar
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
source_path: backlog/tasks/back-645 - Restyle-acceptance-criteria-progress-in-task-list-with-fixed-width-bar.md
---

# BACK-645 Restyle acceptance criteria progress in task list with fixed-width bar

The all-tasks list still rendered acceptance-criteria progress as the monospace `[██████░░░░] 4/7` cells indicator, inconsistent with the board cards and task modal after BACK-630 restyled those to the rounded-track bar. The list now uses the same bar variant with a fixed width so it does not stretch with the flexible title column.

## Summary

- `AcceptanceCriteriaProgress.tsx`: the bar-variant track changed from `flex-1 min-w-0` to `w-full`, so width is controlled by the outer span className — one component now serves both width modes with no new variant
- `TaskList.tsx` switches from `cells={10}` to `variant="bar"` with `w-20 shrink-0` (fixed 80px footprint); `TaskCard` keeps `flex-1 min-w-[2.5rem]`, filling the header row unchanged
- Inside the fixed outer span the fraction text is `shrink-0`, so the track flexes down (~55px) and the footprint is identical on every row regardless of fraction length
- Gating and accessibility unchanged: only In Progress tasks with at least one criterion render it, keeping `role=progressbar`, aria values, and title text; the `cells` variant remains available but is unused
- Tests: web-acceptance-criteria-progress 6 pass (new fixed-width case asserting className passthrough and 50% fill), three web-task-list suites 15 pass (Title stays the only flexible column)
- Real-browser walkthrough in both themes: 2/4 task renders 50% emerald fill on a gray track, 0/4 renders empty track, identical fixed footprint per row

## Acceptance Criteria

- Task list renders the BACK-630 bar style (rounded track, emerald fill, fraction beside it) instead of monospace cells
- Indicator has a fixed width and never stretches to fill the title cell; board cards are unchanged
- Gating, progressbar ARIA attributes, and title text are preserved

## Related Concepts

- [[concepts/web-ui-features]] — task list and board card visual conventions unified here

## Related Sources

- [[sources/back-569-acceptance-criteria-progress-ui]] — original acceptance-criteria progress indicator
- [[sources/back-625-ac-progress-json-output]] — same feedback wave; AC progress in CLI JSON output
- [[sources/back-628-task-hierarchy-section]] — sibling modal restyle from the same wave

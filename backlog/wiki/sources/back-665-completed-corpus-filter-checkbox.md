---
title: BACK-665 Add a completed-corpus checkbox to the web board and task list filter bars
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - filtering
  - completed-corpus
source_path: backlog/tasks/back-665 - Add-a-completed-corpus-checkbox-to-the-web-board-and-task-list-filter-bars.md
---

# BACK-665 Add a completed-corpus checkbox to the web board and task list filter bars

The web UI could already read the completed corpus (BACK-662 widened the search option, BACK-663 renders those popups read-only) but neither the board nor the task list could surface it. This task adds an opt-in "Show completed" checkbox as the rightmost control of both filter bars, with the clear-filters button unified directly behind it.

## Summary

- Shared pieces built once and reused by both views: `CompletedFilterToggle.tsx` (checkbox + label) and `useCompletedTasks(enabled)` (fetches the corpus through the BACK-662 `completed=true` search option only while enabled, so unchecked costs nothing)
- The checkbox state rides the URL (`completed=1`) like the other filter parameters, so it survives reloads and shared links; it counts as an active filter, so clear-filters also unticks it
- Completed records ride the ordinary pipeline — same filters, sorting, status-column grouping and counters — instead of a parallel one; the task list passes `completed: showCompleted` on its filtered re-query so the widened corpus is not dropped by the second request
- Wire marker is `task.source === "completed"`, not `isCompleted` (dropped before serialization); the hook keeps only records tagged `source: "completed"` because the widened search also answers with the active corpus — appending raw duplicated every active task (caught by tests via duplicate React keys)
- Two gaps the checkbox alone left: completed `TaskCard`s are now `draggable={false}` like cross-branch cards (a status drag cannot write into `backlog/completed/`), and `App.handleOpenTask` carries `preloadedTask` in the navigation state so clicking a completed row opens the read-only popup instead of bouncing to the board
- Review follow-up: the completed marker moved into the card header's right-hand badge group left of the priority badge and wears the emerald of the modal's mark-completed button via a shared `CompletedBadge`, so colour and tooltip cannot drift between board and list
- i18n: `common.showCompleted` added to en/zh-CN/zh-TW/ja; verified live over CDP in zh-CN, plus per-half revert probes for every behaviour

## Acceptance Criteria

- Both views render the completed checkbox as the rightmost filter control, unchecked by default with byte-identical output when off
- Checkbox state persists via URL; with it on, completed records appear, honour all other filters, land in their own board column, and are counted
- Clicking a completed row/card opens the BACK-663 read-only popup with no edit or comment affordance
- Clear-filters sits immediately after the checkbox in both views and resets it even when it is the only active filter
- Control, fetch and badge exist once and are reused by both views; tests cover default-off parity, appearance once checked, and clear unticking

## Related Concepts

- [[concepts/web-ui-features]] — board and task list filter-bar conventions this control joins
- [[concepts/task-lifecycle]] — the completed corpus as a destination distinct from Done status
- [[concepts/web-ui-i18n]] — four-locale label requirement for every filter control

## Related Sources

- [[sources/back-628-task-hierarchy-section]] — same modal; its `onDrillDown`/`preloadedTask` pattern is what `handleOpenTask` reuses here
- [[sources/back-624-global-search-dialog]] — search infrastructure the completed option rides on
- [[sources/back-672-wiki-tree-sort-toggles]] — same feedback wave of sidebar/filter polish (batch sibling)

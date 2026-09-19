---
id: BACK-665
title: Add a completed-corpus checkbox to the web board and task list filter bars
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-19 09:01'
updated_date: '2026-09-19 16:21'
labels: []
dependencies:
  - BACK-662
  - BACK-663
references:
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/TaskList.tsx
  - src/web/lib/api.ts
  - src/core/search-service.ts
  - src/web/locales/zh-CN.ts
modified_files:
  - src/web/components/CompletedFilterToggle.tsx
  - src/web/hooks/useCompletedTasks.ts
  - src/web/components/TaskList.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/TaskCard.tsx
  - src/web/App.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/web-completed-filter-toggle.test.tsx
  - src/test/web-completed-task-modal.test.tsx
ordinal: 251400
actual_start: '2026-09-19 09:06'
actual_end: '2026-09-19 09:18'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User-reported gap. The web UI can now read the completed corpus - BACK-662 widened queryTasks and SearchService with an includeCompleted corpus, BACK-663 renders those popups read-only - but neither the board nor the task list can surface it. A task moved to backlog/completed/ leaves both views and there is no way back to it, even though the read path already exists.

Two asks:

1. A completed checkbox on both views, appended to the right of the existing filter conditions: after the status, exclude-status, priority, milestone and label controls in the task list, and after the assignee, labels and priority controls on the board. Opt-in and off by default. BACK-362 settled that backlog/completed/ records stay out of the web UI unless asked for, and that default has to survive.

2. One placement for the clear-filters button: immediately after the checkbox in both views. Today the two disagree - the board keeps it inside the filter row, while the task list parks it in a separate right-hand group behind the clean-up button and the "Showing X of Y" counter, so the same control sits in two different places depending on the page.

Decisions worth knowing before implementing:

- Completed means the backlog/completed/ corpus, not the Done status. Both views already filter and group by status, so a Done toggle would be redundant - BACK-265's done-tasks toggle, which predates the status dropdowns, is the ancestor of this control and is not the thing being asked for here. The corpus is served by BACK-662's completed=true search option, which the server already forwards to includeCompleted, and query-less searches are supported.
- The wire marker is task.source === "completed", not isCompleted. isCompleted is dropped before serialization and completed rows are re-tagged with source: "completed" in SearchService; BACK-663's popup already keys off that.
- Completed records should ride the existing pipeline instead of a parallel one: same filters, same sorting, same grouping into status columns, same counter. The checkbox adds a corpus to the visible set, it does not bypass filtering.
- The control and its labels are wanted in all four locales (en, zh-CN, zh-TW, ja), like every other filter control.
- The clear button keeps its current visibility rule (shown when a filter is active), and the checkbox counts as one, so resetting also unticks it.

Out of scope: the drafts page keeps its current clear-button placement. Drafts have no completed corpus, so there is no checkbox for it to follow. Say so if the intent was to unify that row as well.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The board and the task list each render a completed checkbox as the rightmost control of their existing filter row, to the right of every filter condition already there
- [x] #2 The checkbox is unchecked by default; with it unchecked both views render exactly the task set they render today, and checking it is what brings backlog/completed/ records into the view
- [x] #3 Checkbox state survives a reload and a shared link, carried in the URL next to the other filter parameters of each view
- [x] #4 With the checkbox on, backlog/completed/ records appear in both views and are visually marked as completed
- [x] #5 With the checkbox on, completed records pass through the existing filter, sort and group logic: they honour the other active filters, they land in their own status column on the board, and the showing-count includes them
- [x] #6 Clicking a completed row or card opens its read-only popup with the completed-corpus hint, with no edit or comment affordance (BACK-663 behaviour)
- [x] #7 The clear-filters button immediately follows the completed checkbox in both views, and resetting clears the checkbox along with every other filter, including when the checkbox is the only active filter
- [x] #8 The checkbox control and its labels are implemented once and reused by both views rather than duplicated per view
- [x] #9 Tests cover default-off parity with today's output, a completed record appearing in both views once checked, and clear-filters unticking the checkbox
- [x] #10 On the board the completed marker sits in the card header's right-hand badge group, directly left of the priority badge, instead of next to the task ID
- [x] #11 The marker wears the palette of the task modal's mark-completed button: bg-emerald-600 with white text, dark:bg-emerald-700
- [x] #12 The marker itself is rendered once and reused by the board card and the task list row, so its colour and tooltip cannot drift between them
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add two shared i18n keys to all four locales (en, zh-CN, zh-TW, ja): common.showCompleted for the checkbox label and common.completedBadge for the record marker; the badge tooltip reuses taskDetails.completedCorpusHint from BACK-663.
2. Add one shared presentational component, CompletedFilterToggle, so the checkbox and its label exist once and both views render the same control.
3. Add a useCompletedTasks(enabled) hook that fetches the corpus through the BACK-662 search option (type=task, completed=true) and returns only when enabled, so no view pays for it while the box is unchecked.
4. TaskList: read completed=1 from the URL into state, merge the corpus into the base task set, pass completed=showCompleted to the filtered /api/search call so completed records honour the other filters, count it in hasActiveFilters, carry it through syncUrl, reset it in handleClearFilters, and badge completed rows.
5. BoardPage owns the URL flag and the corpus fetch; Board takes filterCompleted plus the merged corpus, renders the toggle after the priority select, and moves the clear button to sit directly behind it. BoardPage's filter object and hasActiveFilters gain the completed flag.
6. TaskCard: badge completed records and make them non-draggable, mirroring the cross-branch task treatment, so a status drag cannot write into the archive. App.handleOpenTask carries the record in the navigation state the way handleDrillDown already does, otherwise the modal's unknown-id fallback bounces a completed card or row back to the board instead of opening it read-only.
7. Tests for both views (default-off parity, completed record appears once checked, clear unticking the box) plus the existing suites, then gates and a real-browser check.

8. Review follow-up: move the board card's completed marker out of the task-ID group into the header's right-hand badge group, directly left of the priority badge, and give it the task modal's mark-completed emerald by pointing both the card and the task list row at the shared `CompletedBadge` that BACK-664 added for the picker. Pin the placement and the palette with assertions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Both views now end their filter row the same way: a completed-corpus checkbox, then the clear-filters button.

Shared pieces rather than two copies: `src/web/components/CompletedFilterToggle.tsx` (the checkbox plus its label) and `src/web/hooks/useCompletedTasks.ts` (the corpus fetch, only while enabled). One new key in all four locales - `common.showCompleted` for the label. The record marker's `common.completedBadge`, whose tooltip reuses BACK-663's `taskDetails.completedCorpusHint`, came with BACK-664.

Task list (`src/web/components/TaskList.tsx`): reads `completed=1` from the URL, merges the corpus into the corpus it counts and filters over, and carries the flag through `syncUrl`, `hasActiveFilters` and `handleClearFilters`. When other filters are active the list re-queries the server, so that request now passes `completed: showCompleted` as well - the widened corpus rides the same filters instead of being dropped by the second request.

Board (`src/web/components/Board.tsx`, `src/web/components/BoardPage.tsx`): BoardPage owns the URL flag and the fetch and hands Board the merged corpus, so completed records go through the ordinary board pipeline - same filters, same status columns, same counters - and the filter object gains `completed`. Board renders the toggle after the priority select with the clear button directly behind it; the task list's clear button moved out of the right-hand group for the same reason.

Two things the checkbox alone did not cover:

- A completed card was draggable, and dragging one between status columns tries to write into `backlog/completed/`. `TaskCard` now treats completed records like cross-branch ones for dragging (`draggable={false}`) while staying clickable for the read-only popup.
- `App.handleOpenTask` navigated without the record, so clicking a completed row or card hit the unknown-id fallback and bounced back to the board. It now carries `preloadedTask` the way BACK-664's `handleDrillDown` does.

One real bug the tests caught: the widened search answers with the active corpus as well, so appending it raw duplicated the active task on both views (React warned about duplicate keys). The hook therefore keeps only records marked `source: "completed"`. A test asserts one row per record on both views so this cannot come back.

i18n: `common.showCompleted` is "显示已完成" / "Show completed" / "顯示已完成" / "完了を表示".

Verified against the running board (`bun src/cli.ts browser -p 6477 --no-open`, headless Chrome over CDP, locale zh-CN):
- /tasks, box unchecked: `#task-list-completed-filter` present and unchecked, no BACK-624 row, and no request carried `completed=true`.
- /tasks, box ticked: URL becomes `?completed=1`, one `completed=true` request, the row reads "BACK-624 Global Spotlight-style search dialog for Web UI 已完成", the badge tooltip is the corpus hint, and 清除筛选 is the toggle label's next element sibling.
- Clicking that row opens /task/624/global-spotlight-style-search-dialog-for-web-ui with the archive hint, zero 编辑 buttons and no comment box.
- The board is the index route (`/`): unchecked shows no completed card; ticked shows the card with the 已完成 badge, `draggable="false"`, and 清除筛选 directly behind the toggle.

Revert verification, one half at a time (each run confirmed red, then restored):
- hook's `source === "completed"` filter removed -> the two no-duplicate assertions fail, the other two stay green.
- `preloadedTask` dropped from `handleOpenTask` -> only the row-click-through case fails.
- `TaskCard` draggable exclusion removed -> only the draggable assertion fails.
- `completed: showCompleted` dropped from the task list's filtered request -> only the widened-request case fails.
- task list's merged corpus reverted -> the list appearance case fails.
- task list's `hasActiveFilters` reverted -> the clear-button placement case fails.
- Board's merged corpus reverted -> both board cases fail.
- Board's `hasActiveFilters` reverted -> the board clear-button placement case fails.

Gates: bunx tsc --noEmit clean; bun run check . clean (3 pre-existing assets.ts warnings); bun test src/test/web-*.test.tsx 182 pass / 0 fail, and the two touched files plus the filter-bar neighbours 32 pass.

Review follow-up - two corrections to where the marker sits and what colour it wears, both verified the same way as the rest of the change.

Placement: the card marker used to sit next to the task ID on the left. On a board card the marker is a badge like the priority one, so it now lives in the header's right-hand group, directly left of the priority badge, right-aligned with the row. Measured on the running board with the checkbox ticked: the marker's group is the header row's last child, and its right neighbour is the priority badge (the group reads "已完成高" on BACK-120).

Colour: the marker wears the emerald of the task modal's 标记为已完成 button - the action that puts a task into this corpus. `CompletedBadge` renders it once and both the board card and the task list row reuse it, each passing its own chip shape: `bg-emerald-600 text-white dark:bg-emerald-700`. Computed colours on the running app: marker `oklch(0.508 0.118 165.612)` on `rgb(255, 255, 255)`, the modal button `oklch(0.508 0.118 165.612)` on `rgb(255, 255, 255)` - identical.

Revert verification, one half at a time: marker moved back next to the task ID -> only the placement assertion fails (`Received: "BACK-624Completed"`); the shared component's colour reverted to the old slate -> only the two colour assertions fail, on the board and the task list alike. Gates after restoring: tsc clean, biome clean, web suites 182 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The board and the task list both end their filter row with an opt-in completed-corpus checkbox followed immediately by the clear-filters button. Checking it fetches backlog/completed/ through BACK-662's search option and appends it to the records the view already shows, so completed records ride the ordinary pipeline - same filters, same sorting, same status columns, same counters - and clicking one opens its read-only popup from BACK-663. Unchecked, both views render exactly what they rendered before, which keeps BACK-362's default intact.

The control and its fetch exist once (`CompletedFilterToggle`, `useCompletedTasks`) and both views reuse them. Two gaps the checkbox alone would have left are closed too: completed cards are no longer draggable, so a status drag cannot write into the archive, and `handleOpenTask` carries the record in the navigation state, so clicking a completed row opens it instead of bouncing back to the board. The tests caught a real duplication bug on the way - the widened search answers with the active corpus as well - which is why the hook keeps only records marked `source: "completed"`.

Verified with the checkbox off and on in both views against the running board (headless Chrome over CDP, locale zh-CN), with each half of the change reverted in turn to confirm the tests fail without it. Gates: tsc clean, biome clean, web suites 182 pass.

Review follow-up: the board card's completed marker now sits in the header's right-hand group directly left of the priority badge, and wears the emerald of the task modal's mark-completed button. One shared `CompletedBadge` renders it for the board card and the task list row, so its colour and tooltip cannot drift between the two.
<!-- SECTION:FINAL_SUMMARY:END -->

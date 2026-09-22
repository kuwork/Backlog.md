---
id: BACK-675
title: >-
  Merge the TUI acceptance-criteria bar follow-ups into one ASCII colored
  compact bar
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-20 16:44'
updated_date: '2026-09-20 21:37'
labels:
  - tui
dependencies: []
references:
  - src/ui/acceptance-criteria-progress.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/tui-acceptance-criteria-progress.test.ts
modified_files:
  - src/ui/acceptance-criteria-progress.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/tui-acceptance-criteria-progress.test.ts
priority: low
ordinal: 256400
actual_start: '2026-09-20 17:33'
actual_end: '2026-09-20 21:37'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI acceptance-criteria bar still renders with Block Element glyphs (U+2588 filled / U+2591 light shade) at 10 cells wide and 5 cells narrow, and it never degrades to anything else.

Why that is a real problem: blessed only guarantees glyph fallback for DEC Special Graphics (box drawing). Block Elements render as blank cells on terminal fonts that lack them, and as "?" without a UTF-8 locale, so on the Windows consoles this project primarily runs on the bar can be invisible or garbled.

The bar should end up as a compact ASCII indicator: plain `#` for filled cells and `-` for empty ones, 5 cells when the row is wide and 3 in constrained layouts, with the filled run colored by the established completion semantics (green when every criterion is checked, red at or below one third, yellow between), and clamping so any progress shows at least one cell while unfinished work never fills the bar.

The bar is a scanning aid, so it belongs on the rows only: the task detail pane shows the acceptance-criteria heading and its checklist, with no bar line at any width.

Goal: one pass that lands the final form of the bar - ASCII glyphs, compact sizing, color, clamping - on the board rows, including the narrow-terminal behavior, and takes the detail-pane copy out so the two surfaces no longer disagree about how completion is shown.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 -- src/ui/acceptance-criteria-progress.ts` and `git show <commit>` (BACK-551, BACK-657, BACK-666) as implementation reference.
- [x] #2 The TUI acceptance-criteria bar renders its full and empty cells as plain ASCII (# and -), so it stays legible on terminal fonts without Block Element glyphs and under a non-UTF-8 locale.
- [x] #3 The bar uses 5 cells when the available width permits and 3 cells in constrained layouts, including a re-render on terminal resize so a narrower window switches to the compact form.
- [x] #4 The filled run is colored through the shared status color helper, using the established completion semantics: green when every criterion is checked, red at or below one third complete, yellow between.
- [x] #5 The filled count is clamped so any checked criterion shows at least one filled cell and unfinished work never fills the bar completely.
- [x] #6 A task with no acceptance criteria or a status other than In Progress renders no bar at all, and the indicator carries no AC label and no percentage.
- [x] #7 Progress is derived live from the task's checked and total acceptance criteria, with no persisted progress state.
- [x] #8 On a task whose criteria are all checked but which is still In Progress, the row keeps the active-work status icon rather than the terminal-status checkmark, so the bar cannot be read as implying the task is Done.
- [x] #9 The wide-versus-narrow width threshold is 40, so a board column narrower than that takes the compact 3-cell form.
- [x] #10 The bar appears on the board card rows only: the task detail acceptance-criteria section renders its heading and checklist with no bar. The CLI and MCP (ac: x/y) suffix is unchanged.
- [x] #11 Tests cover partial completion, no criteria, all criteria checked while In Progress, the wide and compact layouts, the color boundary at one third, the clamp at both extremes, and the absence of the bar in the task detail section.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rewrite `formatAcceptanceCriteriaProgress` in `src/ui/acceptance-criteria-progress.ts` into the compact ASCII form:

- import `wrapStatusColor` from `status-icon.ts`;
- add `FILLED_CELL = "#"` and `EMPTY_CELL = "-"` constants, with a comment recording why Block Elements are unusable (blessed only guarantees DEC Special Graphics fallback);
- switch the cell counts to 5 wide and 3 compact;
- add a `completionColor(checked, total)` helper: green when complete, red at or below one third, yellow between;
- clamp the rounded filled count so `checked > 0` yields at least one cell and `checked < total` never fills the bar.

2. Set `WIDE_PROGRESS_MIN_WIDTH` to 40, so the wide/compact boundary on the board rows matches the reference behavior. A narrower value leaves the wide 5-cell bar on columns that are already too tight for it. Leave `formatAcceptanceCriteriaSummarySuffix` and its CLI / MCP `(ac: x/y)` call sites untouched.

3. Keep the bar out of the detail pane. `src/ui/task-viewer-with-search.ts` paints the acceptance-criteria section as heading plus checklist: the bar line it used to push without a width, its import, and the width plumbing that existed only to size it go away, so the board row is the single completion surface.

4. Confirm the board path threads width correctly (`src/ui/board.ts` receives `availableWidth` computed per column) and that resize re-renders the list at the new cell count.

5. Extend `src/test/tui-acceptance-criteria-progress.test.ts` to assert:

- the exact emitted strings, including that the stripped string is only ASCII bar characters between the brackets (`/^\[[#-]*\] \d+\/\d+$/`);
- the color tag at every boundary (complete, at one third, just above one third, nothing checked);
- the clamp at both extremes;
- both cell counts, checked at the threshold and just below it.

6. Add coverage that exercises the surfaces rather than the pure function alone: board rows asserted with a task that actually carries acceptance criteria, plus the detail section asserted to render the checklist and no bar. Today's fixture uses status `To Do` and never reaches the progress branch. Include a board row at the column width the board's own formula yields on a 120-column, three-column board.

7. Verify rendering at a wide and a narrow width on a board row, confirm the bar switches 5 to 3 cells there and the color matches the completion ratio, and confirm the detail section draws no bar at any width.

8. Run `bunx tsc --noEmit`, `bun run check .`, and the scoped test file; inspect the final diff and confirm it contains only the intended changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed

- `src/ui/acceptance-criteria-progress.ts` - rewrote `formatAcceptanceCriteriaProgress` into the compact ASCII form: `#` filled / `-` empty cells, 5 cells wide and 3 compact, a `completionColor(checked, total)` helper (green when complete, red at or below one third, yellow between) applied through `wrapStatusColor`, and clamping so `checked > 0` yields at least one filled cell while `checked < total` never fills the bar. `WIDE_PROGRESS_MIN_WIDTH` is 40, so a column narrower than that takes the compact form. `formatAcceptanceCriteriaSummarySuffix` is untouched.
- `src/ui/task-viewer-with-search.ts` - the detail pane no longer paints the bar. `generateDetailContent` renders the acceptance-criteria heading followed by the checklist, with no bar line at any width; the bar line, its import, and the width plumbing that existed only to size it (the `availableWidth` argument, the quick-look popup pass-through, and the resize re-render) are removed, leaving the file otherwise at its committed form. The board row is now the single completion surface.

## Verification

- `bun test src/test/tui-acceptance-criteria-progress.test.ts` - 18 pass / 0 fail. The file covers the pure function (exact emitted strings, ASCII-only invariant, color at every boundary, clamp at both extremes, both cell counts at the threshold and just below it), board rows (compact at a constrained column, wide when there is room, and the width the board's own column formula yields on a 120-column three-column board), and the detail section (checklist present, no bar).
- Regression checks: reverting the threshold to 32 turns the boundary case and the board-formula case red; restoring the detail-pane bar line turns the no-bar assertion red while the other 17 stay green.
- `bunx tsc --noEmit` clean; `bun run check` reports only the 3 pre-existing `assets.ts` warnings.
- Rendered against task BACK-411 (In Progress, 0 of 4 criteria): the board row shows `[-----] 0/4` at width 80 and `[---] 0/4` at 36, 31 and 20, which is the reference behavior in a narrow window; the detail section shows the heading and the checklist with no bar.

## Notes

- The threshold moved from 32 to 40 while this task was in flight. At 32 the fork kept showing the wide 5-cell bar on columns where the compact form was already the right fit; a 120-column three-column board (column width 36) sits exactly in that band. Setting it to 40 removes a visible divergence from the reference behavior. The CLI / MCP `(ac: x/y)` suffix is still deliberately kept.
- The detail pane carried its own bar line, computed without a width so it always took the wide path. Reviewing the running TUI settled the question: the detail view is not a completion surface, so the bar was taken out there rather than made responsive. That insertion point was the fork's only divergence on this feature, and the shape now matches the reference - the bar on the row, nothing in the detail view.
- Environment incident during this task, unrelated to the code: the local git refs were replaced by an external fetch and the working branch reference went missing. It was restored from the remote, which still carried the previous tip, so no work was lost. Worth a `git rev-parse HEAD` probe before relying on git state in this repository.
<!-- SECTION:NOTES:END -->

---
id: BACK-678
title: Improve composer usability at extreme terminal sizes
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-07 20:45'
updated_date: '2026-09-21 02:51'
labels:
  - tui
dependencies: []
references:
  - src/ui/components/task-composer.ts
  - src/test/tui-task-composer.test.ts
  - src/test/tui-task-composer-layout.test.ts
modified_files:
  - src/ui/components/task-composer.ts
  - src/test/tui-task-composer.test.ts
  - src/test/tui-task-composer-layout.test.ts
priority: low
actual_start: '2026-09-21 02:37'
actual_end: '2026-09-21 02:51'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two composer layout defects show up at the terminal sizes people actually use. At 8 rows the popup is only 6 rows tall, which leaves the scrollable form a single visible row: the 3-row bordered Title and Description inputs render as a bare border with no editable row and no visible cursor, so nothing tells the user the composer is accepting input at all. At 80 and 100 columns each selector is sized at 30% of the form, which is 20 cells, while "Status: In Progress ▼" needs 21 — the trailing cue that marks it as a selector is clipped, and a longer configured status is cut off much earlier. Compact layout only engages below a fixed 64-column threshold, so the breakpoint does not track the content that actually has to fit.

The goal is a composer that stays legible and obviously editable across the terminal sizes people really use, without waiting for a full responsive redesign: derive the popup height from the popup chrome plus one complete bordered input, and derive the popup width and the compact decision from the longest configured selector content measured in display cells.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream implementation with `git log --oneline v1.50.1..v1.52.0 --grep BACK-589` and `git show 3af4056e` before changing anything.
- [x] #2 At terminal heights of 8 to 10 rows, the focused composer field always shows at least one editable row with a visible cursor.
- [x] #3 Selector values render without clipping at 80 and 100 columns for the longest shipped status value, including the trailing selector cue.
- [x] #4 Compact layout engages whenever the longest configured selector content cannot fit a normal selector column, not only below a fixed 64-column threshold.
- [x] #5 Rendered-widget evidence at 80x8, 80x9, 80x10, 80x24 and 100x24 (form height, editable row inside the viewport, cursor, selector width versus content width) is recorded on the task.
- [x] #6 Regression tests cover the short-height layout, the content-derived selector width, and a reflow between the normal and compact layouts.
- [x] #7 Field navigation, picker flow, focus graph and persistence behaviour are unchanged and the existing composer suites still pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Measure the longest configured selector content (status and priority choices, including the value and the trailing selector cue) with Bun.stringWidth, and size the popup so a normal selector column can hold it: clamp to the available terminal width, never go below the preferred 72 columns, and grow beyond it only when the content requires it.
2. Derive the minimum popup height from the popup chrome plus the three rows of a complete bordered text input, so a short terminal keeps an editable row and a visible cursor in the focused field; keep the popup inside the screen at every height.
3. Replace the fixed 64-column breakpoint with the content and height constraints, so the stacked full-width selector rows engage exactly when a normal selector column would clip its label, value or cue.
4. Add deterministic layout coverage and rendered-widget regression coverage at 8, 9 and 10 rows and at 80 and 100 columns, then verify on real screens that the focused input's editable row is inside the form viewport, its cursor is visible, and the selector content fits its rendered width.
5. Keep field navigation, picker flow, focus graph and persistence untouched; run the focused composer suites, bunx tsc --noEmit and bun run check ..
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented content-derived composer geometry in `src/ui/components/task-composer.ts`. The popup height now reserves the popup chrome plus one complete three-row bordered input, and both the popup width and the compact decision come from the longest configured selector content measured with `Bun.stringWidth` instead of the fixed 64-column breakpoint and the fixed 72/96% widths. A normal selector column is still 30% of the form; the popup simply grows (capped by the terminal and by `createPopupChrome`'s four-column backdrop margin) until that column holds the widest configured value plus its trailing cue.

Fork adaptation: upstream's separate `stackSelectors` flag was not ported. This fork has no type selector and its compact layout already stacks both selectors on their own full-width rows, so compact is the only stacked shape and a second flag would have been dead state.

Measured before/after on real blessed screens (`Object.defineProperty(screen, "width"/"height")` + `openTaskComposer`, widgets inspected through `screen.children`):
- 80x8: scrollable form 1 -> 3 rows. The focused field's editable row (widget row 1, below the input's top border) was outside the one-row viewport, so the bordered Title and Description inputs showed a bare border with no editable row and no caret.
- 80x9: form 2 -> 3 rows. 80x10: form stays 3 rows, popup height 8.
- 80x24 and 100x24 with statuses `["In Progress", "To Do", "Done"]`: status selector 20 -> 21 cells for a 21-cell `Status: In Progress ▼`, so the cue is no longer clipped (popup 72 -> 74 columns).
- 80x24 and 100x24 with a 37-cell configured status: selector 20 cells (clipped) -> 66 and 86 cells in the stacked compact layout.

Validation: the new `src/test/tui-task-composer-layout.test.ts` (4 tests, 72 assertions) drives the real composer at 80x8, 80x9, 80x10, 80x24, 100x24, 140x24 and 50x18, and `src/test/tui-task-composer.test.ts` gained 2 layout tests (15 pass / 0 fail together with the new file: 19 pass). Related suites all green: tui-task-composer-unicode 2, board-hide-empty-columns 14, board-render 4, tui-emoji-width 4, tui-vim-boundary-navigation 5, help-popup 8, tui-acceptance-criteria-progress 18, tui-definition-of-done 1, tui-documentation 1, tui-final-summary 2, tui-window-title 12, tui-runtime-cwd 2, tui-edit-session 3. `bunx tsc --noEmit` clean; `bun run check .` covers 431 files with only the 3 pre-existing `assets.ts` warnings. `board-loading`'s 2 `checkActiveBranches` failures are pre-existing and unrelated (that file does not import the composer; they come from the sandbox being unable to create `refs/remotes/origin/*`).

Rollback verification: restoring the whole implementation from HEAD turns exactly the six new assertions red (4 rendered + 2 layout) while the 13 pre-existing ones stay green. Two targeted rollbacks isolate them: reverting only the popup-height clause reddens the two height assertions (the old code reports `form.height` 1 against the required 3 at 80x8) and leaves the four width ones green; reverting only the popup width and the compact decision reddens exactly the four width/compact assertions and leaves the height ones green.

Evidence limits worth recording: a genuine PTY run is not possible on this machine - the repository's interactive PTY harness (`tui-ready-filter-pty`) skips itself on win32 because it needs `expect` - so the evidence is the rendered-widget geometry of real blessed screens, the same measure upstream recorded as its deterministic widget evidence. At 50 columns a 37-cell selector cannot fit at all (the terminal caps the popup at 46 cells), so that step asserts the stacked geometry only.

ID note: this fork allocates BACK-678 locally, a number an upstream task also uses for CORE-34 (due date as a date-only string). The fork keeps its allocated number and the classification ledger line is left for a separate bookkeeping change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The task composer now derives its geometry from its content instead of fixed breakpoints. The popup reserves the popup chrome plus one complete bordered input, so from 8 rows up the focused field keeps an editable row and a painted caret, and the popup width grows past its preferred 72 columns until the longest configured selector value and its trailing cue fit a normal column, switching to the stacked full-width compact layout whenever they cannot. Added a rendered-widget regression file for 8 to 10 rows, 80/100 columns, a long configured status and resize reflow; confirmed every new assertion fails when the old geometry is restored, and verified with TypeScript, Biome and the neighbouring TUI suites.
<!-- SECTION:FINAL_SUMMARY:END -->

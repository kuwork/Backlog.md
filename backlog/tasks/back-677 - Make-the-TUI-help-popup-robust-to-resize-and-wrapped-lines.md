---
id: BACK-677
title: Make the TUI help popup robust to resize and wrapped lines
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-07 20:45'
updated_date: '2026-09-21 00:33'
labels:
  - tui
dependencies: []
references:
  - src/ui/components/help-popup.ts
  - src/ui/components/filter-popup.ts
  - src/test/help-popup.test.ts
modified_files:
  - src/ui/components/help-popup.ts
  - src/ui/components/filter-popup.ts
  - src/test/help-popup.test.ts
priority: low
actual_start: '2026-09-21 00:23'
actual_end: '2026-09-21 00:33'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI help popup is built on `createPopupChrome`, which already returns a `reflow` helper: the task composer calls it on every resize. The help popup never does. Everything it needs is therefore already available, and three defects follow from not using it. All three were reproduced against the current fork by driving a real screen at 80x24 and then shrinking it to 80x12.

The backdrop stops tracking the popup. `createPopupChrome` centers the popup with `top: "center"`, which the renderer resolves at draw time, so the popup re-centers itself when the terminal height changes; the gray panel behind it is placed with absolute coordinates computed once at creation. Shrinking 80x24 to 80x12 moves the popup to `top: -4` while the backdrop stays at `top: 0, height: 23`, so the panel hangs seven rows below the popup instead of hugging it.

The popup never re-sizes either. Its height is fixed at the terminal size that was current when the help key was pressed, so a popup opened on a 24-row terminal keeps `height: 21` on a 12-row one: it centers at a negative top, its bottom border and help row fall off-screen, and the scroll bound - derived from the shortcut count rather than from rendered rows - still reports the value computed at open, so the help text cannot be scrolled to its end.

The same logical-count math also understates the content on narrow terminals, where shortcut descriptions wrap: at 30x24 the board shortcuts render as more rows than there are shortcuts, so the computed bound is 0 and the tail of the list is clipped.

Goal: take the layout from the live terminal size and the scroll bounds from the renderer's own wrapped row count, both on open and on every resize; clamp the offset to the recomputed bound; keep the footer hint in step with what actually scrolls; and drop the resize listener when the popup closes. The fork's shortcut sets, help text and close keys stay as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-588` and `git show faba7359` as implementation reference, and confirm each change against the fork before porting it - both the help popup and its chrome helper are self-authored here, so the port targets the fork's own insertion points rather than upstream files.
- [x] #2 With the help popup open, a terminal resize reflows it: the popup height follows the new viewport, and shrinking 80x24 to 80x12 leaves the popup fully on-screen with its border and help row inside the viewport.
- [x] #3 The backdrop follows the popup across a resize instead of staying where it was drawn: its top tracks the popup's top, and its bottom stays within one row of the popup's bottom.
- [x] #4 After a resize the scroll bound is recomputed from rendered rows: the current offset is clamped to the new maximum, rows that no longer fit remain reachable, and the footer hint shows the scroll hint only while the content actually overflows.
- [x] #5 On a narrow terminal where shortcut descriptions wrap, the help content scrolls to its final rendered line - verified with the full board shortcut set at 30x24.
- [x] #6 The popup height never exceeds the terminal height, including terminals shorter than the five-row minimum, so the chrome rows cannot be pushed off-screen.
- [x] #7 The resize listener is removed when the popup closes, so a later resize does not reach a destroyed popup.
- [x] #8 Regression tests drive a real screen: resize an open popup and assert the popup, backdrop and help row positions; the offset clamp and footer behaviour after the resize; and the wrapped board set at 30x24 scrolled to its last line.
- [x] #9 The fork's own surfaces are unchanged: the four help contexts keep their shortcut lists and the close keys stay `escape/q/Q/?`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `src/ui/components/filter-popup.ts`: add `getScrollHeight(): number` to the `ScrollableViewport` type. The renderer already implements it on the scrollable box, so this is a type-level change only.

2. `src/ui/components/help-popup.ts`: hoist the popup width and the footer text into `HELP_POPUP_WIDTH` and `getHelpText(scrolls)`, so the layout pass can rebuild both; make `getHelpPopupHeight` clamp its result to the terminal height so the popup can never be taller than the screen it sits on.

3. Take `reflow` from `createPopupChrome` and add three helpers: `getMaxScrollOffset()` from the viewport's `getScrollHeight()` minus its visible height, `applyLayout()` that recomputes the height, reflows, renders, clamps `childBase` to the fresh bound and reflows again with the measured footer text, and `onResize()` that calls it while the popup is open.

4. Read the terminal height at layout time rather than once at open, register `screen.on("resize", onResize)`, and run `applyLayout()` in the `setImmediate` that focuses the popup so the first paint is laid out too. Remove the listener in the close path, and rewrite `scrollBy` to read the current bound instead of the stale one.

5. Extend `src/test/help-popup.test.ts` with real-screen cases: a resize with the popup open (popup, backdrop and help row positions), the offset clamp and the footer hint after the resize, and the wrapped board set at 30x24 scrolled to its final rendered line.

6. Re-check the fork's own surfaces: the four help contexts keep their shortcut lists, the close keys stay `escape/q/Q/?`, and the chrome helper's other callers (the task composer, which already reflows) are unaffected.

7. Run the scoped test, `bunx tsc --noEmit`, `bun run check .`, and the neighbouring TUI suites; confirm each new assertion fails against the pre-change code before keeping it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed

- `src/ui/components/help-popup.ts` - the popup lays itself out from the live terminal size and derives its scroll bound from what the renderer actually drew. `getHelpPopupHeight` now clamps to the terminal so the popup can never be taller than the screen it sits on; the width and the footer text moved into `HELP_POPUP_WIDTH` and `getHelpText(scrolls)` so a layout pass can rebuild both. `openHelpPopup` takes `reflow` from `createPopupChrome` and adds `getMaxScrollOffset`, `applyLayout` and `onResize`: each pass recomputes the height, reflows the chrome (which also re-anchors the backdrop), renders so the renderer has parsed the content at the new width, clamps `childBase` to the measured bound, then reflows again with the footer the measurement implies. `scrollBy` reads the current bound instead of the one computed at open, and the close path removes the resize listener.
- `src/ui/components/filter-popup.ts` - `ScrollableViewport` declares `getScrollHeight(): number`. Type-level only; the scrollable box already implements it.
- `src/test/help-popup.test.ts` - the sizing test also pins the terminal-height clamp, and three real-screen cases drive an open popup: a 24-to-12 row shrink (popup, backdrop and help-row positions, the offset clamp, and the footer hint flipping with the measured overflow), the wrapped board set at 30x24 scrolled to its final rendered line, and the resize listener's registration and removal across a close.

## The reported defect

The backdrop is what stops hugging the popup. `createPopupChrome` centers the popup with `top: "center"`, which the renderer resolves at draw time, while the backdrop is placed at absolute coordinates computed once. With no reflow, the popup re-centers on its own and the panel stays where it was drawn. Reproduced before the change at 80x24 shrunk to 80x12: popup `top: -4, height: 21` against a backdrop frozen at `top: 0, height: 23` - a gray band seven rows below the popup, with the popup's own bottom border and help row off-screen. After the change: popup `top: 1, height: 10`, backdrop `top: 0, height: 12`.

## Notes

- The fork's own surfaces are unchanged: four shortcut contexts with their existing lists, the same footer wording, and `escape/q/Q/?` still close the popup. Only sizing and scroll derivation moved.
- `getHelpPopupHeight` returns `Math.min(screen.height, preferred)`. Below the five-row minimum the popup is simply as tall as the terminal (3 rows on a 3-row screen), which keeps the border and help row on-screen instead of pushing them past the bottom.
- `applyLayout` runs on open as well as on every resize, so the first paint already carries the measured bound and the right footer; the `helpText: getHelpText(false)` passed to `createPopupChrome` is only the pre-layout placeholder.
- `screen.height` reads `program.rows`, and the renderer updates it before emitting `resize`, so the handler already sees the new size. The fork's previous `typeof screen.height === "number" ? screen.height : 40` fallback is gone because the property is a number on every path.
- The repository handed this task BACK-677, but that number is already allocated to an unrelated entry in the migration ledger (which the fork had landed under another task). The fork keeps the allocated number and renumbers nothing. The ledger row for this collision is deliberately left to a separate bookkeeping change that has to be asked for, so nothing under `backlog/docs/migration/` is touched here.

## Verification

- `bun test src/test/help-popup.test.ts` - 8 pass / 0 fail, 48 assertions.
- Neighbouring suites stay green: board-hide-empty-columns 14, tui-vim-boundary-navigation 5, tui-task-composer 13, tui-task-composer-unicode 2, tui-emoji-width 4, generic-list-selection 3, unicode-rendering 1, line-wrapping 7, tui-runtime-cwd 2, tui-window-title 12, tui-acceptance-criteria-progress 18 - all 0 fail.
- Discriminator checks, so the new assertions pin the fix rather than passing for free. Against the pre-change `help-popup.ts` four assertions go red: the popup keeps height 21 on a 12-row screen (expected 10), the wrapped case reports no Scroll hint, no resize listener is registered, and the clamp case gets 5 rows back for a 1-row screen. Reverting only the backdrop repositioning inside `createPopupChrome.reflow` separates the backdrop assertions from the rest: the backdrop keeps its 23-row height on a 12-row screen while the other seven cases stay green.
- `bunx tsc --noEmit` clean; `bun run check .` reports only the 3 pre-existing `assets.ts` warnings across 430 files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI help popup now lays itself out from the live terminal size and derives its scroll bound from what the renderer actually draws. On a shrink from 80x24 to 80x12 the popup reflows to height 10 instead of staying at 21 with a negative top, its border and help row stay inside the viewport, and the backdrop tracks the popup instead of staying at the geometry it was first drawn with - the gray band that used to hang seven rows below the popup is gone. The scroll bound is recomputed from the renderer's wrapped rows on every layout and the offset is clamped to it, so nothing is stranded, the footer hint flips with the measured overflow, and the resize listener is removed when the popup closes.

Verified with 8 focused tests (3 of them driving a real screen) and 48 assertions, with every new assertion checked against the pre-change code and against a backdrop-repositioning rollback so they fail where they should. The eleven neighbouring TUI suites stay green, `bunx tsc --noEmit` is clean, and `bun run check .` reports only the 3 pre-existing `assets.ts` warnings.
<!-- SECTION:FINAL_SUMMARY:END -->

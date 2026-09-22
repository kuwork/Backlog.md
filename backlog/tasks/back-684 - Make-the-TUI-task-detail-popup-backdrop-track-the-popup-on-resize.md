---
id: BACK-684
title: Make the TUI task detail popup backdrop track the popup on resize
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-21 23:09'
updated_date: '2026-09-22 00:17'
labels:
  - tui
dependencies: []
references:
  - src/ui/task-viewer-with-search.ts
  - src/ui/components/help-popup.ts
  - src/ui/components/filter-popup.ts
  - BACK-677
modified_files:
  - src/ui/task-viewer-with-search.ts
  - src/ui/components/filter-popup.ts
  - src/test/tui-task-detail-popup-resize.test.ts
ordinal: 259400
actual_start: '2026-09-21 23:32'
actual_end: '2026-09-22 00:17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the TUI board view, opening a task detail popup and then changing the terminal height leaves the background (backdrop) at the geometry it was first drawn with, producing a misplaced black band instead of a panel hugging the popup.

This is the same class of defect BACK-677 fixed for the help popup. The task detail popup is built in createTaskPopup (src/ui/task-viewer-with-search.ts:1639): the popup is centered with top/left "center" (resolved by the renderer at draw time), while the background box is placed with absolute coordinates computed once at creation (top = popup.top - 1, width = popup.width + 4, height = popup.height + 2). createTaskPopup registers no resize listener at all, so on a terminal resize the popup re-centers itself and the backdrop stays behind, exactly like the pre-fix help popup did (BACK-677 reproduced: popup moved to top -4 while the backdrop stayed at top 0, height 23 - a gray band seven rows below the popup).

Goal: lay the task detail popup and its backdrop out from the live terminal size on open and on every resize, so the backdrop always hugs the popup; clamp the popup size to the viewport; and drop the resize listener when the popup closes. BACK-677 (help-popup.ts, createPopupChrome.reflow) is the implementation reference for the fork's own patterns.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reproduce the defect against the current code by driving a real screen: open a task detail popup, shrink the terminal (e.g. 80x24 to 80x12), and confirm the backdrop no longer tracks the popup before the fix
- [x] #2 With the task detail popup open, a terminal resize reflows it: the popup stays fully on-screen with its border inside the viewport, including terminals shorter than the default 80% height
- [x] #3 The backdrop follows the popup across a resize: its top tracks the popup's top and its edges stay within one row/column of the popup's edges
- [x] #4 The resize listener is removed when the popup closes, so a later resize does not reach a destroyed popup
- [x] #5 Regression tests drive a real screen: resize an open task detail popup and assert the popup and backdrop positions, and the listener registration/removal across a close
- [x] #6 Popup behaviour is otherwise unchanged: the same header/body content, Esc/q/C-c close keys, and focus/blur border color switching
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In src/ui/task-viewer-with-search.ts (createTaskPopup): export resolveDimension/resolvePosition from filter-popup.ts and reuse them (blessed's percent/center resolution rules) instead of duplicating the math.
2. Add applyLayout() in createTaskPopup: compute popup width/height from the live screen size (85%/80%, height clamped to the terminal height), reset the popup's top/left/width/height, and recompute the backdrop's absolute geometry from the resolved popup position keeping the current offsets (top-1, left-2, +4/+2, clamped to the screen), then screen.render().
3. Register screen.on("resize", onResize) while the popup is open and removeListener it in closePopup before destroying; keep everything else unchanged (Esc/q/C-c close keys, focus/blur border colors, header/body content).
4. Add src/test/tui-task-detail-popup-resize.test.ts modeled on help-popup.test.ts's mutable fake screen: shrink 80x24 to 80x12 with the popup open and assert the popup stays fully on-screen and the backdrop tracks it; assert resize listener registration/removal across close and that a resize after close does not throw; keep close keys and focus/blur behavior pinned.
5. Discriminator check: run the new assertions against the pre-change code and confirm they fail (backdrop stays stale on resize), then implement the fix and watch them pass.
6. Run the scoped test, neighbouring TUI suites that use createTaskPopup (tui-final-summary, tui-definition-of-done, tui-documentation) plus help-popup, bunx tsc --noEmit, and bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed

- src/ui/task-viewer-with-search.ts - createTaskPopup now lays its backdrop out from the live terminal size. The old backdrop geometry was computed once at creation from Number(popup.top) with popup.top === "center", and no resize listener existed at all, so on a terminal resize the popup re-centered itself while the black backdrop kept its stale coordinates. The backdrop is now created with placeholder geometry and an applyLayout() pass (shared resolveDimension/resolvePosition helpers exported from filter-popup.ts) recomputes it from the current screen size on open and on every resize: top = max(0, popupTop - 1), left = max(0, popupLeft - 2), width = min(screenWidth, popupWidth + 4), height = min(screenHeight, popupHeight + 2), keeping the fork's existing backdrop offsets. screen.on("resize", onResize) is registered while the popup is open and removeListener'd in closePopup before destroying. Everything else (header/body content, Esc/q/C-c close keys, focus/blur border colors) is untouched.
- src/ui/components/filter-popup.ts - resolveDimension and resolvePosition are now exported so the task detail popup reuses the same percent/center resolution rules instead of duplicating them.
- src/test/tui-task-detail-popup-resize.test.ts - three real-screen cases drive a mutable 80x24 screen: a shrink to 80x12 and a grow back assert the backdrop geometry and that the popup stays fully on-screen; the resize listener's registration and removal across a close, with a resize after close not throwing; the unchanged close keys and focus/blur border switching.

## Verification

- bun test src/test/tui-task-detail-popup-resize.test.ts - 3 pass / 0 fail, 25 assertions.
- Discriminator check: with the source changes stashed (pre-change code), the two resize tests fail (backdrop keeps its initial geometry at 80x12, and no resize listener is ever registered) while the close-keys/border test stays green, so the new assertions pin the fix.
- Neighbouring suites stay green: tui-documentation 1, tui-definition-of-done 1, tui-final-summary 1, help-popup 8 - all 0 fail (15 tests total, 86 assertions).
- bunx tsc --noEmit clean; bun run check . reports only the 3 pre-existing assets.ts warnings.

Full-suite run: bun test reports 2834 tests with 24 fail / 18 errors, all pre-existing and unrelated - tmp/ orphan scratch tests with unresolvable relative imports, plus section-marker-safety, mcp-server and cli-json-output failures that reproduce identically with the change stashed. Every TUI suite and the new resize tests pass; tsc and biome are clean apart from the 3 pre-existing assets.ts warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI task detail popup's backdrop now tracks the popup across terminal resizes. createTaskPopup previously computed the black backdrop's absolute geometry once at creation (from Number(popup.top) while top was still the string "center") and registered no resize listener at all, so changing the terminal height re-centered the popup while the backdrop stayed at its stale coordinates - the same defect class BACK-677 fixed for the help popup.

Changes:
- src/ui/task-viewer-with-search.ts - the backdrop is created with placeholder geometry and an applyLayout() pass recomputes it from the live screen size on open and on every resize (top = max(0, popupTop - 1), left = max(0, popupLeft - 2), width/height = popup size +4/+2 clamped to the screen), reusing the shared percent/center resolution helpers. screen.on("resize") is registered while open and removed in the close path. Close keys, focus/blur border colors and content are unchanged.
- src/ui/components/filter-popup.ts - resolveDimension/resolvePosition exported for reuse.
- src/test/tui-task-detail-popup-resize.test.ts - real-screen tests: 80x24 to 80x12 shrink and grow-back assert the backdrop geometry and on-screen popup bounds; resize listener registration/removal across close; close keys and border switching pinned.

Verification:
- bun test src/test/tui-task-detail-popup-resize.test.ts - 3 pass / 0 fail, 25 assertions; the two resize tests fail against the pre-change code (discriminator checked via git stash).
- Neighbouring suites green: tui-documentation, tui-definition-of-done, tui-final-summary, help-popup (15 tests, 86 assertions).
- bunx tsc --noEmit clean; bun run check . shows only the 3 pre-existing assets.ts warnings.
- Full bun test: the 24 failures / 18 errors are pre-existing (tmp/ orphan tests plus section-marker/mcp/cli-json failures that reproduce with the change stashed) and unrelated to this change.
<!-- SECTION:FINAL_SUMMARY:END -->

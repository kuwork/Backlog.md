---
title: BACK-684 Make the TUI task detail popup backdrop track the popup on resize
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - tui
source_path: backlog/tasks/back-684 - Make-the-TUI-task-detail-popup-backdrop-track-the-popup-on-resize.md
---

# BACK-684 Make the TUI task detail popup backdrop track the popup on resize

Same defect class as BACK-677, one surface over: `createTaskPopup` computed the backdrop's absolute geometry once at creation (from `Number(popup.top)` while `top` was still the string `"center"`) and registered no resize listener, so a terminal resize re-centered the popup while the black backdrop stayed at stale coordinates. Note: there is also an unrelated web-board sort change that was folded *into* BACK-682's record; this task file is the TUI popup one.

## Summary

- `src/ui/task-viewer-with-search.ts`: backdrop created with placeholder geometry; an `applyLayout()` pass recomputes it from the live screen size on open and on every resize — `top = max(0, popupTop - 1)`, `left = max(0, popupLeft - 2)`, width/height = popup size +4/+2 clamped to the screen — keeping the fork's existing backdrop offsets
- `screen.on("resize", onResize)` registered while open and removed in `closePopup` before destroy; close keys (`Esc/q/C-c`), focus/blur border colors, and header/body content untouched
- `src/ui/components/filter-popup.ts`: `resolveDimension` / `resolvePosition` exported so the popup reuses blessed's percent/center resolution rules instead of duplicating the math
- New `src/test/tui-task-detail-popup-resize.test.ts`: 3 real-screen cases / 25 assertions — 80x24→80x12 shrink and grow-back assert backdrop geometry and on-screen bounds, listener registration/removal across close, and a resize after close not throwing
- Discriminator check via `git stash`: the two resize tests fail against pre-change code (stale backdrop, no listener ever registered) while the close-keys/border test stays green
- Neighbouring suites green (tui-documentation, tui-definition-of-done, tui-final-summary, help-popup — 15 tests / 86 assertions); full `bun test` failures are pre-existing tmp/ orphans and unrelated suites

## Acceptance Criteria

- With the popup open, a resize reflows it fully on-screen including terminals shorter than the default 80% height
- Backdrop top tracks the popup's top, edges within one row/column of the popup's edges
- Resize listener removed on close; a later resize never reaches a destroyed popup
- Regression tests drive a real screen; popup content, close keys, and border-color switching unchanged

## Related Concepts

- [[concepts/cli-tui]] — blessed popup geometry and resize handling

## Related Sources

- [[sources/back-677-help-popup-resize-robustness]] — the implementation reference whose `createPopupChrome.reflow` pattern this follows
- [[sources/back-678-composer-extreme-terminal-sizes]] — same wave of live-size popup layout fixes
- [[sources/back-682-web-positional-batch-drop]] — the web sort stand-down change from a different task was folded into this record number's web sibling; cross-reference to avoid confusion

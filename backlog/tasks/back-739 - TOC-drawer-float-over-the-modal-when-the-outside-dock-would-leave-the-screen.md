---
id: BACK-739
title: 'TOC drawer: float over the modal when the outside dock would leave the screen'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 23:01'
updated_date: '2026-10-02 00:13'
labels:
  - web-ui
dependencies:
  - BACK-726
references:
  - 'src/web/components/TocDrawer.tsx:80'
  - 'src/web/components/TocDrawer.tsx:68'
  - 'src/web/components/Modal.tsx:85'
ordinal: 309400
actual_start: '2026-10-01 23:05'
actual_end: '2026-10-02 00:13'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-726's modal outline drawer docks outside the panel's left edge (sm:right-full in TocDrawer.tsx). When the browser window is narrow the modal panel is nearly full-width, so both the bookmark tab (-translate-x-full) and the 18rem drawer render off the left edge of the screen.

Fix (agreed approach): measure the gap between the panel's left edge and the viewport left edge (live, on mount and resize). If the docked drawer would not fit, open the outline as a floating panel ON TOP of the modal content, aligned to the panel's left edge. In floating mode: the close button is not shown; selecting an outline entry closes the drawer (docked mode keeps it open); the drawer keeps rounded corners on both sides and slides in with a short animation; the rest of the modal is dimmed by a backdrop whose click also closes the drawer. The bookmark tab gets the same treatment: when the outside gap is too small it moves inside the panel's left edge so the entry point stays reachable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With a wide window the drawer keeps docking outside the panel's left edge exactly as today
- [x] #2 When the panel's left gap is smaller than the docked drawer width, clicking the bookmark opens the outline as a floating overlay aligned to the panel's left edge, on top of the content
- [x] #3 In floating mode the close button is not rendered and selecting any outline entry closes the drawer; in docked mode the close button and keep-open selection behavior are unchanged
- [x] #4 The bookmark tab stays on screen in narrow windows (moves inside the panel edge when there is no room outside)
- [x] #5 Existing TOC tests keep passing; new tests cover the mode switch
- [x] #6 In floating mode the rest of the modal is dimmed by a backdrop, and clicking the dimmed area closes the drawer (docked mode has no backdrop)
- [x] #7 The floating drawer keeps rounded corners on both sides and slides in from the left with a short animation
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TocDrawer.tsx: track the panel's left gap (containerRef.current.getBoundingClientRect().left) in state, measured on mount and on window resize. Two thresholds: DOCK (~300px) for the drawer, TAB (~36px) for the bookmark tab.
2. Drawer mode derived from the gap: gap >= DOCK -> docked (current behavior unchanged); gap < DOCK -> floating: absolute inset-y-0 left-0 w-72 max-w-full rounded-lg over the content, aligned to the panel's left edge, with a slide-in animation (animate-toc-drawer-slide-in) and a dimming backdrop behind it (data-toc-backdrop, fade-in) whose click closes the drawer. Mark the nav with data-toc-mode for tests.
3. Floating-mode behavior per the agreed spec: no close button; clicking any outline entry runs the normal select (scroll/tab-switch) and then closes the drawer; clicking the dimmed backdrop also closes. Fold/expand controls stay. Docked mode is byte-for-byte the current behavior.
4. Bookmark tab: gap < TAB -> render inside the panel's left edge (drop -translate-x-full, switch to rounded-r-md) so the entry point stays on screen; otherwise unchanged. Mark with data-toc-tab for tests.
5. Animations live in source.css next to the existing slide-in keyframes.
6. Tests (src/test/web-toc-drawer.test.tsx): stub getBoundingClientRect left at 500 in the default harness and 8 for floating cases - mode marker, no close button, entry click scrolls AND closes, backdrop click closes, no backdrop in docked mode, tab moves inside. web-task-toc.test.tsx stubs move to left: 500 so its cases keep exercising docked mode.
7. Verify: bun test (scoped TOC suites, then the full suite), bunx tsc --noEmit, bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the two-mode drawer: useLeftGap tracks the panel's left gap on mount + resize; gap < 300px -> floating overlay (inset-y-0 left-0 over the content, no close button, entry click closes), gap < 36px -> bookmark tab moves inside the panel edge. Docked mode unchanged. data-toc-mode / data-toc-tab markers added for tests.
Test ripple: web-task-toc.test.tsx stubbed getBoundingClientRect with left: 0, which now forces floating mode; switched its installElementRects to left: 500 (docked) and installed the same stub in the sectioned-outline describe. The narrow-window class-fallback test still asserts the docked classes, which now only appear with a wide gap.

Review iteration on the floating mode: the panel now keeps rounded corners on both sides (rounded-lg), slides in from the left (animate-toc-drawer-slide-in, 150ms), and the rest of the modal dims behind a backdrop (bg-black/30, fade-in) whose click closes the drawer. Backdrop is a real button marked data-toc-backdrop to stay keyboard-reachable and distinguishable from the modal's own close button in tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TOC drawer now floats over the modal when the outside dock would leave the screen.

Changes:
- src/web/components/TocDrawer.tsx: useLeftGap tracks the panel's left gap on mount and resize. Gap >= 300px -> docked outside the left edge exactly as before; gap < 300px -> floating overlay on top of the content, aligned to the panel's left edge, rounded on both sides, sliding in with animate-toc-drawer-slide-in. Floating mode renders no close button: picking an entry closes the drawer, and the rest of the modal is dimmed by a backdrop (data-toc-backdrop, fade-in) whose click also closes. Gap < 36px moves the bookmark tab inside the panel edge. data-toc-mode / data-toc-tab markers added for tests.
- src/web/styles/source.css: toc-drawer-slide-in and toc-backdrop-fade-in keyframes next to the existing slide-in animations.
- Tests: web-toc-drawer.test.tsx gains 6 cases (mode marker, no close button, entry click closes, backdrop click closes, no backdrop when docked, tab inside); web-task-toc.test.tsx rect stubs move to left: 500 so its cases keep exercising docked mode.

Verification (per-file, the mode this repo documents - a monolithic bun test has known false failures on this machine):
- bun test web-toc-drawer / web-task-toc / web-toc / web-modal-backdrop -> 48 pass / 0 fail
- bunx tsc --noEmit -> clean
- bun run check . -> no errors
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-748
title: 'Fix sidebar resize handle collapsed by hr preflight height:0'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-06 06:08'
updated_date: '2026-10-06 06:09'
labels:
  - bug
  - web-ui
dependencies:
  - BACK-723
modified_files:
  - src/web/components/SideNavigation.tsx
priority: high
ordinal: 314400
actual_start: '2026-10-06 05:30'
actual_end: '2026-10-06 05:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hovering the right edge of the web sidebar no longer shows the blue drag bar, so the sidebar width cannot be resized. Root cause: BACK-723's semantic-tag refactor turned the resize handle <div> into <hr> with border-0; Tailwind v4 preflight ships hr{...height:0} (element selector), which defeats the top-0 bottom-0 stretch because abs-pos stretch only applies when height is auto. The handle collapsed to a 4px-wide, 0-height sliver. Fix: add h-full (class beats element-selector height:0) plus aria-orientation=vertical. Verified live: handle 4x569, hit test correct, synthetic drag 320->435 persists to localStorage; tsc/biome clean; 22 SideNavigation tests pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hovering the sidebar right edge renders the blue drag bar at full sidebar height
- [x] #2 Dragging the handle resizes the sidebar and persists the width to localStorage
- [x] #3 tsc --noEmit and biome report no issues for the changed file
- [x] #4 Existing SideNavigation test suites still pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce in a real browser and measure the handle box/hit target
2. Trace the regression to the div->hr change in BACK-723 and the preflight hr{height:0} rule
3. Fix with h-full + aria-orientation and re-verify hover and drag end to end
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence chain (agent-browser against local server): handle rect 4x0 at y=0; elementFromPoint falls through to the nav; parent sidebar 569px tall; .bottom-0 rule present in the served bundle; preflight rule hr{color:inherit;border-top-width:1px;height:0} found in bundle CSS. Only one <hr> exists in web components, introduced by b64470c9 (BACK-723).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added h-full and aria-orientation=vertical to the hr handle in src/web/components/SideNavigation.tsx (with a comment explaining why h-full is required). After restarting the server (Bun bundles web assets at process start) the handle measures 4x569 with col-resize cursor; a timed synthetic mouse drag resized 320->435px and persisted to localStorage (restored to 320 afterwards). tsc/biome clean; web-side-navigation-* suites 22 pass / 0 fail. Change left uncommitted for the user to commit, per convention.
<!-- SECTION:FINAL_SUMMARY:END -->

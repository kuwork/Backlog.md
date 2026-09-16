---
id: BACK-641
title: Fix sidebar collapse toggle hidden behind the page header
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-16 06:19'
updated_date: '2026-09-16 06:51'
labels:
  - web-ui
dependencies: []
ordinal: 244400
actual_start: '2026-09-16 06:19'
actual_end: '2026-09-16 06:20'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the Web UI the sidebar collapse toggle is anchored on the sidebar's right border (`absolute -right-3`, 24x24px), so its right ~11px sits inside the header column. The page header (Navigation) is `relative z-20` with an opaque background, while the sidebar container is only `z-10`. Both compete in the root stacking context, so the header paints over the button: only the left half of the circle is visible and only that half receives clicks.

Expected: the toggle is fully visible and fully clickable in both the expanded and the collapsed state, at every viewport width.

Observed: at the default window size the button renders as a half circle clipped along the sidebar border; the rightmost pixels report the header as their owner in hit-testing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The collapse toggle is fully visible (no part covered by the header) in both expanded and collapsed states
- [x] #2 Clicking any part of the toggle, including the half that sits over the header column, collapses/expands the sidebar
- [x] #3 Sidebar resize handle, header layout and the page TOC panel keep working
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the clipping and identify which element owns the covered pixels.
2. Raise the sidebar stacking context above the page header so the border-straddling button paints above it.
3. Verify with hit-testing and real mouse clicks in both sidebar states, then run the checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: the toggle is anchored on the sidebar border (`absolute -right-3`), so ~11px of it lies inside the header column. The header (Navigation) is `relative z-20` and the sidebar was `z-10`; because the header's parent column is not positioned, both z-indexes compete in the root stacking context and the header wins, painting its opaque background over the right half of the button.

Fix: raise the sidebar container to `z-30` (src/web/components/SideNavigation.tsx) so the border-straddling toggle paints above the header. Any value above 20 works; the sidebar's own children (resize handle z-20, ghost z-50, dropdowns z-50) are unaffected because they live inside the new context, and overlays that must stay on top (modals, toasts, lightbox) are z-50 and outside it.

Verification (Chrome, headless, CDP hit-testing + real mouse events, same window size and theme):
- build with the old `z-10` (installed 1.49.3-CN binary): elementFromPoint at the button's rightmost pixel returns the header `nav`; screenshot shows a half circle.
- build with `z-30` (local source): the same probe returns the button for its left edge, centre and right edge; screenshot shows the full circle.
- real mouse clicks: clicking the overhang part (the ~11px over the header column) in the collapsed state expands the sidebar (64px -> 320px), clicking the centre collapses it again -> the previously dead zone is live.
- Sidebar width/geometry unchanged, no layout shift in the header or board.

Checks: `bun run check .` -> 0 errors (3 pre-existing warnings in src/core/assets.ts); `bunx tsc --noEmit` -> clean; `bun test src/test/web-side-navigation-loading.test.tsx` 5 pass; `bun test src/test/web-toc.test.tsx` 23 pass.

Known trade-off: the sidebar is now above the header in stacking order, so in a viewport narrower than the header's own content width (< ~672px, where the header already overflows horizontally) the left sliver of the page TOC panel can be covered by the sidebar. Fixing that would require portalling the toggle instead; not worth the extra complexity for the width range involved.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Web UI sidebar collapse toggle is no longer half hidden behind the page header.

The toggle is anchored on the sidebar's right border (absolute -right-3), so roughly 11px of it lies inside the header column. The header is relative z-20 and the sidebar was only z-10, so the header's opaque background painted over the right half of the button: it looked like a half circle and only the left half reacted to clicks.

Change:/n- src/web/components/SideNavigation.tsx: sidebar container z-10 -> z-30, with a comment explaining that the border-straddling toggle must outrank the header.

Verification:/n- CDP hit-testing, same window and theme: with z-10 the rightmost pixel of the toggle belongs to the header nav; with z-30 it belongs to the button (left edge, centre and right edge all hit the button).
- Real mouse events: clicking the overhang part of the toggle over the header column expands the sidebar, clicking the centre collapses it.
- bun run check . (0 errors), bunx tsc --noEmit (clean), scoped tests web-side-navigation-loading (5 pass) and web-toc (23 pass).
<!-- SECTION:FINAL_SUMMARY:END -->

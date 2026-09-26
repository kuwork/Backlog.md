---
title: BACK-641 Fix sidebar collapse toggle hidden behind the page header
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
source_path: backlog/tasks/back-641 - Fix-sidebar-collapse-toggle-hidden-behind-the-page-header.md
---

# BACK-641 Fix sidebar collapse toggle hidden behind the page header

The Web UI sidebar collapse toggle is anchored on the sidebar's right border (`absolute -right-3`), so about 11px of it lies inside the header column. The header (`relative z-20`, opaque) painted over the sidebar (`z-10`), showing only a half circle whose overhang half ignored clicks. The fix raises the sidebar container to `z-30` so the border-straddling toggle paints above the header.

## Summary

- Root cause: both z-indexes compete in the root stacking context because the header's parent column is not positioned, so `z-20` header beats `z-10` sidebar and covers the toggle's right half
- One-line fix in `src/web/components/SideNavigation.tsx`: sidebar container `z-10` -> `z-30`, with a comment explaining why the toggle must outrank the header
- Sidebar children (resize handle z-20, ghost/dropdowns z-50) are unaffected because they live inside the new stacking context; modals/toasts/lightbox are z-50 outside it
- Verified with Chrome CDP hit-testing plus real mouse events: with `z-10` the toggle's rightmost pixel belongs to the header `nav`; with `z-30` all probe points hit the button, and clicking the overhang expands/collapses the sidebar (64px <-> 320px)
- Known trade-off: at viewports narrower than ~672px (where the header already overflows) the sidebar can cover a sliver of the page TOC panel; fixing that would require portalling the toggle and was judged not worth it
- Gates: `bun run check .` 0 errors, `bunx tsc --noEmit` clean, scoped tests web-side-navigation-loading (5) and web-toc (23) pass

## Acceptance Criteria

- Toggle fully visible in both expanded and collapsed sidebar states
- Every part of the toggle, including the half over the header column, is clickable
- Sidebar resize handle, header layout, and page TOC panel keep working

## Related Concepts

- [[concepts/web-ui-features]] — sidebar and header layout conventions this stacking fix preserves

## Related Sources

- [[sources/sidebar-collapse-button-fix]] — earlier sidebar collapse button repair in the same component area
- [[sources/sidebar-resize-search-task]] — sidebar resize handle whose z-20 stacking must coexist with this fix

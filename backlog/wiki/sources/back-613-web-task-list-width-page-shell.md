---
title: BACK-613 Make the web task list fit without horizontal scroll and trim page padding
created_date: '2026-09-06 21:26'
updated_date: '2026-09-06 21:26'
labels:
  - source
  - web-ui
source_path: backlog/tasks/back-613 - Make-the-web-task-list-fit-without-horizontal-scroll-and-trim-page-padding.md
---

# BACK-613 Make the web task list fit without horizontal scroll and trim page padding

The web task list table was always wider than its content area: the colgroup fixed all eight column widths (summing to 91rem, so 1456px under table-layout:fixed regardless of viewport), and every page root used Tailwind's viewport-breakpoint `container mx-auto px-4 py-8`, leaving a wide gutter when the sidebar was collapsed. Three measured layout fixes — a single column-width source, a shared full-width `.page-shell`, and a filter row that no longer reserves invisible space — remove document-level horizontal overflow at laptop and desktop viewports.

## Summary

- `src/web/components/TaskList.tsx`: single width source `TASK_COLUMN_WIDTHS_REM` (8 columns, Title the only flexible column); derived table min-width 59.5rem replaces the hardcoded `min-w-[1100px]`; `renderColumnGroup` reads the constant
- 'Clear filters' renders only when filters are active instead of the `visibility:hidden` placeholder (~112px reclaimed); priority select min-width relaxed 140→120px
- `src/web/styles/source.css`: shared `.page-shell` (width 100%, padding 1.5rem 1rem) replaces the Tailwind container at 7 page-root sites (TaskList, BoardPage, DraftsList, MilestonesPage, Settings x3)
- Themed scrollbars added base-layer: `scrollbar-color` with transparent track + thin theme-matched thumb (light 0.22 / dark 0.2), `scrollbar-width: thin` on every element, webkit fallbacks; `.scrollbar-hide` still computes `scrollbar-width: none`
- `src/web/components/Modal.tsx:48`: shared modal surface gained `border-gray-200 dark:border-gray-600` so it reads against the dark backdrop
- Verification: full Chromium matrix (1440x900, 1512x982 x sidebar 320/collapsed/500px; 1920x1080, 1920x1200, 3840x2160 at 100%/150% scaling) — document overflow 0 in all states; before/after screenshots in `backlog/assets/images/back-613/`; jsdom invariant test `src/test/web-task-list-table-width.test.tsx`

## Acceptance Criteria

- No horizontal scrollbar at 1440x900 and 1512x982 with sidebar collapsed/expanded; at 500px sidebar the table scrolls inside its own container with no document-level overflow
- Page roots use a shared full-width page shell; gutter visibly reduced
- No columns removed or hidden; Title is the single flexible column
- All scrollbars use the subtle themed style in both color themes; modal visually distinguishable via border/shadow
- Filter controls stay on one row whenever they genuinely fit; Clear filters renders only when filters are active
- Regression test pins the layout invariants checkable without a browser

## Related Concepts

- [[concepts/web-ui-features]] — task list layout, sidebar states, and filter row behavior
- [[concepts/web-server]] — the web surface whose layout invariants were pinned

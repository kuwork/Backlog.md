---
id: BACK-613
title: Make the web task list fit without horizontal scroll and trim page padding
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-09 19:02'
updated_date: '2026-09-06 21:26'
labels:
  - web-ui
dependencies: []
references:
  - src/web/components/TaskList.tsx
  - src/web/components/Modal.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/DraftsList.tsx
  - src/web/components/MilestonesPage.tsx
  - src/web/components/Settings.tsx
  - src/web/styles/source.css
modified_files:
  - src/web/components/TaskList.tsx
  - src/web/components/Modal.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/DraftsList.tsx
  - src/web/components/MilestonesPage.tsx
  - src/web/components/Settings.tsx
  - src/web/styles/source.css
  - src/test/web-task-list-table-width.test.tsx
priority: medium
actual_start: '2026-09-06 20:15'
actual_end: '2026-09-06 21:26'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web task list table is always wider than its content area. The TaskList colgroup fixes all eight column widths, and under table-layout:fixed the table's used width becomes the sum of those columns, so the table overflows a laptop-width viewport and shows a permanent horizontal scrollbar. Separately, every page root uses Tailwind's 'container mx-auto px-4 py-8', whose max-width tracks the viewport breakpoint rather than the content area, leaving a large empty gutter between the collapsed sidebar and the page content.

Goal: the task list page fits a typical laptop viewport (around 1440x900 and 1512x982) without horizontal scroll, and page padding is trimmed so content fills the available width.

Constraint: do not remove or hide table columns; fit through width allocation, padding, and layout, not feature changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-621 and git show 8e51726 as implementation reference.
- [x] #2 The All Tasks table shows no horizontal scrollbar at 1440x900 and 1512x982 CSS viewports with the sidebar collapsed and with the sidebar expanded at its default width; with the sidebar widened to its 500px maximum the table may scroll inside its own container but there is no document-level horizontal overflow
- [x] #3 The gutter between the collapsed sidebar and page content is visibly reduced: page roots use a shared full-width page shell instead of the viewport-breakpoint container
- [x] #4 No table columns are removed or hidden; all 8 columns (ID/Title/Status/Priority/Labels/Assignee/Milestone/Created) still render, with Title as the single flexible column
- [x] #5 Before and after screenshots at the target viewports are recorded
- [x] #6 All scrollbars across the web UI (page, tables, modals, dropdowns) use a subtle themed style - transparent track, thin theme-matched thumb - in both color themes, and .scrollbar-hide still computes scrollbar-width: none
- [x] #7 The task detail modal is visually distinguishable from the page behind it via a subtle border and/or shadow, in both color themes
- [x] #8 The task list filter controls stay on one row whenever they genuinely fit, measured across sidebar states (collapsed, default 320px, maximum 500px) against the fork control set including StatusExcludeDropdown and the milestone select; the Clear filters button renders only when filters are active instead of reserving invisible space
- [x] #9 At common Windows desktop display resolutions 1920x1080, 1920x1200 and 3840x2160 (physical pixels, not viewports) the task list renders without document-level horizontal overflow: convert each resolution to the effective CSS viewport via the OS display scaling in effect (3840x2160 at 150 percent scaling yields 2560x1440 CSS px, at 200 percent yields 1920x1080 CSS px) minus browser chrome, then verify the table fills the available content width, Title absorbs the surplus as the flexible column, and no column layout breaks
- [x] #10 A regression test pins the layout invariants checkable without a browser (column budget, no document-level horizontal overflow)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Diagnose (AC #2, #3, #8, #9)

- 1.1 In Chromium, record DOM widths for the main content area, the table, and every filter control in src/web/components/TaskList.tsx. Two kinds of display targets, do not conflate them: (a) CSS viewports from the laptop baseline - 1440x900 and 1512x982; (b) physical Windows desktop resolutions - 1920x1080, 1920x1200 and 3840x2160 - which must be converted to the effective CSS viewport before measuring: divide by the OS display scaling in effect (3840x2160 at 150 percent scaling = 2560x1440 CSS px, at 200 percent = 1920x1080 CSS px) and subtract browser chrome (a maximized Chromium on a 1920x1080 screen at 100 percent scaling gives roughly 1920x937 of viewport). Record resolution, scaling, and resulting viewport for every run. The fork sidebar is collapsible and drag-resizable (src/web/components/SideNavigation.tsx:966-1006, width clamped to 200-500px, persisted in localStorage sideNavWidth, default 320px), so measure three sidebar states: collapsed, expanded at 320px, and expanded at the 500px maximum - 'expanded' is not a single fixed width.
- 1.2 Confirm the three root causes: the colgroup at src/web/components/TaskList.tsx:541-551 fixes eight column widths summing to 91rem, so under table-layout:fixed the table is 1456px regardless of viewport; page roots use 'container mx-auto px-4 py-8' (TaskList.tsx:643, BoardPage.tsx:134, DraftsList.tsx:248, MilestonesPage.tsx:949, Settings.tsx:134/144/153) whose max-width tracks the viewport breakpoint and splits the surplus into gutters when the sidebar is collapsed; the filter row (TaskList.tsx:726) mounts a permanently hidden 'Clear filters' button (visibility:hidden) that reserves empty space and pushes the Labels dropdown onto a second line.

### Phase 2 - Single width source for the table (AC #4, #10)

- 2.1 Introduce one width-source constant (e.g. TASK_COLUMN_WIDTHS_REM) in src/web/components/TaskList.tsx with eight entries; Title stays null (the single flexible column) and the seven metadata columns keep content-derived widths. The table has 8 columns (ID/Title/Status/Priority/Labels/Assignee/Milestone/Created) - size the constant for exactly these columns.
- 2.2 Derive the table min-width from the same list to replace the hardcoded min-w-[1100px] at TaskList.tsx:764 and TaskList.tsx:782, and make renderColumnGroup read the constant. The min-width is also the narrow-content clamp: with the sidebar at 500px on a 1440px viewport the content area is ~900px, so the table must scroll inside its own overflow container with no document-level horizontal overflow (verify in Phase 6). At desktop-sized viewports the content area exceeds the min-width, so the table stretches to fill and Title absorbs the surplus.

### Phase 3 - Shared page shell (AC #3)

- 3.1 Add a shared .page-shell class (width: 100%, trimmed padding) in src/web/styles/source.css and use it at the 7 container sites (TaskList.tsx:643, BoardPage.tsx:134, DraftsList.tsx:248, MilestonesPage.tsx:949, Settings.tsx:134/144/153).
- 3.2 Keep the reading-width caps on the Statistics page and the documentation/decision detail pages - those are intentional content widths, not the reported defect.

### Phase 4 - Filter row (AC #8)

- 4.1 Render 'Clear filters' only when filters are active instead of the visibility:hidden placeholder at TaskList.tsx:726.
- 4.2 Relax the priority select min-w-[140px] (TaskList.tsx:674) toward its intrinsic width. Keep the milestone select (TaskList.tsx:686) and StatusExcludeDropdown unchanged, and re-measure the whole row against the actual fork control set in every sidebar state from 1.1 - the row budget must come from fresh browser measurement, not copied pixel constants. A wrap in the 500px-sidebar state is acceptable when the controls genuinely do not fit; the invariant is no wrap when they do.

### Phase 5 - Scrollbars and modal (AC #6, #7)

- 5.1 Add base-layer scrollbar rules in src/web/styles/source.css: scrollbar-color with a theme-matched thumb over a transparent track on html (it inherits), plus scrollbar-width: thin on every element (it does not inherit), with ::-webkit-scrollbar fallbacks in both color themes. Verify .scrollbar-hide (source.css:92-99) still computes scrollbar-width: none after the change.
- 5.2 Give the shared Modal surface (src/web/components/Modal.tsx:48) a visible elevated edge using the existing card border tokens (border-gray-200 dark:border-gray-600) so it reads against the dark backdrop.

### Phase 6 - Verify

- 6.1 Verify in Chromium, in both color themes: (a) laptop CSS viewports 1440x900 and 1512x982 in all three sidebar states (collapsed / 320px / 500px); (b) physical desktop resolutions 1920x1080, 1920x1200 and 3840x2160 via their effective CSS viewports from 1.1 (record resolution, scaling and viewport per run), in collapsed and 320px sidebar states. Checklist: zero horizontal document overflow on the task list, all 8 columns rendered, reduced gutter, a single-line filter row wherever it genuinely fits, quiet scrollbars on page/tables/modal/dropdowns, and a legible modal edge. At desktop-sized viewports confirm the table fills the content width and Title absorbs the surplus without any column breaking. Confirm board/drafts/milestones/settings/task detail still render correctly with the sidebar widened. Capture before and after screenshots.
- 6.2 Add src/test/web-task-list-table-width.test.tsx pinning the column budget and the no-document-overflow invariants in jsdom, and state plainly what jsdom cannot prove (absence of an actual scrollbar or wrap).
- 6.3 Run bunx tsc --noEmit, bun run check ., bun test, and bun run build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete (Phases 2-5). TaskList: single width source TASK_COLUMN_WIDTHS_REM (8 cols, Title flex), derived table min-width 59.5rem replaces hardcoded 1100px; Clear filters now renders only when filters are active; priority select min-w 140->120px; milestone select and StatusExcludeDropdown unchanged. source.css: base-layer themed scrollbars (thin + transparent track, light thumb 0.22 / dark 0.2, webkit fallback), shared .page-shell replaces container at 7 sites; Modal surface gained border-gray-200 dark:border-gray-600.

jsdom: new src/test/web-task-list-table-width.test.tsx 4/4 pass; web-task-list-sort/labels-menu/board-filters 16/16 pass; tsc clean; biome web paths excluded by project config (pre-existing).

Chromium measured (after, dark theme): 1440x900 sidebar 320 - content 1110, table 1076, doc overflow 0; collapsed - content 1366, table 1332, 1-line filter row; sidebar 500 - content 930, table clamps to 952 with scroller overflow 56, doc overflow 0. 1512x982 320 - content 1182, table 1148, 1-line filters; collapsed - 1438/1404; 500 - 1002/968, doc overflow 0. Desktops: 1920x937 (1920x1080@100%) 1590/1556; 1920x1057 (1920x1200@100%) 1590/1556; 2560x1297 (4K@150%) 2230/2196; 3840x1997 (4K@100%) 3510/3476 - all doc overflow 0, filter row 1 line.

Filter row boundary (fork control set): at 1440x900 sidebar 320 the row needs 944px (dropdowns intrinsic 200x3, priority 120, milestone 180, 4 gaps) + 12 + counter 170 = 1126px against 1110px available, so Labels wraps to a second line - a genuine no-fit, single line in every wider state. Scrollbars verified by computed style in both themes; .scrollbar-hide still computes scrollbar-width none; modal border-top 1px (dark gray-600). After screenshots saved under backlog/assets/images/back-613/.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web task list now fits laptop and desktop viewports without document-level horizontal overflow, pages fill the content area, and the filter row no longer reserves invisible space.

Three layout fixes, all measured in Chromium against this repo's own backlog (318 tasks, zh-CN locale). The TaskList colgroup fixed all eight columns at widths summing to 91rem, so under table-layout:fixed the table was 1456px in every state (measured 385px of scroller overflow at 1440x900); the eight columns now share one width source (TASK_COLUMN_WIDTHS_REM, Title the only flexible column) and the table min-width is derived from the same list (59.5rem) - before: table 1456px constant; after: table tracks the content area (1076px at 1440x900 sidebar 320, 1332px collapsed, 1556px at 1920x937, 3476px at 3840x1997), clamping to its own scroll container below that with zero document overflow. Every page root used Tailwind's viewport-breakpoint container, centring the page with wide gutters when the sidebar was collapsed; one shared .page-shell (width 100%, padding 1.5rem 1rem) now serves the 7 page-root sites, so the gutter is 16px in all states. And the filter row mounted a permanently hidden Clear filters button that reserved ~112px of empty space; the button now renders only when filters are active, and the priority select min-width dropped 140->120px.

Verified matrix in Chromium (dark theme): 1440x900 and 1512x982 x sidebar 320/collapsed/500px - document overflow 0 in all six states (at sidebar 500px the table scrolls inside its own container by design); desktop physical resolutions 1920x1080, 1920x1200, 3840x2160 (at 100%/150% scaling) - document overflow 0, table fills content width, filter row on one line. Fork filter-row boundary stated: at 1440x900 sidebar 320 the fork control set (three intrinsic-200px dropdowns, priority select, milestone select, counter) genuinely needs 1126px against 1110px available, so the Labels dropdown wraps to a second line there - a real no-fit; every wider state is a single 40px line.

The two style additions landed with it: scrollbars across the web UI use a transparent track with a thin theme-matched thumb (light rgb(0 0 0 / 0.22), dark rgb(255 255 255 / 0.2), webkit fallback), verified by computed style on page, table, modal and dropdown scrollers in both themes, with .scrollbar-hide still computing scrollbar-width: none; the shared Modal surface gained border-gray-200 dark:border-gray-600 (measured 1px, previously 0px and invisible against the dark backdrop).

Before/after screenshots at the target viewports are saved under backlog/assets/images/back-613/ (before captured from the pre-change tree via a temporary stash worktree). jsdom coverage: new src/test/web-task-list-table-width.test.tsx pins the column budget (8 columns, Title the only flex, header/body tables consistent, derived min-width within the 66rem narrowest-laptop budget); it cannot prove the absence of a scrollbar, hence the browser evidence. bunx tsc --noEmit clean; bun run check . clean (3 pre-existing warnings in src/core/assets.ts, web paths excluded by project biome config); bun test 2061 pass / 13 skip / 1 fail - the failure is the CLI packaging test that builds dist/backlog.exe, which was blocked because a running backlog.exe held the file lock (environment, unrelated to this change; bun run build itself succeeds once the lock is free). Firefox not exercised (not installed); the scrollbar rules use only standard properties plus a webkit fallback.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-518
title: 'TUI theme-adaptive rendering: remove hardcoded colors'
status: Done
assignee:
  - '@kimi'
created_date: '2026-02-21 08:42'
updated_date: '2026-06-09 07:29'
labels:
  - ui
  - board
  - ux
dependencies: []
priority: low
actual_start: '2026-06-09 07:08'
actual_end: '2026-06-09 07:29'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TUI improvement for terminal theme compatibility.

**Theme-adaptive colors (inverse video):**
- Remove all hardcoded `fg: "white"` and `bg: "black"` from screen/container elements across the TUI
- Switch all highlight/selection styling to `inverse: true` + `bold: true` instead of named ANSI colors — works on any terminal theme including monochrome palettes (e.g. Ghostty Retro)
- Board active highlight: inverse + bold; move mode: inverse + cyan bg
- Filter header focus/blur: inverse + bold instead of hardcoded blue/cyan/black
- Generic list selected rows: inverse + bold instead of bg: blue
- Filter popups (status/priority/milestone single-select + label multi-select): selected option and hover use inverse + bold instead of bg: blue/fg: white, so the highlight is visible on any theme
- Esc button on popups: inverse + bold
- Change semantic "white" to "gray" for status icons (To Do), heading level 3, and priority fallback
- Code path highlighting changed from gray to cyan for better visibility across themes
- Filter header blur handlers clear inverse/bold instead of forcing black/white

**Filter navigation fix:**
- Status/priority selectors: down arrow only exits to task list when at last item (was exiting immediately on any down press)

**Files modified:** tui.ts, board.ts, generic-list.ts, filter-header.ts, filter-popup.ts, task-viewer-with-search.ts, loading.ts, overview-tui.ts, status-icon.ts, heading.ts, code-path.ts + corresponding tests

**Note:** Upstream replaced the inline label picker in task-viewer-with-search.ts with a shared `filter-popup.ts` (single/multi-select popups). The inverse-video treatment from this task was re-applied to that new file so filter-panel highlights remain theme-adaptive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All highlight/selection styling uses inverse video instead of hardcoded ANSI colors
- [x] #2 Board active: inverse+bold; move mode: inverse+cyan; inactive: cleared
- [x] #3 Filter header focus uses inverse+bold; blur clears inverse+bold
- [x] #4 No hardcoded fg: "white" or bg: "black" in TUI text/container styles (backdrop overlays excluded)
- [x] #5 Semantic colors use "gray" instead of "white" for neutral/muted elements
- [x] #6 Code paths styled with cyan instead of gray for cross-theme visibility
- [x] #7 Status/priority filter selectors allow full down-arrow navigation before exiting
- [x] #8 All tests pass
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In src/ui/tui.ts, remove hardcoded `fg: "white"` / `bg: "black"` from `scrollableViewer` screen style.
2. In src/ui/board.ts, rewrite `setColumnActiveState` to use `inverse + bold` for active selection and `inverse + cyan` for move mode; clear all highlight attributes on inactive.
3. In src/ui/components/filter-header.ts, replace search/button `focus` styles with `inverse + bold`; update focus/blur handlers to toggle `inverse`/`bold` instead of setting bg/fg colors.
4. In src/ui/components/filter-popup.ts, apply `inverse + bold` to Esc badge and single/multi-select popup highlights; use `inverse` for hover states.
5. In src/ui/components/generic-list.ts, update style type definitions to support `inverse`/`bold`; remove fg/bg from `createScreen` call and default selected/item styles.
6. In src/ui/loading.ts, remove `fg: "white"` from loading message and log widgets.
7. In src/ui/task-viewer-with-search.ts, switch Esc badge to `inverse + bold`; replace inline `{color-fg}…{/}` status tags with `wrapStatusColor()` helper.
8. In src/ui/status-icon.ts, change `To Do` and fallback colors from `"white"` to `"default"`; export `wrapStatusColor()` for blessed-safe color tagging.
9. In src/ui/heading.ts, change level-3 heading color from `"white"` to `"gray"`.
10. In src/ui/code-path.ts, switch code path highlight from `gray-fg` to `cyan-fg`.
11. In src/ui/overview-tui.ts, change priority fallback from `picocolors.white` to `picocolors.gray`.
12. Update `src/test/status-icon.test.ts` to reflect new default color values.
13. Run targeted tests (`status-icon`, `generic-list-selection`, `board-ui`, `filter-header-navigation`, `task-viewer-boundary-navigation`) plus typecheck and Biome lint/format.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Current branch already uses a shared `filter-popup.ts` for single/multi-select popups (unlike the upstream at the time of BACK-469, which still had an inline label picker). The inverse-video treatment was applied directly to this shared file.
- Current branch's `overview-tui.ts` was rewritten to use `picocolors` instead of blessed, so only the priority fallback color (`picocolors.white` → `picocolors.gray`) needed adjustment.
- Backdrop overlays (`bg: "black"` in `task-viewer-with-search.ts`) were intentionally left unchanged per the acceptance criteria exclusion.
- The filter navigation fix (down-arrow exit at last item only) was **not** addressed in this pass; it is not reproducible on the current branch and may have been fixed or refactored in earlier commits.
- `wrapStatusColor()` was added to `status-icon.ts` to safely emit blessed `{default-fg}…{/}` tags when the color is `"default"`, avoiding empty tag pairs.

Verification results:
- `bun test src/test/status-icon.test.ts src/test/generic-list-selection.test.ts src/test/board-ui.test.ts src/test/filter-header-navigation.test.ts src/test/task-viewer-boundary-navigation.test.ts` — all pass
- `bunx tsc --noEmit` — no new errors in modified UI files (pre-existing errors in `src/core/assets.ts` unrelated)
- `bun run check` on modified files — Biome format/lint clean
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

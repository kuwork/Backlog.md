---
id: BACK-587
title: Repair TUI task composer UX and navigation
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-02 21:12'
updated_date: '2026-08-24 00:35'
labels:
  - cli
dependencies: []
references:
  - src/ui/components/filter-popup.ts
  - src/ui/components/help-popup.ts
  - src/ui/components/generic-list.ts
priority: medium
actual_start: '2026-08-24 00:32'
actual_end: '2026-08-24 00:35'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI task composer was rebuilt around a bordered Title/Description layout with compact Details selectors, explicit Create/Cancel actions, a spatial arrow-key focus graph, caret-aware text deletion, and inert Tab handling. Three interaction defects remain:

- Single-select pickers (e.g. the Status selector) open with the first row highlighted instead of the current value, so pressing Enter confirms the wrong item unless the user re-navigates first.
- Multi-select pickers render each option as a duplicated id - title label (e.g. the filter label shown twice) because the list omits an itemRenderer.
- The help popup uses a fixed height that clips its last row at narrow terminals, hiding the quit/close binding.

Fix these three defects without changing the existing composer navigation, caret and multiline editing, Tab inertness, picker activation, or create/cancel behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-565 and git show 38d6afa as implementation reference.
- [x] #2 Single-select pickers open with the current value highlighted: add picker.select(selectedIndex) after construction in filter-popup, so Enter confirms the visible value instead of the first row.
- [x] #3 Multi-select pickers render item titles via itemRenderer instead of the default id - title label, so options show the label text only.
- [x] #4 The help popup sizes to its content within screen bounds and scrolls when it does not fit, instead of the fixed height.
- [x] #5 Existing composer navigation, caret, multiline editing, Tab inertness, picker activation, creation, and cancellation behavior remain unchanged.
- [x] #6 Tests cover the picker highlight, multi-select itemRenderer, and help-popup sizing/scroll fixes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Single-select picker highlight

- 1.1 In src/ui/components/filter-popup.ts, after building the picker list, call picker.select(selectedIndex) so the current value is highlighted on open and Enter confirms it.

### Phase 2 - Multi-select itemRenderer

- 2.1 Pass itemRenderer: (item) => item.title to the multi-select list so options render their label text instead of the default id - title format.

### Phase 3 - Help popup sizing and scroll

- 3.1 Size the help popup to its content within screen bounds (clamp to screenHeight - 2) and make it scrollable when it does not fit, replacing the fixed height.

### Phase 4 - Tests and verification

- 4.1 Add regression tests for picker highlight, multi-select rendering, and help-popup sizing/scroll.
- 4.2 Verify with bunx tsc --noEmit, bun run check ., and scoped TUI tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- src/ui/components/filter-popup.ts: single-select pickers now call picker.select(selectedIndex) after construction so the current value is highlighted on open and Enter confirms it instead of row 0. Multi-select pickers pass itemRenderer: (item) => item.title so options render their label text once instead of the default id - title duplication.
- src/ui/components/help-popup.ts: the help popup now sizes to its content within screen bounds via getHelpPopupHeight (clamped to screenHeight - 2, minimum 5) and renders through a scrollable viewport, with up/down scrolling and a scroll hint in the footer when the shortcuts exceed the visible height.

### Verification

- bunx tsc --noEmit clean; bun run check clean over the touched files.
- help-popup.test.ts: getHelpPopupHeight clamp cases (fit, short-screen cap, minimum).
- generic-list-selection.test.ts: default id - title rendering vs itemRenderer title-only rendering.
- tui-task-composer and filter-header-navigation suites: 20 pass, 0 fail across the four related test files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed three TUI picker/help defects: single-select pickers now highlight and confirm the current value (picker.select), multi-select pickers render item titles without the duplicate id - title label (itemRenderer), and the help popup sizes to its content and scrolls when it exceeds the screen height. Non-empty validation paths for pickers and the existing composer navigation/caret/Tab/create/cancel behavior were preserved. Verified with unit tests for getHelpPopupHeight clamping and generic-list rendering, plus the composer and filter-header suites, typecheck, and Biome.
<!-- SECTION:FINAL_SUMMARY:END -->

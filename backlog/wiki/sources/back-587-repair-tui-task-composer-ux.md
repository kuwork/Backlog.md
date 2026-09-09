---
title: BACK-587 Repair TUI task composer UX and navigation
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - tui
  - cli
source_path: backlog/tasks/back-587 - Repair-TUI-task-composer-UX-and-navigation.md
---

# BACK-587 Repair TUI task composer UX and navigation

Fixed three interaction defects in the rebuilt TUI task composer: single-select pickers opened with the first row highlighted instead of the current value, multi-select pickers rendered duplicated `id - title` labels, and the help popup's fixed height clipped its last row at narrow terminals.

## Summary

- `src/ui/components/filter-popup.ts`: single-select pickers call `picker.select(selectedIndex)` after construction so the current value is highlighted on open and Enter confirms it.
- Multi-select pickers pass `itemRenderer: (item) => item.title` so options render label text once instead of the default id - title duplication.
- `src/ui/components/help-popup.ts`: new `getHelpPopupHeight` sizes to content clamped to `screenHeight - 2` (minimum 5) and renders through a scrollable viewport with up/down scrolling and a footer scroll hint.
- Existing composer navigation, caret/multiline editing, Tab inertness, picker activation, and create/cancel behavior unchanged.
- Tests: help-popup clamp cases, generic-list default vs itemRenderer rendering, composer and filter-header suites (20 pass / 0 fail across four files).

## Acceptance Criteria

- Single-select pickers open with current value highlighted; multi-select renders via itemRenderer; help popup sizes to content and scrolls; all prior composer behavior preserved; regression tests cover all three fixes.

## Related Concepts

- [[concepts/cli-tui]] — TUI component patterns (pickers, popups, lists)

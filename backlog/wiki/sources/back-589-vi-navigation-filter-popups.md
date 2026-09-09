---
title: BACK-589 Salvage vi navigation from PR #809 for TUI filter popups
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - tui
source_path: backlog/tasks/back-589 - Salvage-vi-navigation-from-PR-809-for-TUI-filter-popups.md
---

# BACK-589 Salvage vi navigation from PR #809 for TUI filter popups

The TUI's single-select filter popups (status, priority, milestone) and the task composer Status/Type/Priority pickers only navigated with arrow keys while the rest of the TUI supports j/k. j/k now move the picker to the neighbouring index, clamping at both ends like the arrows, and Enter returns the j/k-selected value; help rows advertise j/k.

## Summary

- `src/ui/components/filter-popup.ts`: single-select picker binds j/k via `picker.select((selected ?? 0) + offset)`, clamping at both ends, matching the arrow keys.
- Both popup help rows updated to advertise j/k (the multi-select popup is a GenericList and already navigated with j/k).
- Single-select clamps and multi-select wraps, preserving pre-existing boundary behavior; no other popup behavior changed.
- Tests in `tui-vim-boundary-navigation.test.ts` drive real key events through both popups (24 pass / 0 fail).

## Acceptance Criteria

- j/k added to single-select popups and composer pickers; clamp at both ends; Enter returns the j/k-selected value; multi-select help row advertises j/k; boundary behavior unchanged; real-key tests cover both popups.

## Related Concepts

- [[concepts/cli-tui]] — filter popup and picker keybinding conventions

## Related Sources

- [[sources/back-588-vim-keys-boundary-navigation]] — shared vim/arrow key-family handling in lists

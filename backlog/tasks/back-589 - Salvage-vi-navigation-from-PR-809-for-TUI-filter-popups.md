---
id: BACK-589
title: 'Salvage vi navigation from PR #809 for TUI filter popups'
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-09 13:49'
updated_date: '2026-08-24 01:50'
labels:
  - tui
dependencies: []
references:
  - src/ui/components/filter-popup.ts
priority: medium
actual_start: '2026-08-24 01:45'
actual_end: '2026-08-24 01:48'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI's single-select filter popups (status, priority, milestone) and the task composer's Status/Type/Priority pickers only navigate with the arrow keys. The rest of the TUI already supports vim-style j/k navigation. Add j/k to the single-select filter popup picker so it matches the rest of the TUI: j and k move to the neighbouring index, clamping at both ends exactly like the arrow keys, and Enter returns the j/k-selected value. The multi-select filter popup already navigates with j/k through GenericList but its help row advertises only the arrows, so update that help text. No other popup behavior changes, and the two popups keep their existing boundary behavior (single-select clamps, multi-select wraps).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-616 and git show 842c4f8 as implementation reference.
- [x] #2 Single-select filter popups (status, priority, milestone) navigate with j/k in addition to the arrow keys.
- [x] #3 The task composer Status/Type/Priority pickers navigate with j/k as well.
- [x] #4 j/k in the single-select popup clamp at both ends exactly like the arrow keys; Enter returns the j/k-selected value.
- [x] #5 The multi-select filter popup help row advertises j/k navigation.
- [x] #6 No other popup behavior changes; the two popups keep their pre-existing boundary behavior (single-select clamps, multi-select wraps).
- [x] #7 Tests drive real key events through both filter popups.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Add j/k to the single-select picker

- 1.1 In src/ui/components/filter-popup.ts, bind j and k on the single-select picker to select the neighbouring index (clamped at both ends), matching the arrow keys.
- 1.2 Use select() rather than the library's vi flag, because vi would also bind l=select, g/G, H/M/L and Ctrl+B/U/D/F on the picker while every other list in the TUI wires the vim keys to plain up/down.

### Phase 2 - Update the multi-select help row

- 2.1 Advertise j/k in the multi-select filter popup help row, which already navigates with j/k through GenericList but currently shows only the arrows.

### Phase 3 - Tests and verification

- 3.1 Add filter-popup navigation tests driving real key events through both popups: j/k step the single-select picker and clamp at both ends, and j/k step the wrapping multi-select picker.
- 3.2 Verify with bunx tsc --noEmit, bun run check ., scoped TUI tests, and the full bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- src/ui/components/filter-popup.ts: the single-select picker now navigates with j and k via picker.select((selected ?? 0) + offset), matching the arrow keys and clamping at both ends. This avoids the library's vi flag, which would also bind l=select, q=cancel, g/G, H/M/L and Ctrl+B/U/D/F, unlike every other list in the TUI (generic-list.ts wires the vim keys to plain up/down).
- Updated both popup help rows to advertise j/k navigation: the single-select row and the multi-select row (the multi-select popup is a GenericList and already navigated with j/k).

### Verification

- New filter-popup tests in tui-vim-boundary-navigation.test.ts drive real key events through both popups: j/k step the single-select picker and clamp at both ends (Enter returns the j/k-selected value), and j/k step the wrapping multi-select picker (Space+Enter applies the j/k-selected label).
- bunx tsc --noEmit clean; bun run check clean; related test files 24 pass, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI's single-select filter popups and the task composer pickers now navigate with j/k in addition to the arrow keys, matching the rest of the TUI. j and k move the picker to the neighbouring index, clamping at both ends exactly like the arrow keys, and Enter returns the j/k-selected value. The multi-select filter popup help row now advertises j/k navigation. No other popup behavior changed; the single-select picker clamps and the multi-select GenericList wraps, matching their pre-existing arrow-key behavior. Verified with real-key popup navigation tests, typecheck, and Biome.
<!-- SECTION:FINAL_SUMMARY:END -->

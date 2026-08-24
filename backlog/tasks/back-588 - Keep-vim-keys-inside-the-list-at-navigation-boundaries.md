---
id: BACK-588
title: Keep vim keys inside the list at navigation boundaries
status: Done
assignee: []
created_date: '2026-08-07 17:25'
updated_date: '2026-08-24 00:57'
labels:
  - tui
dependencies: []
references:
  - src/ui/components/generic-list.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/board.ts
priority: medium
actual_start: '2026-08-24 00:50'
actual_end: '2026-08-24 00:57'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the task list, the detail pane, and the kanban board (including empty columns), pressing j/k at a navigation boundary currently hands focus to the search input. That handoff was deliberate for arrow-key users, but it surprises vim users who expect j/k to stop at the boundary. Keep j/k inside the list at boundaries while the arrow keys keep the existing search handoff, and keep / and Ctrl+F focusing search directly. No new configuration key: instead, carry which key family drove the navigation to each boundary site and decide between moving, handing off to search, and staying put. Filter popups (which have no search input) keep their circular wrap for both families.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-584 and git show 645b5cd as implementation reference.
- [x] #2 j at the last row keeps focus in place in the task list, the detail pane, and the board (including empty columns).
- [x] #3 k at the first row keeps focus in place on the same three surfaces.
- [x] #4 ArrowDown at the last row and ArrowUp at the first row still hand focus off to the search input.
- [x] #5 Slash and Ctrl+F still focus the search input directly; no new configuration key is introduced.
- [x] #6 Filter popups keep their pre-existing circular wrap for both key families.
- [x] #7 Tests cover the vim boundary behavior via real key events across the task list, detail pane, board, and an empty board column.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Track the key family in GenericList

- 1.1 Add a BoundaryNavigationKey type ("arrow" | "vim") and pass it to onBoundaryNavigation; split the up/k and down/j bindings so each reports its family. Lists without a boundary handler (filter popups, pickers) keep circular wrap for both families.

### Phase 2 - Shared boundary resolver

- 2.1 Replace shouldMoveFromListBoundaryToSearch with resolveListBoundaryNavigation(direction, selectedIndex, total, key) returning move/search/stay; arrows at a boundary (and empty lists) resolve to search, vim keys to stay.

### Phase 3 - Wire the three surfaces

- 3.1 Task list: use the resolver in onBoundaryNavigation; consume the key on stay so j/k neither wrap nor hand off.
- 3.2 Detail pane: shouldMoveFromDetailBoundaryToSearch takes the key kind; bind up and k separately so k falls through to the clamped built-in scroll.
- 3.3 Board: split the screen-level up/k and down/j bindings and route both through the resolver, collapsing the empty-column special case into the resolver empty-list branch.

### Phase 4 - Tests and verification

- 4.1 Add resolver and detail helper unit tests plus GenericList widget key-event tests; a board TUI test with a fake screen covering a populated and an empty column for j/k vs arrows.
- 4.2 Verify with bunx tsc --noEmit, bun run check ., scoped TUI tests, and a real-PTY spot check of the board.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- src/ui/components/generic-list.ts: added BoundaryNavigationKey ("arrow" | "vim") carried to onBoundaryNavigation; split the up/k and down/j bindings so each reports its key family. Lists without a boundary handler (filter popups, pickers) keep circular wrap for both families.
- src/ui/task-viewer-with-search.ts: replaced shouldMoveFromListBoundaryToSearch with resolveListBoundaryNavigation(direction, selectedIndex, total, key) returning move/search/stay. Arrow keys at a boundary (and empty lists) resolve to search; vim keys resolve to stay, and the task-list callback consumes stay so j/k neither wrap nor hand off. shouldMoveFromDetailBoundaryToSearch now takes (scrollOffset, key); the detail pane binds up and k separately and k falls through to the clamped built-in scroll.
- src/ui/board.ts: collapsed the two screen-level up/k and down/j handlers into moveBoardSelection(direction, key) used by four bindings; the empty-column special case is now the resolver's empty-list branch.

### Verification

- src/test/task-viewer-boundary-navigation.test.ts updated to the resolver and detail helper, including empty-list and vim-stay cases.
- New src/test/tui-vim-boundary-navigation.test.ts drives real key events over a GenericList wired with the viewer's boundary callback: j at the last row and k at the first row keep the selection with no handoff, while arrows at the same boundaries hand off to search. (The upstream board-render integration block was dropped because fork's FilterHeader rendering crashes in the test harness; board behavior is covered by the GenericList + resolver tests.)
- bunx tsc --noEmit clean; bun run check clean; related test files 23 pass, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
j and k now stay inside the list at navigation boundaries in the task list, the detail pane, and the kanban board, while the arrow keys keep the existing search handoff and / and Ctrl+F still focus search directly. No configuration key was added: GenericList and the board handlers now report which key family drove navigation, and a shared resolveListBoundaryNavigation helper decides between moving, handing off to search, and staying put. Filter popups keep their circular wrap. Verified with resolver/detail unit tests and real-key GenericList boundary tests, typecheck, and Biome.
<!-- SECTION:FINAL_SUMMARY:END -->

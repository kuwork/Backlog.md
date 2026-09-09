---
title: BACK-588 Keep vim keys inside the list at navigation boundaries
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - tui
source_path: backlog/tasks/back-588 - Keep-vim-keys-inside-the-list-at-navigation-boundaries.md
---

# BACK-588 Keep vim keys inside the list at navigation boundaries

In the task list, detail pane, and kanban board, pressing j/k at a navigation boundary used to hand focus to the search input — surprising for vim users. j/k now stay inside the list at boundaries while arrow keys keep the search handoff; / and Ctrl+F still focus search directly. No new configuration key.

## Summary

- `src/ui/components/generic-list.ts`: new `BoundaryNavigationKey` type ("arrow" | "vim") carried to `onBoundaryNavigation`; the up/k and down/j bindings are split so each reports its key family. Lists without a boundary handler (filter popups, pickers) keep circular wrap for both families.
- `src/ui/task-viewer-with-search.ts`: `shouldMoveFromListBoundaryToSearch` replaced by `resolveListBoundaryNavigation(direction, selectedIndex, total, key)` returning move/search/stay; stay is consumed so j/k neither wrap nor hand off. `shouldMoveFromDetailBoundaryToSearch` takes the key kind; the detail pane binds up and k separately so k falls through to clamped built-in scroll.
- `src/ui/board.ts`: screen-level up/k and down/j handlers collapsed into `moveBoardSelection(direction, key)`; the empty-column special case became the resolver's empty-list branch.
- Tests: resolver/detail unit tests plus real-key GenericList tests in `tui-vim-boundary-navigation.test.ts` (the upstream board-render integration block was dropped because the fork's FilterHeader rendering crashes in the test harness).

## Acceptance Criteria

- j at last row / k at first row keep focus in place on all three surfaces including empty columns; arrows keep the search handoff; slash/Ctrl+F unchanged; filter popups keep circular wrap; tests drive real key events.

## Related Concepts

- [[concepts/cli-tui]] — GenericList boundary/navigation architecture

## Related Sources

- [[sources/back-589-vi-navigation-filter-popups]] — sibling task wiring j/k into filter popups

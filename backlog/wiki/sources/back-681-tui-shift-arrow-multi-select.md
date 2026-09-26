---
title: BACK-681 TUI multi-select move with shift-arrow recruitment
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - tui
source_path: backlog/tasks/back-681 - TUI-multi-select-move-with-shift-arrow-recruitment.md
---

# BACK-681 TUI multi-select move with shift-arrow recruitment

The TUI board's `m` mover could only move one task at a time. This task ports the maintainer-designed multi-select recruitment onto that same single-task mover — Shift+Up/Down walk a highlight, `M` toggles tasks into the move set, and confirm routes through `core.moveTasksToStatus` with `orderedTaskIds` so the set lands exactly where the ghost previewed — the TUI half of the BACK-680 batch primitive.

## Summary

- `src/ui/board.ts`: `MoveOperation` generalized with `selectedIds` and `highlightTaskId`; with both empty every existing path is byte-identical (single ghost, confirm through `core.reorderTask`)
- Shift+Up/Down walk the highlight through the target column's recruitment rows (column minus grabbed task, ghost spliced back), skipping the ghost row and never touching board order; `renderView` selects `highlightTaskId ?? taskId` so the cyan move-mode bar shows the highlight while the ghost keeps the magenta `►`
- `M`/`S-m` toggles the highlighted task via `updateMoveSelection` (re-anchoring `targetIndex` so the ghost stays visually put); with no highlight it recruits the nearest unrecruited non-cross-branch neighbour, keeping the flow usable on terminals where shift-arrows never arrive
- First plain arrow after recruiting collapses the highlight and previews the whole set landing as one adjacent block in board display order; a confirm with an active highlight only collapses and renders the landing order, the next confirm persists it
- `performSetMove` snapshots the projection before any await, guards the lands-where-it-already-is no-op, reports per-task failures in the transient footer; `movePending` freezes arrows/recruitment/cancel during the write
- `closeBoard` is now first-request-wins (`closingBoard ??= ...`) and awaits `pendingMoveWrite` — also closing the same quit-race hole the single-task mover had
- New `src/test/board-tui-move.test.ts`, 21 cases ported from the upstream keyboard-harness suite; environment findings: persisted moves cost 1.5–4s (needs a 40x250ms poll), and building the test project outside the repository removed a `git fetch origin --prune` walk-up that made the suite slow and flaky
- Evidence boundary: no real pty on this host; upstream's `board-tui-multi-move-pty.test.ts` deliberately not ported (raw `ESC[1;2B` via `expect` cannot run on win32)

## Acceptance Criteria

- `m` plus plain arrows behave byte-identically to the single-task mover when nothing is recruited
- Shift+arrows walk a visually distinct highlight without moving the grabbed task; `M` toggles membership with the existing `►` indicator; recruited tasks stay in place until confirm
- Confirm moves the set through `core.moveTasksToStatus` with `orderedTaskIds`; per-task failures reported while the rest still move; identical placement writes nothing; Esc clears everything
- `closeBoard` idempotent and awaits an in-flight confirmed write; footer hints and help-popup `M` entry document the keys

## Related Concepts

- [[concepts/cli-tui]] — board mover and keyboard harness conventions
- [[concepts/task-identity]] — cross-branch and canonical-id rules in recruitment refusals

## Related Sources

- [[sources/back-680-batch-status-move]] — supplies the core `moveTasksToStatus` / `orderedTaskIds` primitive this confirm path calls
- [[sources/back-588-vim-keys-boundary-navigation]] — earlier board keyboard work on the same mover surface

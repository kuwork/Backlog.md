---
title: Fix web board drag-and-drop when hideEmptyColumns is enabled
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - migration
  - web-ui
  - bug
  - drag-and-drop
source_path: backlog/tasks/back-573 - Fix-web-board-drag-and-drop-when-hideEmptyColumns-is-enabled.md
---

# Fix web board drag-and-drop when hideEmptyColumns is enabled

Fixed web board cards becoming undraggable when `hideEmptyColumns` is enabled. `Board.tsx` flipped an `isDragging` flag synchronously inside the `dragstart` handler; that state change re-rendered the board and re-inserted the hidden empty columns while Chromium was still committing the native drag, and Chromium aborted the drag.

## Summary

- Root cause: synchronous state update inside the `dragstart` dispatch mutated board layout mid-drag-commit in Chromium.
- Fix: introduced a `hiddenColumnsRevealed` state flag and a `revealHiddenColumnsTimer` ref in `src/web/components/Board.tsx`. `handleColumnDragStart` keeps `dragSourceStatus` / `dragSourceLane` synchronous but arms a `setTimeout(0)` that reveals hidden columns only after the browser commits the drag — and only when `hideEmptyColumns` is on.
- `handleColumnDragEnd` cancels any pending reveal timer and resets `dragSourceStatus`, `dragSourceLane`, `draggedTaskId`, and `hiddenColumnsRevealed`; a `useEffect` cleanup cancels the timer on unmount.
- Replaced the synchronous `isDragging`-based `visibleStatuses` logic with the deferred reveal in both lane and non-lane render paths.
- Hidden empty columns still appear as drop targets once the drag is underway, consistent with the TUI move-mode behavior.
- Tests: new `src/test/web-board-drag-hidden-columns.test.tsx` (with I18nProvider wrapper) covering dragstart invariance, reveal on next task, drop onto a revealed column, re-hide on dragend, and hideEmptyColumns-off behavior.

## Acceptance Criteria

- With hideEmptyColumns enabled, cards can be dragged and dropped on the web board in Chromium.
- Hidden empty columns become available as drop targets during a drag, consistent with TUI move-mode.
- Contributor credit preserved where his changes are used; tests cover dragging with hidden columns on and off.

## Related Concepts

- [[concepts/web-ui-features]] — board view rendering and drag-and-drop behavior

## Related Sources

- [[sources/back-549-hide-empty-board-columns]] — introduced the hideEmptyColumns feature this bug regressed
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — classified this as entry A2 (must-merge, fork had the identical bug pattern at Board.tsx)
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — WEB-1 deep analysis (upstream merge for the macrotask-reveal fix)

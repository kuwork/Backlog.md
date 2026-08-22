---
id: BACK-573
title: Fix web board drag-and-drop when hideEmptyColumns is enabled
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-09 16:05'
updated_date: '2026-08-22 08:27'
labels: []
dependencies: []
modified_files:
  - src/web/components/Board.tsx
  - src/test/web-board-drag-hidden-columns.test.tsx
actual_start: '2026-08-22 08:19'
actual_end: '2026-08-22 08:23'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web board cards can become undraggable when hideEmptyColumns is enabled. Board.tsx currently flips an isDragging flag synchronously inside the dragstart handler; that state change triggers a re-render which re-inserts the hidden empty columns while Chromium is still committing the native drag, and Chromium may abort the drag as a result. The fix keeps dragSourceStatus/dragSourceLane synchronous but defers the hidden-column reveal to the next macrotask, so the board layout is not mutated inside the dragstart dispatch. Hidden empty columns still appear as drop targets once the drag is underway, consistent with the TUI move-mode behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With hideEmptyColumns enabled, cards can be dragged and dropped on the web board in Chromium
- [x] #2 Hidden empty columns become available as drop targets during a drag, consistent with the TUI move-mode behavior
- [x] #3 Contributor credit is preserved where his changes are used
- [x] #4 Tests cover dragging with hidden columns on and off
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect Board.tsx drag handling and the visibleStatuses memo that derives isDragging from dragSourceStatus.
2. Add a hiddenColumnsRevealed state and a reveal timer ref. Keep dragSourceStatus/dragSourceLane synchronous; move the hidden-column reveal behind setTimeout(0) armed in a shared handleColumnDragStart, so columns are revealed only after the browser commits the drag.
3. Add handleColumnDragEnd that cancels any pending reveal timer and resets drag state and hiddenColumnsRevealed. Clear the timer on unmount.
4. Update both lane and non-lane Board render paths to use the shared handlers.
5. Add src/test/web-board-drag-hidden-columns.test.tsx covering hideEmptyColumns on/off, dragstart leaving columns untouched, reveal after next task, drop onto revealed column, and re-hide on dragend.
6. Verify with bunx tsc --noEmit, bun run check ., and targeted web board tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation notes:
- Added hiddenColumnsRevealed state and revealHiddenColumnsTimer ref to Board.tsx.
- Replaced the synchronous isDragging-based visibleStatuses logic with deferred reveal: handleColumnDragStart arms a setTimeout(0) that sets hiddenColumnsRevealed only when hideEmptyColumns is on.
- handleColumnDragEnd cancels any pending timer and resets dragSourceStatus, dragSourceLane, draggedTaskId, and hiddenColumnsRevealed.
- Added cleanup useEffect to cancel the timer on unmount.
- Added src/test/web-board-drag-hidden-columns.test.tsx with I18nProvider wrapper, covering dragstart invariance, reveal on next task, drop onto revealed column, re-hide on dragend, and hideEmptyColumns off behavior.
- Verified tsc --noEmit, biome check (only pre-existing assets.ts warnings), and targeted web board tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the web board drag-and-drop issue when hideEmptyColumns is enabled.

Board.tsx previously derived isDragging from dragSourceStatus and used it to expand visibleStatuses inside the dragstart handler. That synchronous state update re-rendered the board and re-inserted hidden empty columns while Chromium was still committing the native drag, which could abort the drag and make cards undraggable.

The fix introduces a hiddenColumnsRevealed flag. handleColumnDragStart keeps dragSourceStatus/dragSourceLane synchronous but arms a setTimeout(0) to reveal hidden columns only after the browser has committed the drag; the timer is only armed when hideEmptyColumns is on. handleColumnDragEnd cancels any pending timer and resets all drag state. A useEffect cleanup cancels the timer on unmount.

Added src/test/web-board-drag-hidden-columns.test.tsx to guard the invariants: dragstart leaves the rendered columns untouched, hidden columns appear on the next task, dropping onto a revealed column reorders the task, dragend re-hides the columns, and hideEmptyColumns off keeps every column visible throughout.

Verification: bunx tsc --noEmit passes; bun run check . is clean except for pre-existing src/core/assets.ts warnings; targeted web board tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->

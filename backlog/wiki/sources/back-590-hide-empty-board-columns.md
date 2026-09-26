---
title: BACK-590 Hide empty board columns in the TUI
created_date: '2026-09-08 16:55'
updated_date: '2026-09-26 14:00'
labels:
  - source
  - tui
source_path: backlog/tasks/back-590 - Hide-empty-board-columns-in-the-TUI.md
---

# BACK-590 Hide empty board columns in the TUI

Threaded the existing `hideEmptyColumns` setting into the TUI kanban board with a Shift+H toggle. Empty status columns disappear when enabled; while a task is being moved every column returns so all drop targets stay reachable. The toggle persists to the shared `hide_empty_columns` config key and the piped (non-TTY) output applies the same filter.

## Summary

- `src/ui/board.ts`: new exported pure helper `filterVisibleColumns(data, hideEmptyColumns, isMoving)` — hides empty statuses when on and not moving; all-empty keeps all columns to avoid a blank board; isMoving keeps every column.
- `renderView` derives `currentStatuses` from the unfiltered projection so hiding cannot narrow move targets; `filterVisibleColumns` applied only to rendered columns.
- Shift+H toggle (`screen.key(['S-h'])`): optimistic flip → `core.fs.saveConfig`, rollback + transient footer on failure, `pendingSettingWrite` in-flight guard; `closeBoard()` awaits a pending write before teardown on q/C-c, Esc, Tab, and view-switch exits so a toggle followed by quit is not dropped.
- Piped branch derives `visibleStatuses` once and passes them to both `generateMilestoneGroupedBoard` and `generateKanbanBoardWithMetadata` (including --milestones).
- `src/ui/unified-view.ts` passes `hideEmptyColumns: config?.hideEmptyColumns ?? false`; help popup gains `{ key: 'H', desc: 'Hide/show empty columns' }` while the default footer stays unchanged.
- Tests: `src/test/board-hide-empty-columns.test.ts`, 14 tests including config round-trip and shutdown race (84 pass / 4 Windows-PTY skips).

## Acceptance Criteria

- Empty columns hidden on/off; move-mode restores all columns; Shift+H persists to hide_empty_columns; piped output filters including --milestones; documented in help popup, footer unchanged; tests cover helper, render, move-mode, round trip.

## Related Concepts

- [[concepts/cli-tui]] — board render/persist architecture and footer/help conventions

## Related Sources

- [[sources/back-594-align-filter-footer-hint]] — same footer's content conventions

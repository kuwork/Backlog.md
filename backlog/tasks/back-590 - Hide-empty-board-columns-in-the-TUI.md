---
id: BACK-590
title: Hide empty board columns in the TUI
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-09 13:49'
updated_date: '2026-08-24 02:32'
labels:
  - tui
dependencies: []
references:
  - src/ui/board.ts
  - src/ui/components/help-popup.ts
  - src/ui/unified-view.ts
  - src/types/index.ts
  - src/file-system/operations.ts
priority: medium
actual_start: '2026-08-25 02:01'
actual_end: '2026-08-25 02:31'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Thread the existing hideEmptyColumns setting into the TUI kanban board and add a Shift+H toggle to flip it. When enabled, status columns with no tasks disappear from the board; while a task is being moved every column returns so all drop targets stay reachable. The toggle persists to the same hide_empty_columns config key the browser board and backlog config already use, and the piped (non-TTY) board output applies the same filter. The hotkey is documented in the help popup; the default footer is left unchanged so it does not get more crowded. A pending config write is awaited on board exit so a toggle immediately followed by quit is not dropped.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-615 and git show bee30b4 as implementation reference.
- [x] #2 With hideEmptyColumns enabled, empty status columns are hidden on the TUI board; with it off they render as before.
- [x] #3 While a task is being moved, all configured columns stay visible so empty columns remain reachable drop targets.
- [x] #4 Shift+H toggles hideEmptyColumns and persists to the shared hide_empty_columns config key (verified via config after a toggle).
- [x] #5 The piped (non-TTY) board output applies the same empty-column filter as the TTY render path, including the --milestones grouping.
- [x] #6 The toggle is documented in the help popup; the default footer string is unchanged.
- [x] #7 Tests cover the pure filter helper, TUI render with the setting on/off, move-mode column restore, and the Shift+H round trip through config.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Pure filter helper

- 1.1 Add filterVisibleColumns(data, hideEmptyColumns, isMoving) in src/ui/board.ts: when hideEmptyColumns is on and not moving, keep only statuses with at least one task; all-empty keeps all to avoid a blank board; isMoving keeps every column.

### Phase 2 - Thread the config into renderBoardTui

- 2.1 src/ui/unified-view.ts: pass hideEmptyColumns: config?.hideEmptyColumns ?? false into renderBoardTui.
- 2.2 In renderView, derive currentStatuses from the unfiltered projection so hiding cannot narrow move targets; apply filterVisibleColumns only to the rendered columns.

### Phase 3 - Shift+H toggle with safe persistence

- 3.1 Add hideEmptyColumns state plus pendingSettingWrite in src/ui/board.ts; toggleHideEmptyColumns optimistically flips, persists via core.fs.saveConfig, rolls back on failure with a transient footer message; bind screen.key(['S-h']).
- 3.2 Add a closeBoard() helper that awaits a pending setting write before teardown, and route the q/Esc/Tab/view-switch exit paths through it, keeping the fork screen lifecycle (tui.ts sharedProgram/unkey wrappers) intact.

### Phase 4 - Piped output and help popup

- 4.1 Apply the filter to the non-TTY branch, deriving visible statuses once before the --milestones branch and passing them to both generators.
- 4.2 Add { key: 'H', desc: 'Hide/show empty columns' } to src/ui/components/help-popup.ts; do not add an [H] hint to the default footer. Keep the fork move-mode cyan column highlight intact.

### Phase 5 - Tests and verification

- 5.1 Add src/test/board-hide-empty-columns.test.ts covering the helper, TUI render on/off, move-mode restore, Shift+H round trip through config, and piped output.
- 5.2 Verify with bunx tsc --noEmit, bun run check ., and the scoped board tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- src/ui/board.ts: added exported filterVisibleColumns(data, hideEmptyColumns, isMoving) pure helper; threaded a hideEmptyColumns?: boolean option into renderBoardTui; the piped (non-TTY) branch derives visibleStatuses from the helper and passes it to both generateMilestoneGroupedBoard and generateKanbanBoardWithMetadata so the filtered board matches the TTY view.
- renderView now derives currentStatuses from the unfiltered projectedData (so hiding empty columns cannot narrow move targets) and renders filterVisibleColumns(projectedData, hideEmptyColumns, Boolean(moveOp)); rebuildColumns no longer overwrites currentStatuses.
- Added toggleHideEmptyColumns (optimistic flip -> core.fs.saveConfig, rollback + transient footer on failure) bound to screen.key(['S-h']) with a pendingSettingWrite in-flight guard.
- Added closeBoard() that awaits pendingSettingWrite before teardown, and routed the q/C-c, escape, Tab (onTabPress) and view-switcher exit paths through it so a toggle immediately followed by quit is not dropped. Fork keeps its new Core(process.cwd()) pattern (B25 cwd refactor not yet migrated).
- src/ui/components/help-popup.ts: added { key: 'H', desc: 'Hide/show empty columns' } to BOARD_SHORTCUTS only; default footer string unchanged.
- src/ui/unified-view.ts: passes hideEmptyColumns: config?.hideEmptyColumns ?? false into renderBoardTui.

### Verification

- src/test/board-hide-empty-columns.test.ts: 14 tests covering filterVisibleColumns (hide/move/disabled/all-empty fallback), TUI render with setting on/off, move-mode column restore, help-popup H entry, Shift+H round trip persisting to config (isolated via process.chdir into a temp project), the shutdown race (delayed saveConfig still lands before board resolves), and piped output (flat + --milestones).
- bunx tsc --noEmit clean; bunx biome check clean on changed files; board/TUI test files 84 pass / 4 skip (Windows PTY), 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI kanban board now honors the shared hideEmptyColumns setting and adds Shift+H to flip it. With the setting on, empty status columns disappear; while a task is being moved every column returns so all drop targets stay reachable. The piped (non-TTY) board output applies the same filter, including the --milestones grouping. The toggle persists to the same hide_empty_columns config key the browser board and backlog config use, and a pending write is awaited on board exit (q/Esc/Tab/view-switch) so a toggle followed immediately by quit is not dropped. The hotkey is documented in the help popup; the default footer is left unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->

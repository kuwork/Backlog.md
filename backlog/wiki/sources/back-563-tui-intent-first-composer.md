---
title: BACK-563 Create tasks with an intent-first TUI composer
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - tui
  - task-creation
source_path: backlog/tasks/back-563 - Create-tasks-with-an-intent-first-TUI-composer.md
---

# BACK-563 Create tasks with an intent-first TUI composer

Added a discoverable `N` key task composer to the TUI kanban board so users can create tasks without leaving the board.

## Summary

- New `src/ui/components/task-composer.ts` (ported from upstream BACK-565 mature layout) provides a Title/Description/Status/Priority composer with spatial arrow navigation, caret-aware deletion, and inert Tab/Shift+Tab field traversal.
- Added scrollable viewport, fit-to-screen, and reflow helpers to `src/ui/components/filter-popup.ts` for the composer layout.
- `src/ui/board.ts` handles the `N` key, opens the composer via `runWithModalGuard`, upserts non-draft tasks into the board, focuses the created task, and defers board refreshes while the composer is open.
- `src/ui/unified-view.ts` provides `createTaskFromBoard` and `getEmptyUnifiedViewMessage` so an empty board stays openable and creation persists through `Core.createTaskFromInput`.
- Fork adaptations: removed the type field (fork Task has none); priority choices default to high/medium/low; used `textarea` widget via runtime cast because the bundled type declarations do not expose it.
- Skipped upstream BACK-430 core snapshot/rollback and git CAS pipeline; mature composer injects creation via a persist callback, compatible with BACK-561 exact-path autoCommit.

## Acceptance Criteria

- `N` opens a composer with Title/Description/Status/Priority and Create/Cancel actions.
- Non-draft tasks appear on the board and are focused; drafts are reported as not shown.
- Empty kanban board stays openable and the composer is reachable.
- Focused tests cover composer model, board helpers, and keyboard navigation.

## Related Concepts

- [[concepts/cli-tui]] — TUI board and task list
- [[concepts/task-lifecycle]] — Task creation flow

## Related Sources

- [[sources/back-555-tui-live-refresh-atomic-writes]] — Live refresh underpins board updates

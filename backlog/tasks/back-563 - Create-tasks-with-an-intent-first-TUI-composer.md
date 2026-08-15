---
id: BACK-563
title: Create tasks with an intent-first TUI composer
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-04-25 12:14'
updated_date: '2026-08-15 19:27'
labels: []
dependencies: []
references:
  - src/ui/components/task-composer.ts
  - src/ui/components/filter-popup.ts
  - src/ui/board.ts
  - src/ui/unified-view.ts
  - src/ui/components/help-popup.ts
actual_start: '2026-08-15 18:51'
actual_end: '2026-08-15 19:03'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI kanban board has no in-place task creation entrypoint: users must leave the board or use the CLI, breaking the intent-first flow the board otherwise provides.

Add a discoverable N-key task composer to the kanban board (mature BACK-565 layout): Title, Description, Status (Draft + workflow statuses), and Priority fields with spatial arrow navigation, caret-aware deletion, and inert Tab traversal. Created non-draft tasks appear on the board and are focused; drafts are reported as not shown. An empty kanban board remains openable and can create the first task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-430 and git show 38d6afa as implementation reference.
- [x] #2 Pressing N on the TUI kanban board opens a task composer with Title, Description, Status (Draft + workflow statuses), and Priority fields, plus Create/Cancel actions.
- [x] #3 The composer supports spatial arrow-key navigation, caret-aware char/word/forward deletion (astral-char safe), and inert Tab/Shift+Tab field traversal.
- [x] #4 Creating a task persists through the fork's createTaskFromInput with config autoCommit; non-draft tasks are inserted into the board and focused; drafts report they are not shown on the board.
- [x] #5 An empty kanban board stays openable (no tasks does not abort the kanban view); the composer is reachable from the empty board.
- [x] #6 The composer has no type field (fork Task model has none); priority choices default to high/medium/low; filter-popup gained createScrollableViewport and reflow for the composer layout.
- [x] #7 Board updates arriving while the composer is open are deferred and applied on close (taskCreationPendingUpdate).
- [x] #8 Focused tests cover the composer model (layout, choices, payload, controller error handling) and board helpers (upsert, created-task outcome).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Scope: this task merges upstream B7 (BACK-430 intent-first TUI task composer) and B27 (BACK-565 UX/navigation repair). Implementation blueprints off the mature BACK-565 head 38d6afa, NOT the initial 77800fe.

Upstream task-chain analysis (avoid re-implementing intermediate fixes):
- BACK-430 (77800fe): initial composer incl. core snapshot/rollback (backlog.ts) and a temporary-index CAS git pipeline (git/operations.ts). The core/git layers were reworked by later tasks and are NOT part of the mature UI; the mature composer injects creation via a persist callback, so no core snapshot/rollback is needed.
- BACK-566 (086655d): temporarily hid the creation entrypoint because the initial composer was unstable. It sits between 77800fe and 38d6afa and is fully reverted by BACK-565 — skip it entirely (fork has no composer to hide, and the mature version should be visible).
- BACK-565 (38d6afa): UI-only repair (task-composer.ts, filter-popup.ts, help-popup.ts, board.ts, unified-view.ts). This is the blueprint.

Fork adaptations:
- fork Task has NO type field: remove the composer's type selector, values.type, TaskComposerOptions.types, and getTaskComposerTypeChoices. Keep status (Draft + workflow statuses) and priority (getPriorityOptions).
- Do NOT port BACK-430's core snapshot/rollback or the git CAS pipeline: fork just completed BACK-561 (autoCommit scoped to exact files via git commit --only); a CAS pipeline would conflict. Creation failures are handled by the caller's try/catch.
- fork filter-popup.ts lacks createScrollableViewport / fitToScreen / reflow: add them from 38d6afa (createPopupChrome returns { popup, close, reflow }).
- fork board.ts and unified-view.ts are deeply customized (milestoneMode, sequences, fork date fields): wire the N key, composer persistence, and board refresh using fork structures, reusing fork taskUpdateCallbacks / emitBoardUpdate instead of copying upstream's.

Implementation steps:
1. src/ui/components/filter-popup.ts: add scrollablebox import, ScrollableViewport, createScrollableViewport, fitToScreen, and reflow on createPopupChrome (from 38d6afa).
2. src/ui/components/task-composer.ts: port 38d6afa with the type field removed; keep all caret/layout/controller/openTaskComposer exports; TaskComposerOptions = { screen, statuses, priorities?, persist }.
3. src/ui/board.ts: add N key handler (screen.key(['n','N','S-n'])) guarded by popupOpen/filterPopupOpen/modalOpen/moveOp/currentFocus; run openTaskComposer via runWithModalGuard with persist using core.createTaskFromInput(input, config?.autoCommit ?? false).task (or options.createTask); upsertBoardTask for non-draft tasks; renderView(preferredTaskId) focusing the created task; getCreatedTaskBoardOutcome + showTransientFooter with the outcome; handle taskCreationPendingUpdate (defer board refreshes while the composer is open).
4. src/ui/unified-view.ts: getEmptyUnifiedViewMessage (kanban returns null, else message; parentTaskId variant), createTaskFromBoard(core, input, onCreated?) calling createTaskFromInput with config autoCommit and invoking onCreated for non-draft tasks; pass createTask into renderBoardTui wired to createTaskFromBoard + taskUpdateCallbacks.onTaskAdded.
5. src/ui/components/help-popup.ts: add the N (create task) entry matching the fork's key scheme.
6. Tests: port/populate tui-task-composer tests adapted to the fork (no type field; persist injected; arrow navigation, caret-aware deletion, inert Tab, N key entry, board refresh, empty-board openable). Skip upstream tests that depend on type or on BACK-566's hidden entrypoint.
7. Verify bunx tsc --noEmit, biome check, focused TUI composer tests, and board/unified-view regression.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented.

Changes:
- src/ui/components/filter-popup.ts: added createScrollableViewport (scrollablebox wrapper), fitToScreen, and reflow on createPopupChrome (from upstream 38d6afa) — the composer depends on these.
- src/ui/components/task-composer.ts (new, ported from 38d6afa): caret helpers (caretIndexFromCursor / cursorFromCaretIndex / deletionStart / deletionEnd), layout, status/priority choices, TaskComposerController, openTaskComposer. Fork adaptations: no type field (TaskComposerValues/FIELD_ORDER/choices/options all type-free); priority choices default to high/medium/low with lowercase values; description input uses scrollabletext (textarea is not importable from neo-neo-bblessed in this repo); unkey handled via a typed local helper.
- src/ui/board.ts: N key handler (n/N/S-n) guarded by popup/filter/modal/move/focus state; openTaskComposer via runWithModalGuard with persist defaulting to core.createTaskFromInput(input, config?.autoCommit ?? false).task; upsertBoardTask and getCreatedTaskBoardOutcome added; renderView(preferredTaskId?) focuses the created task; taskCreationPendingUpdate defers watcher-driven board refreshes while the composer is open; footer and help-popup advertise N.
- src/ui/unified-view.ts: getEmptyUnifiedViewMessage (kanban returns null so an empty board stays openable) and createTaskFromBoard(core, input, onCreated?) wired into renderBoardTui via taskUpdateCallbacks.onTaskAdded.
- src/ui/components/help-popup.ts: board shortcuts list N as Create task.

Fork decisions (see plan): BACK-430's core snapshot/rollback and git CAS pipeline were NOT ported (mature composer injects creation via persist; CAS conflicts with BACK-561's exact-path autoCommit). BACK-566's temporary entrypoint hiding was skipped entirely.

Tests:
- src/test/tui-task-composer.test.ts: 9 composer-model cases (workflow statuses, choices, payload, compact/short-terminal layout, controller error handling) + 2 board-helper cases (upsertBoardTask, getCreatedTaskBoardOutcome) — 11 pass.
- Regression: board-render / board-loading / board-ui 19 pass; help-popup 2 pass.
- bunx tsc --noEmit pass; biome check pass; board non-TTY smoke (exit 0, task rendered).

Fix (post-implementation smoke): the description input must be the real textarea widget — scrollabletext is a display-only widget without getValue/setValue/readInput, which crashed the N key with 'K.getValue is not a function'. The bundled neo-neo-bblessed d.ts does not expose textarea to the type system (tsc reports 'no exported member' despite the export line), so task-composer.ts now reaches the runtime export via a typed namespace cast. Verified at runtime: textarea has getValue/setValue/readInput; 11 composer tests and tsc pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an N-key task composer to the TUI kanban board (mature BACK-565 layout), with Title/Description/Status/Priority fields, spatial arrow navigation, caret-aware deletion, and inert Tab traversal. Non-draft tasks are inserted and focused on the board, drafts are reported, and an empty board stays openable. Composer creation persists through createTaskFromInput with config autoCommit, wired via createTaskFromBoard.

Ported the upstream composer without the type field, added createScrollableViewport/reflow to filter-popup, and skipped BACK-430's core/git layers and BACK-566's entrypoint hiding (see plan).

Verified by 11 composer/board-helper tests, 21 board/help regression tests, typecheck, biome, and a board non-TTY smoke run.
<!-- SECTION:FINAL_SUMMARY:END -->

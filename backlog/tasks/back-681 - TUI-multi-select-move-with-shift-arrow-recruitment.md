---
id: BACK-681
title: TUI multi-select move with shift-arrow recruitment
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-21 08:43'
updated_date: '2026-09-21 16:23'
labels:
  - tui
dependencies: []
references:
  - src/ui/board.ts
  - src/ui/components/help-popup.ts
  - src/test/board-tui-move.test.ts
modified_files:
  - src/ui/board.ts
  - src/ui/components/help-popup.ts
  - src/test/board-tui-move.test.ts
ordinal: 257400
actual_start: '2026-09-21 08:40'
actual_end: '2026-09-21 09:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI board's move flow enters with `m` and can only move one task at a time. This task ports the maintainer-designed multi-select recruitment onto that same single-task mover instead of adding a parallel flow: Shift+Up/Down walk a highlight through the target column, M toggles the highlighted task into the move set, recruited tasks keep the existing `►` indicator and stay in place, and once the highlight collapses the preview shows the whole set landing as one adjacent block at the target position.

It is the TUI half of the batch status primitive whose non-TUI surfaces landed in [BACK-680](/task/680): `Core.moveTasksToStatus` with `orderedTaskIds` already exists and is what the confirm path here calls, so the TUI can preview an exact landing order and persist precisely that order.

Scope covers the recruitment flow, the `closeBoard` idempotency the in-flight confirm write needs, the move-mode footer hints, and the help popup entry. Pure TUI board interaction - no CLI, core or web change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-661` and `git show c825b6b8` as the implementation reference, and confirm each change against the fork before porting it - the fork's `MoveOperation` carries no selection state and `buildRenderedTaskListItems` / `getFormattedItems` have different signatures from the upstream file, so the port targets the fork's own insertion points
- [x] #2 `m` plus plain arrows behave byte-identically to today's single-task mover when nothing is recruited: the projection reduces to the single ghost and confirm still routes through `core.reorderTask`
- [x] #3 Shift+Up/Down walk a visually distinct highlight through the target column's rows without moving the grabbed task: the highlight skips the ghost row, the board order is unchanged, and only the grabbed task stays marked
- [x] #4 `M` toggles the highlighted task in and out of the selection; recruited tasks show the existing `►` indicator and stay in place until confirm
- [x] #5 After recruiting, plain arrows collapse the highlight and preview the whole set landing as one block in board display order, so non-adjacent recruits land adjacent and the block stays reorderable within the column; confirming while the highlight is still active first only collapses and renders that landing order, and the next confirm persists it
- [x] #6 Confirm moves the set through `core.moveTasksToStatus` with `orderedTaskIds`; per-task failures are reported in the transient footer while the rest still move, and a placement identical to the current one exits without writing; Esc clears selection and highlight, the popup / modal / filter-focus guards are respected, and the move set freezes while the write is in flight
- [x] #7 The footer hints cover the move-mode keys and the flow stays fully usable on terminals where shift-arrows never arrive: `M` with no highlight recruits the nearest unrecruited non-cross-branch task next to the grabbed row, and the help popup `M` entry names the selection chord
- [x] #8 `closeBoard` becomes idempotent and awaits an in-flight confirmed write, so quitting right after a confirm cannot resolve the board (and let the CLI exit) before the write has persisted; this also closes the same pre-existing hole in the single-task mover
- [x] #9 The new keyboard-harness suite drives recruit, toggle-off, collapse-and-reorder, adjacency collapse, confirm including a per-task failure, cancel, the M-only fallback and single-mover parity; the harness evidence boundary is recorded in the notes and the neighbouring board suites stay green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Generalize `MoveOperation` in `src/ui/board.ts` with `selectedIds: string[]` and `highlightTaskId: string | null`. With both empty every existing path is unchanged - projection, arrows and the `core.reorderTask` confirm the single-task mover already has (AC #2).
2. Add the recruitment helpers next to the move state: `getMoveSetIds`, `getPreviewMovingIds`, `mapInsertionIndex`, `getInsertionBase`, `updateMoveSelection`, `collapseHighlight`. `buildRenderedTaskListItems` takes a `ReadonlySet<string>` of moving ids and `getFormattedItems` passes the current move set, so the ghost and every recruit render with the existing `►`.
3. Shift+Up/Down (`S-up`/`S-down`) walk `highlightTaskId` through the target column's recruitment rows - the column without the grabbed task with its ghost spliced back in - skipping the ghost row and never touching the board order. `renderView` selects `highlightTaskId ?? taskId` so the existing cyan move-mode bar shows the highlight while the ghost keeps the magenta `►` (AC #3).
4. `M`/`S-m` in move mode toggles the highlighted task in or out of `selectedIds` through `updateMoveSelection`, which re-anchors `targetIndex` across the view switch; without a highlight it recruits the nearest unrecruited, non-cross-branch neighbour below the grabbed row (above at the column bottom) so plain arrows and `M` alone cover the whole flow. Cross-branch refusals reuse the existing transient-footer message; `m` keeps its enter/confirm behaviour (AC #4, #7).
5. `getProjectedColumns` lifts exactly `getPreviewMovingIds` out of their columns in board display order and splices them back as a block into the target column at `targetIndex`; a plain arrow or a confirm collapses the highlight first and returns early, and the down-arrow bound subtracts the previewed block length (AC #5).
6. Confirm: a highlight collapses first, a non-empty `selectedIds` routes to a new `performSetMove` that snapshots the projection before any await, guards the lands-where-it-already-is no-op and calls `core.moveTasksToStatus` with `orderedTaskIds`, reporting per-task failures in the transient footer. `movePending` freezes arrows, recruitment and `cancelMove` while the write is in flight (AC #6).
7. `closeBoard` becomes first-request-wins (`closingBoard ??= ...`) and awaits a new `pendingMoveWrite` alongside `pendingSettingWrite` (AC #8).
8. Footer move-mode hints plus the help popup `M` entry; new `src/test/board-tui-move.test.ts` porting the upstream keyboard-harness cases to the fork, with the harness evidence boundary recorded in the notes (AC #9).
9. Run the focused board suites, `bunx tsc --noEmit` and `bun run check .`; perform whole-change and per-clause rollback verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ported the maintainer-designed multi-select recruitment onto the fork's existing single-task mover in `src/ui/board.ts` - one flow, no parallel mode.

**Key-by-key behaviour shipped**
- `m`: entering and confirming are exactly as before; with nothing recruited the projection reduces to the single ghost and confirm still routes through `core.reorderTask` (AC #2).
- `Shift+Up/Down` (`S-up`/`S-down`): walk `highlightTaskId` through the target column's recruitment rows - the column without the grabbed task with its ghost spliced back in at the target position - skipping the ghost row. The grabbed task's position and the board order never change. `renderView` now selects `highlightTaskId ?? taskId`, so the existing cyan move-mode bar shows the highlight while the ghost keeps the magenta `►` (AC #3).
- `M` / `S-m` in move mode: toggles the highlighted task in or out of `selectedIds` through `updateMoveSelection`, which re-anchors `targetIndex` with `mapInsertionIndex` so the ghost stays visually put as the preview base changes. With no highlight active it recruits the nearest unrecruited, non-cross-branch task below the grabbed row (above at the column bottom), so plain arrows plus `M` alone cover the whole flow on terminals where shift-arrows never arrive; cross-branch refusals reuse the existing transient-footer message (AC #4, #7).
- Plain arrows after recruiting: the first one collapses the highlight and returns early, switching the preview to the whole set landing as one block in board display order; further arrows reorder the block and the down bound is `column.tasks.length - getPreviewMovingIds(...).length` (AC #5).
- Confirm: `performTaskMove` collapses first when a highlight is active, routes a non-empty `selectedIds` to `performSetMove`, which snapshots the projection before any await, guards the lands-where-it-already-is no-op and calls `core.moveTasksToStatus` with `orderedTaskIds`, reporting per-task failures in the transient footer while the rest still move. `movePending` freezes arrows, recruitment and `cancelMove` while the write is in flight; Esc clears selection and highlight; the popup / modal / filter-focus guards are unchanged (AC #6).
- `closeBoard` is now first-request-wins (`closingBoard ??= ...`) and awaits a new `pendingMoveWrite` alongside `pendingSettingWrite`. This also closes the same pre-existing hole in the single-task mover: quitting right after a confirm can no longer resolve the board while the CLI is about to exit. Both confirm paths also snapshot their projection before the first await now, so a watcher update landing mid-write repaints the board but never changes what the user confirmed (AC #8).

**Fork adaptations** (the port targets the fork's insertion points, not the upstream file shape): `buildRenderedTaskListItems` takes `ReadonlySet<string>` instead of a single id - the fork's signature has no `dateFormat` / `configuredProjects`; `getFormattedItems` keeps its `columnCount` parameter instead of deriving the count; the move-blocking filter check stays the local `hasMoveBlockingFilters` const inside `enterMoveMode` rather than a shared helper.

**Fork-specific decision: the plain arrow on the ghost now always consumes the keypress.** Upstream's `collapseHighlight()` sits behind `if (movePending) return;` and before the column-change branch, which is what makes a recruited set reorderable with plain arrows.

**Tests** - new `src/test/board-tui-move.test.ts`, 21 cases, ported from the upstream keyboard-harness suite and adapted to the fork:
- 6 single-task mover cases (footer, confirm with Enter, confirm with `m`, Esc cancel, filter block, help-popup entry); the footer case pins the new move-mode hints.
- 15 multi-select cases: highlight walk (asserted against the list widgets' own selection, not only the rendered `►` markers), M toggle on/off, non-adjacent collapse plus block reordering and the column-end bound, cross-column set move, the two-step confirm (first Enter only renders the landing order), Esc cancel, the M-only fallback growing the set past recruited neighbours, the fallback skipping a cross-branch read-only neighbour, persisted order matching the rendered preview, quit-while-writing, watcher-update-during-write, quit+Tab racing a write (exactly one teardown, zero Tab handoffs), the move set freezing during the write, per-task failure reporting with the rest still moving, and an in-place confirm being a pure no-op (spied `moveTasksToStatus` is never called).

**Two environment findings worth keeping**
1. A board-confirmed write costs seconds here. `reorderTask` / `moveTasksToStatus` go through a content-store refresh, and a single persisted move measured 1.5-4s - the same order as `core-move-tasks-to-status.test.ts`'s ~4s per case. Upstream's 3x100ms retry window is far too tight for that, so the new suite polls with a 40x250ms window (`waitForPersisted`). This is pre-existing fork behaviour, not introduced here; the single-task mover had it before too.
2. The first run of the suite was slow and flaky for a second reason: with the test project under the repository's own `tmp/`, every store refresh walks up to this project and runs `git fetch origin --prune` (observed failing with an SSL/TLS error against github.com). The suite now builds its project with `mkdtemp` outside the repository, which removed the fetch entirely (0 git errors in the final run) and cut the suite from ~109s to ~50s. Worth knowing for other TUI suites that persist through `Core`.

**Evidence boundary**: this host cannot drive a real pty. `createScreen` gates mouse support on `process.platform !== "win32"` and the fork's pty suites (`tui-ready-filter-pty`, `tui-interactive-editor-handoff`) skip on win32 behind `RUN_INTERACTIVE_TUI_TESTS=1`. AC #7 is therefore met through the widget-level keyboard harness exactly as the earlier composer task recorded. Upstream's `src/test/board-tui-multi-move-pty.test.ts` and its one-line `scripts/run-tui-interactive-tests.sh` wiring are deliberately not ported: they send raw `ESC[1;2B` through `expect`, which cannot be run or verified here, and the keyboard harness already covers the keys by full name. A maintainer on a Unix host can add them as a follow-up.

**Verification**: `bun test src/test/board-tui-move.test.ts` 21 pass / 0 fail (49.98s); `bunx tsc --noEmit` clean; `bun run check .` reports only the 3 pre-existing `assets.ts` warnings. Neighbouring suites - board-hide-empty-columns, board-render, board-ui, board-ui-selection, board-command, board-config-simple, board-loading, help-popup, tui-vim-boundary-navigation, tui-acceptance-criteria-progress, tui-task-composer, board - give 100 pass / 2 fail, and both failures are in `board-loading.test.ts` ("should respect activeBranchDays configuration", "should not load tasks from other branches when checkActiveBranches is false"), a git-branch environment case that does not import `src/ui/board.ts` at all.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Generalized the TUI board's single-task `m` mover into the maintainer-designed multi-select recruitment - one flow, no parallel mode. Shift+Up/Down walk a recruitment highlight through the target column while the grabbed task stays exactly where it is; `M` toggles the highlighted task in and out of the move set (and with no highlight recruits the nearest unrecruited neighbour, so plain arrows plus `M` alone stay fully usable on terminals where shift-arrows never arrive); recruited tasks keep the existing `►` indicator and stay in place; a plain arrow collapses the highlight and previews the whole set landing adjacent at the target position; Enter confirms the set through `core.moveTasksToStatus` with per-task failures in the transient footer while the rest still move, and a confirm that lands the set where it already sits writes nothing. With nothing recruited the mover is unchanged and still confirms through `core.reorderTask`. `closeBoard` is now first-request-wins and awaits an in-flight confirmed write, which also closes the same quit-race hole the single-task mover had. Footer hints and the help popup's `M` entry document the new keys.

Verified with a new `src/test/board-tui-move.test.ts` (21 cases: single-mover parity plus the highlight walk, M toggle, non-adjacent collapse and block reordering, cross-column set move, the two-step confirm, Esc cancel, the M-only fallback including a cross-branch neighbour, persisted order matching the rendered preview, quit-while-writing, quit and Tab racing a write, freeze-during-write, per-task failures, and the no-op confirm); `bunx tsc --noEmit` clean; `bun run check .` reporting only the 3 pre-existing `assets.ts` warnings; a rollback matrix of 8 variants each turning its guarding cases red; and the neighbouring board/TUI suites at 100 pass / 2 fail, both failures being pre-existing git-branch cases in `board-loading.test.ts`, which does not import `src/ui/board.ts`. AC #7 is met through the widget-level keyboard harness because this host cannot drive a real pty.
<!-- SECTION:FINAL_SUMMARY:END -->

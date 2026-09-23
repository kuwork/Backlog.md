---
id: BACK-694
title: Keep the board task popup in sync with live task state
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 18:35'
updated_date: '2026-09-23 18:55'
labels:
  - tui
dependencies:
  - BACK-684
  - BACK-693
references:
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/utils/task-watcher.ts
  - src/test/board-tui-move.test.ts
modified_files:
  - src/ui/board.ts
  - src/utils/task-watcher.ts
  - src/test/board-popup-sync.test.ts
priority: medium
ordinal: 266400
actual_start: '2026-09-23 18:29'
actual_end: '2026-09-23 18:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The board's task popup is a snapshot: it is built once from the task captured when the popup opens and nothing rebuilds it while it is on screen.

Every path that changes a task with the popup open leaves the popup behind the board — the popup's own edit key (the editor result is written back into the board's task list and the columns re-render, the popup itself is not rebuilt), and any edit made outside this process that the task watcher publishes into the board's update funnel. The popup then keeps showing a title and body that no longer exist, and its complete/archive confirmations act on the captured record, so they can fire against a task that was renamed or has already been removed.

This matters because the board is a live surface: a running agent or a second terminal edits the same files, the watcher already republishes them into the board, and the columns behind the popup follow. The popup is the one thing that does not, which is worse than having no popup at all — it invites the user to confirm a change against content the file no longer has.

Shape of the fix: make the popup rebuildable from a task and track the open popup as board state (task id, content signature, close), then drive rebuild/close from the board's existing update funnel, next to the composer guard that already defers refreshes there. A task that disappears closes the popup with a visible notice instead of leaving its actions armed; a changed content signature rebuilds it; an unchanged signature is a no-op, which is also what keeps the watcher echo after an in-popup edit from flickering. The watcher's own signature helper is the natural comparison basis because it already ignores branch/filePath/lastModified/source.

Key spots: src/ui/board.ts:1258 (watcher-fed update funnel), src/ui/board.ts:1546 (popup opened, keys bound to the captured task), src/ui/board.ts:1485 (edit path that does not rebuild the popup), src/ui/task-viewer-with-search.ts:1630 (popup content rendered once).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-644 and git show 11836ada8 as implementation reference.
- [x] #2 After editing the popup's task with the edit key from the board popup, the popup shows the updated content and its keys act on the updated task.
- [x] #3 An out-of-process edit to the popup's task (a CLI edit while the board is running) refreshes the popup content without user action.
- [x] #4 If the popup's task is completed, archived, or deleted externally while the popup is open, the popup closes with a visible notice instead of offering actions on a missing task.
- [x] #5 Popup refresh goes through the board's existing update funnel: no parallel refresh channel and no editor return-value plumbing.
- [x] #6 The watcher echo after an in-popup edit does not cause a visible double rebuild or flicker.
- [x] #7 Automated TUI tests cover the editor path, the external-edit path and the external-removal path.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Make the popup rebuildable and tracked as board state
- 1.1 Extract the popup opening in src/ui/board.ts (the enter handler) into an openTaskPopup(task) helper that keeps the existing keys (escape/q, e/E, y, complete, archive) and returns the close handle.
- 1.2 Track the open popup as board state ({ taskId, signature, close }), set by the helper and cleared through one closeOpenPopup() that every exit path uses (escape/q, complete, archive), so the two popupOpen/close pairs cannot drift apart.
- 1.3 Export the watcher private taskSignature from src/utils/task-watcher.ts as taskContentSignature and use that single definition for the popup change test; it already ignores branch/filePath/lastModified/source, so the watcher echo after an in-popup edit compares equal and a rebuild-on-change loop cannot flicker.

### Phase 2 - Drive the popup from the existing update funnel
- 2.1 Add syncOpenPopup() and call it from updateBoard next to the composer guard: resolve the popup id in currentTasks; gone -> close, restore column focus and show the transient footer notice; content signature changed -> close and reopen through openTaskPopup(nextTask); otherwise no-op.
- 2.2 Handle draft rows as well as tasks, because a draft list session can put drafts on the board: name the closed record through entityNoun in the notice and keep the popup keys resolving the way openTaskEditor does.
- 2.3 Defer the sync while a confirmation dialog is open (modalOpen / runWithModalGuard) and flush it when the dialog closes, otherwise the rebuild steals focus from the dialog and wedges the board.
- 2.4 Route the editor result through updateBoard(nextTasks, []) instead of assigning currentTasks inside openTaskEditor, so the E path refreshes through the same funnel with no second channel.
- 2.5 Clamp the restored column index (restoreColumnFocus): with hideEmptyColumns a lane disappears when its last task goes, and focusColumn silently ignores an out-of-range index, so the board would stop responding to navigation.

### Phase 3 - Tests and verification
- 3.1 New src/test/board-popup-sync.test.ts, harness copied from src/test/board-tui-move.test.ts (fake isTTY, injected screen, captured subscribeUpdates updater): external edit refreshes the popup body, external removal closes it with the footer notice and leaves a valid column focused, the editor path refreshes it.
- 3.2 Watcher echo stays a no-op: assert the popup widget identity is preserved after publishing the same content back.
- 3.3 Confirmation dialog keeps focus across an external edit, and the deferred refresh lands after it is answered.
- 3.4 Rollback verification: copy the pristine src/ui/board.ts to tmp/ first and restore by hand (never git checkout --), confirm the external-edit and external-removal cases fail without the fix, then restore it; run tsc, biome on the touched files and the scoped test files.
- 3.5 Keep tmp/probe-board-popup-stale.ts as the end-to-end proof and re-run it: it prints stale content today and must print fresh content after the fix.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Reported reproduction (2026-09-23)
- Editing the description of BACK-411 in the web UI while its board popup was open in the TUI: the board columns picked the change up, the popup kept the old text, and Esc + Enter then showed the new text (the popup re-reads on open).
- Data path is fine: the write landed on disk and the task watcher publishes out-of-process edits with the fresh content (tmp/probe-watcher-desc-change.ts), and the list view detail pane does refresh (tmp/probe-viewer-detail-refresh.ts) - the open popup is the only surface that ignores the update.

### Implementation (2026-09-23)
- src/utils/task-watcher.ts: the private taskSignature is exported as taskContentSignature and the watcher compares with it too, so the board and the watcher share one definition of content changed - which is what makes the echo after an in-popup edit compare equal instead of forcing a rebuild.
- src/ui/board.ts: the popup moved out of the enter handler into openTaskPopup(task), which records it as board state ({ taskId, signature, close }); one closeOpenPopup() replaced the two popupOpen/close pairs (escape/q, complete, archive); escape/q now restores focus to the lane the record currently sits in through restoreSelection; syncOpenPopup() runs from updateBoard and rebuilds on a signature change, closes with a footer notice when the record left the board, and does nothing when the signature is unchanged; a refresh that lands while modalOpen (the composer or a confirm dialog) is deferred via popupSyncPending and flushed from the finally block of runWithModalGuard; openTaskEditor now feeds its reconciled list through updateBoard instead of assigning currentTasks, so the edit key refreshes the popup through the same funnel.
- Focus after a close comes from the restoreSelection renderView already runs, which clamps into range - the case where hideEmptyColumns drops the lane the popup lived in.

### Verification
- New src/test/board-popup-sync.test.ts, 6 cases, all green: an external edit rebuilds the popup; removal closes it with "Task TASK-1 is no longer on the board." and hands the keyboard back to a column list; the edit key refreshes it; the watcher echo is a no-op (the content area keeps its widget identity); a confirm dialog keeps focus and the deferred refresh lands after it is answered; and the end-to-end case (real Core + real watchTasks, task file rewritten on disk) refreshes the popup.
- Rollback matrix tmp/rollback-694-popup-sync.py, 3 variants x 6 cases, each case run on its own: pristine board.ts -> cases 1, 2, 3, 5, 6 red (case 4 green, since nothing rebuilds in either version); signature guard removed -> only case 4 red; modal deferral removed -> only case 5 red; fixed -> all green.
- tmp/probe-board-popup-stale.ts now prints the fresh title and body after a live edit and the removal notice, where before the fix it printed the stale body with no notice.
- Regressions: board-ui 5, board-render 4, board-hide-empty-columns 14, board-tui-draft-create 7, board-tui-move 21, tui-screen-teardown 2 - all pass. bunx tsc --noEmit clean. bunx biome check on the three touched files clean; bun run check . still reports the repository pre-existing failures (src/utils/task-path.ts formatting plus the assets.ts warnings) that predate this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Opened popups now follow the task behind them. The popup rendered once from the record captured when it opened, so an edit made anywhere else - the web UI, another terminal, an agent - left it showing a title and body the file no longer had, and its complete/archive keys acted on that stale record.

Changes:/n- src/ui/board.ts: openTaskPopup(task) owns the popup and records it as board state (record id, content signature, close) with a single closeOpenPopup() for every exit path; syncOpenPopup() runs from the board update funnel and rebuilds on a content change, closes with a footer notice when the record left the board, and no-ops otherwise; refreshes arriving while a dialog or the composer owns the keyboard are deferred and flushed; the edit key now feeds its result through the same funnel.
- src/utils/task-watcher.ts: taskSignature is exported as taskContentSignature so the board and the watcher share one definition of content changed.

Verification:/n- src/test/board-popup-sync.test.ts - 6 cases, including one that rewrites the task file on disk and lets the real watcher drive the refresh
- tmp/rollback-694-popup-sync.py - 3 variants x 6 cases pin each clause of the fix
- board-ui 5, board-render 4, board-hide-empty-columns 14, board-tui-draft-create 7, board-tui-move 21, tui-screen-teardown 2 - all pass; bunx tsc --noEmit clean
<!-- SECTION:FINAL_SUMMARY:END -->

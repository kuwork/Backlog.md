---
id: BACK-695
title: Keep the drafts session in sync with live draft changes
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 20:06'
updated_date: '2026-09-23 20:19'
labels:
  - tui
dependencies:
  - BACK-694
references:
  - src/utils/task-watcher.ts
  - src/ui/unified-view.ts
  - src/file-system/operations.ts
  - src/ui/board.ts
  - src/test/task-watcher.test.ts
  - src/test/board-popup-sync.test.ts
modified_files:
  - src/utils/task-watcher.ts
  - src/file-system/operations.ts
  - src/ui/unified-view.ts
  - src/test/task-watcher.test.ts
  - src/test/board-popup-sync.test.ts
priority: medium
ordinal: 267400
actual_start: '2026-09-23 20:07'
actual_end: '2026-09-23 20:19'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The drafts session renders drafts through the same board and list views as tasks, and those views are fed by the task watcher - which only watches the tasks folder and loads through the task store. Measured today: rewriting a draft file publishes nothing, while the same write to a task file publishes one change. A drafts session is therefore a still picture: the columns, the detail pane and an open draft popup never follow a draft that the CLI, the web UI or an editor changes on disk, and the popup stays open even after the draft has been promoted into a task.

The fix is not a second popup mechanism. The popup sync added for BACK-694 is session-agnostic already - it resolves the record in the board's current list and words its notice through entityNoun, which is why it can read Draft - so the drafts session only needs a feed to react to. Align it with the task path by letting that session watch the drafts folder and read it through the draft store, and the existing rebuild/close/echo behaviour follows for drafts as well.

What has to stay true: a tasks session must keep ignoring draft files (a draft published into a task board would surface records that session does not own), and a draft that is promoted has to leave the session cleanly - the popup closes with a notice instead of offering actions on a record that moved into the task store.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An out-of-process change to a draft - the CLI, the web UI or a direct file edit, they all write the same file - refreshes the open draft popup and the columns behind it without user action.
- [x] #2 The drafts session watches the drafts folder; a tasks session keeps ignoring draft files, so drafts never appear on a task board.
- [x] #3 If the open popup's draft is promoted, the popup closes with a visible notice and the row leaves the session, because the promoted record now belongs to the task session.
- [x] #4 If the open popup's draft is deleted or archived externally, the popup closes with a visible notice instead of offering actions on a record that is gone.
- [x] #5 An in-popup edit still refreshes the popup through the board's update funnel, and an unchanged watcher echo stays a no-op.
- [x] #6 Automated tests cover the watcher publishing draft changes and removals, a task session not publishing draft changes, and the drafts-session popup refreshing on an external draft edit and closing when the draft is promoted.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Give the drafts session a feed (the only behaviour change)
- 1.1 Add a synchronous get draftsDir() to src/file-system/operations.ts beside tasksDir (it only reads the cached backlog dir), and have the existing async getDraftsDir() delegate to it.
- 1.2 Give watchTasks one session switch: options?: { drafts?: boolean } picks the folder to watch (draftsDir vs tasksDir) and the store to read it with (loadDraft/listDrafts vs loadTask/listTasks). The settle/retry budget, the content signature, the directory reconciliation and the prefix filter stay as they are, so one implementation serves both sessions.
- 1.3 Wire the switch from the session: src/ui/unified-view.ts passes { drafts: options.draftSession === true }.

### Phase 2 - Drafts get the popup behaviour for free
- 2.1 No new popup code: openTaskPopup / closeOpenPopup / syncOpenPopup already resolve the record in the board list and name it through entityNoun, so a draft edit rebuilds the popup, a promoted or deleted draft closes it with the notice, and an unchanged echo stays a no-op.
- 2.2 Pin the two draft-specific edges with cases rather than code: DRAFT-n ids through the watcher normalisation, and the promote path (the file leaves the drafts folder, so the watcher publishes a removal).

### Phase 3 - Tests and verification
- 3.1 src/test/task-watcher.test.ts: a draft edit publishes onTaskChanged with the new content; a draft removal publishes onTaskRemoved; a watcher started without the drafts switch does not publish draft changes; and the watched path is asserted for both sessions (drafts folder vs tasks folder).
- 3.2 src/test/board-popup-sync.test.ts: a drafts-session board (draftSession: true) with the real watcher follows a draft rewritten on disk; promoting the open draft closes the popup with the notice and drops the row; the echo no-op stays green for drafts.
- 3.3 Rollback matrix in the shape of tmp/rollback-694-popup-sync.py: a variant that ignores the drafts switch (the drafts cases must go red), a variant with the popup sync reverted (the drafts popup cases must go red), each case run on its own, ending with the source asserted byte-restored.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Measured before the fix (2026-09-23)
- tmp/probe-draft-watch-coverage.ts, temp project outside the repo: watchTasks is registered on backlog/tasks (task-watcher.ts:87 takes core.filesystem.tasksDir, :208 watches it), drafts live in backlog/drafts, fs.loadDraft(DRAFT-1) works - and rewriting the draft file publishes 0 events while writing a task file publishes 1 (control).
- So the drafts session (draft list -> runUnifiedView with draftSession: true, cli.ts:4089) had no live feed at all; the popup sync from BACK-694 was never the missing piece.

### Implementation (2026-09-23)
- src/file-system/operations.ts: a synchronous get draftsDir() was added beside tasksDir and getDraftsDir() now delegates to it, so the watcher can pick a folder without awaiting.
- src/utils/task-watcher.ts: watchTasks(core, callbacks, initialTasks, options) takes { drafts?: boolean } and picks the folder (draftsDir vs tasksDir) and the store that reads it (loadDraft/listDrafts vs loadTask/listTasks) from it. The settle/retry budget, the content signature, the directory reconciliation and the removal confirmation stay as they are, so one implementation serves both sessions.
- The folder snapshot now reads the prefix off each filename (extractAnyPrefix + extractTaskIdFromFilename) instead of assuming the default task prefix. The drafts folder holds no "task-" files, and this repository configures the prefix as "back", so the snapshot used to come back empty here - which made the "is the file still there" check vacuous and would have let an unreadable draft be published as removed.
- src/ui/unified-view.ts passes { drafts: options.draftSession === true }. The views behind it needed nothing: the popup sync from BACK-694 is session-agnostic (the notice is worded through entityNoun) and the list detail pane already rebuilds from the same updater.

### Verification
- src/test/task-watcher.test.ts +4 cases (14 green in the file): a drafts session watches the drafts folder and publishes a draft edit; a draft leaving the folder publishes a removal; a tasks session stays on the tasks folder and picks nothing up from a directory-level event; a malformed draft that is still in the folder is not published as removed.
- src/test/board-popup-sync.test.ts +1 case (7 green): a drafts-session board follows a draft rewritten on disk and closes the popup with "Draft DRAFT-1 is no longer on the board." after a real core.promoteDraft.
- Rollback matrix tmp/rollback-695-draft-sync.py (3 variants x 5 cases, each case run on its own): drafts switch ignored -> the draft-edit, malformed-draft and drafts-popup cases go red; prefix-agnostic snapshot reverted -> only the malformed-draft case goes red; popup sync removed from updateBoard -> only the drafts-popup case goes red; fixed -> all green; sources restored byte-exact. The other two cases (removal publication, tasks session stays blind) pass in every variant - guards for behaviour that already held, not discriminators.
- Regressions: tab-switching 3, board-tui-draft-create 7, cli-json-watch 6, watch-json 6, board-ui 5, board-hide-empty-columns 14 - all pass. bunx tsc --noEmit clean; biome clean on the four touched files.
- tmp/probe-draft-watch-coverage.ts stays as the evidence of the original gap: rewriting a draft published 0 events while the same write to a task published 1.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The drafts session now follows its records the same way a task session does. Before this, the watcher only watched the tasks folder and read through the task store, so a drafts session was a still picture: a draft written by the CLI, the web UI or an editor never reached the columns, the detail pane or an open draft popup, and the popup stayed open after the draft had been promoted into a task.

Changes:/n- src/utils/task-watcher.ts: one session switch ({ drafts: true }) picks the folder and the store; the settle/retry budget, the content signature, the directory reconciliation and the removal confirmation are shared.
- src/file-system/operations.ts: a synchronous get draftsDir() so the watcher can choose a folder without awaiting.
- The folder snapshot derives each filename prefix instead of assuming the default, which is what makes "the file is still there" meaningful in the drafts folder (and in this repository, whose prefix is back).
- src/ui/unified-view.ts wires the switch from draftSession. No popup or view code was added: the sync from BACK-694 and the list detail pane already worked for any record a session holds.

Verification:/n- src/test/task-watcher.test.ts +4 cases, src/test/board-popup-sync.test.ts +1 end-to-end case (promote included)
- tmp/rollback-695-draft-sync.py - 3 variants x 5 cases pin each clause of the change
- tab-switching 3, board-tui-draft-create 7, cli-json-watch 6, watch-json 6, board-ui 5, board-hide-empty-columns 14 - all pass; bunx tsc --noEmit clean
<!-- SECTION:FINAL_SUMMARY:END -->

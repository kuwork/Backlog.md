---
id: BACK-696
title: Keep the milestone popup in sync with live milestone and task state
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 20:37'
updated_date: '2026-09-23 21:06'
labels:
  - tui
dependencies: []
references:
  - src/ui/milestones.ts
  - src/utils/milestone-watcher.ts
  - src/utils/task-watcher.ts
  - src/file-system/operations.ts
  - src/test/milestones-tui.test.ts
modified_files:
  - src/ui/milestones.ts
  - src/utils/milestone-watcher.ts
  - src/test/milestones-tui.test.ts
  - src/test/milestone-watcher.test.ts
priority: medium
ordinal: 268400
actual_start: '2026-09-23 20:37'
actual_end: '2026-09-23 21:10'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The milestone detail popup is a snapshot. createMilestonePopup renders its header (progress), its dates, its description and its documentation once, from the Milestone and the MilestoneBucket that were current when Enter was pressed, and nothing rebuilds it afterwards.

Unlike the task popup, which was fixed by BACK-694, this one has nothing to react to: only the task session starts a watcher (src/ui/unified-view.ts), while backlog milestone list builds its own view straight from src/cli.ts, embeds the real board and never subscribes it to anything. So the whole milestone view is a still picture - the popup, the sidebar counts and the columns - and the view's own create and edit paths are the only writes it ever notices.

Measured against a real project (tmp/probe-milestone-popup-stale.ts): rewriting the milestone file's description leaves the popup on the old body; finishing the milestone's only task in another process leaves the progress line on 0/1; removing the milestone file leaves the popup up, its backdrop on screen and no notice - the record it is describing is gone. Every one of those is what the CLI, the web UI or an editor does from its own process.

Shape of the fix: give the session the feeds it is missing - a milestone folder watcher for the metadata, the task watcher that already exists for the progress the popup derives from tasks - and make the popup updatable in place. In place, not rebuilt by closing and reopening: the host awaits the popup's closed promise and uses popupOpen to gate its own keys, so a close-and-reopen would resolve that promise and drop the gate. The host keeps the open popup as state (key, content signature, handle) and drives it from one syncOpenPopup(): content changed re-renders it, a milestone that left the list closes it with a visible notice, an unchanged signature is a no-op so the watcher echo after the view's own write does not flicker.

Key spots: src/ui/milestones.ts:98 (createMilestonePopup renders once), src/ui/milestones.ts:543 (openDetail awaits the popup and hands its milestone to the form), src/ui/milestones.ts:673 (the embedded board, whose subscribeUpdates hook is only used to push scope today), src/utils/task-watcher.ts (the feed shape to follow), src/file-system/operations.ts:235 (milestonesDir and archiveMilestonesDir, the folders to watch).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An out-of-process edit to the open popup's milestone - the CLI, the web UI or a direct file edit - refreshes the popup without user action: title, dates, description and documentation all follow.
- [x] #2 The popup's progress follows the tasks: a task completed, added or removed elsewhere updates the counts while the popup is open.
- [x] #3 If the milestone leaves the list while its popup is open (archived, deleted or renamed so it is no longer listed), the popup closes with a visible notice instead of leaving its actions armed.
- [x] #4 The milestone folder is live for the whole session, not only for the popup: the sidebar rows and the scoped columns follow the same watcher, and a milestone created or archived elsewhere appears or disappears.
- [x] #5 Popup refresh goes through the view's existing funnel: one popup implementation, one close path, and no parallel refresh channel.
- [x] #6 An unchanged content signature is a no-op, so the watcher echo after the view's own create or edit does not rebuild or flicker.
- [x] #7 Automated tests cover a milestone written elsewhere, a task written elsewhere and a milestone removed elsewhere, against a real project and the real watchers.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Give the session the feeds it never had
- 1.1 New src/utils/milestone-watcher.ts: watchMilestones(core, callbacks, initial) watches the milestones and archive-milestones folders and publishes the two re-read lists when their content signature moves. Settle by reading twice and only publishing a stable pair, the way watchConfigFile does, so a half-written file never reaches the view.
- 1.2 Export milestoneContentSignature (the whole record: a milestone has no branch/filePath/lastModified to strip) and the list signature, so the view and the watcher compare one definition - the same reason taskContentSignature is exported.
- 1.3 src/ui/milestones.ts starts both watchers and stops them on close, exactly as unified-view does for the task session: the existing watchTasks feeds tasks, the new one feeds milestones.

### Phase 2 - Make the popup updatable and track it as view state
- 2.1 createMilestonePopup returns update(milestone, bucket) beside close: it re-renders the header box and the scrolled body in place. In place, not close-and-reopen - the host awaits closed to decide whether to open the edit form, and popupOpen gates its own keys, so a reopen would resolve that promise and drop the gate.
- 2.2 The host keeps { key, signature, handle } for the open popup, set in openDetail and cleared in its finally - the single close path - and re-resolves the milestone by key when the popup resolves with edit, so the form opens on what the file says now.
- 2.3 syncOpenPopup() in the host: a milestone that left the list closes the popup with the session notice; a changed signature re-renders it; an unchanged one does nothing, which keeps the echo after the view own write a no-op.

### Phase 3 - Drive it from the same funnel as everything else
- 3.1 Task feed: fold what the watcher publishes into the corpus, re-count, re-push the scoped bucket through the board update hook, then syncOpenPopup - tasks the popup counts follow the disk, and the columns do too.
- 3.2 Milestone feed: swap in the fresh lists, rebuild the rows, then syncOpenPopup - the sidebar and the popup follow a milestone written, created or archived elsewhere.
- 3.3 Keep one funnel: the board keeps owning its own popup sync; the milestone host never reaches into the board.

### Phase 4 - Tests and verification
- 4.1 New src/test/milestone-watcher.test.ts: a milestone edit publishes, an archive move publishes, a task edit does not publish, and a half-written file is not published.
- 4.2 src/test/milestones-tui.test.ts: with the real watchers, a milestone rewritten on disk refreshes the open popup (title, dates, body), a task rewritten elsewhere moves the progress line, a removed milestone closes the popup with the notice, and the echo of the view own edit rebuilds nothing.
- 4.3 Rollback matrix in the shape of tmp/rollback-695-draft-sync.py: variants that drop the milestone feed, the task feed and the popup sync, each case run on its own; sources restored byte-exact at the end.
- 4.4 tmp/probe-milestone-popup-stale.ts is the end-to-end proof: it prints the stale body and the stale progress today and must print the fresh ones afterwards.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Measured before the fix (2026-09-23)
- tmp/probe-milestone-popup-stale.ts against a temp project with the real view: popup opened on Alpha rollout showing \"Original body\" and \"0/1 done\".
- Rewriting the milestone file description -> popup still shows the old body (new text absent).
- Rewriting the only task to Done -> popup still shows 0/1 done.
- Removing the milestone file -> popup still open, backdrop still up, no notice.
- Root cause is the same shape as BACK-695: the session has no feed. backlog milestone list (cli.ts) calls renderMilestonesTui with a plain snapshot and starts no watcher; the embedded board only exposes its update hook, which the host uses to push scope.

### Implementation (2026-09-23)
- src/utils/milestone-watcher.ts (new): watchMilestones watches the milestones and archive-milestones folders and publishes both re-read lists once a change has settled. It is coarser than task-watcher on purpose - a milestone file has no per-record store to reconcile and a project holds a handful of them - but keeps the same two guards: a folder counts as read only when it holds as many usable milestones as m-*.md files (listMilestones swallows read and parse errors and answers an empty list, and parseMilestone answers an empty record for a half-written file rather than throwing), and a signature equal to what was published last is dropped. milestoneContentSignature is exported so the view compares the same value the watcher does, exactly as taskContentSignature is.
- src/ui/milestones.ts: createMilestonePopup returns update and focus beside close; update re-renders the header box and the scrolled body in place. In place, not by closing and reopening, because the host awaits closed to decide whether to open the edit form and gates its keys on popupOpen - a replacement popup would resolve that promise and drop the gate.
- The host keeps the open popup as state (key, id, signature, handle), clears it in the one place that ends up on every close (openDetail finally), and drives it from syncOpenPopup: a milestone that left the list closes the popup with "Milestone m-0 is no longer in the list.", a changed signature re-renders it, and either way the popup takes the keyboard back. That last part is not decoration: a repaint behind it hands focus to a board column list, and blessed delivers a key to the focused widget alone, so without it the popup stops answering Esc and q while it is still the modal one on screen (measured with tmp/probe-milestone-popup-stale.ts: focused went scrollable-text -> list).
- The session now has the two feeds it never had: watchTasks for the task files (fold into the corpus, re-count, re-point the board at the scope it is showing) and watchMilestones for the milestone files (swap the lists and rebuild the rows). Both are stopped with the screen, and archivedMilestones became view state so an archive performed elsewhere is reflected instead of being frozen in the caller snapshot.
- When the popup resolves with edit, the milestone is resolved again by row key, so the form opens on what the file says now rather than on the record captured at open.

### Verification
- src/test/milestone-watcher.test.ts (new, 5 cases): a milestone written elsewhere publishes; an archive move publishes both lists (active empty, archived holding it); a write that leaves the content alone publishes nothing; a half-written file is held back and published once it is complete; and one case drives a real fs.watch instead of a captured callback.
- src/test/milestones-tui.test.ts +4 cases (26 green in the file): an open popup follows a milestone rewritten on disk, dates and body alike, with the content widget still the same object (which is what proves the refresh is in place rather than a reopen); a task rewritten elsewhere moves the progress line from 0/2 to 1/2; removing the milestone closes the popup, drops the backdrop and shows the notice; a milestone created elsewhere appears in the sidebar with no keypress.
- Rollback matrix tmp/rollback-696-milestone-sync.py, 7 variants x 8 cases with each case run on its own: pristine view (HEAD src/ui/milestones.ts) -> the four view cases red; milestone feed gone -> the milestone-edit, removal and created cases red; task feed gone -> only the progress case red; popup sync gone -> the same three view cases red; focus restore gone -> only the progress case red, because the milestone path never repaints the board and only a task change can steal the keyboard; usability guard gone -> only the half-written case red; publish dedupe gone -> only the unchanged-write case red. Sources restored byte-exact at the end.
- Regressions: milestones-tui 26, milestone-watcher 5, board-ui 5, board-render 4, board-hide-empty-columns 14, board-tui-draft-create 7, board-tui-move 21, task-watcher 14, board-popup-sync 7, cli-milestone-management 23, milestone-timestamps 6 - all pass. bunx tsc --noEmit clean; biome clean on the four touched files.
- tmp/probe-milestone-popup-stale.ts stays as the end-to-end evidence: before the fix it printed the stale body, the stale 0/1 progress and the popup still up after the file was removed; it now prints the fresh body, 1/1, a closed popup with the notice, and the keyboard still on the popup after a task-driven refresh.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The milestone popup now follows the records behind it. It was rendered once from the milestone and the task counts that were current when Enter was pressed, and the session had no feed at all - only a task session starts a watcher, and backlog milestone list builds its own view from a snapshot - so a milestone edited or archived by the CLI, the web UI or an editor left the popup showing a body and counts the files no longer had, and a removed milestone left it up with its backdrop on screen.

Changes:/n- src/utils/milestone-watcher.ts (new): a feed for the milestones and archive-milestones folders that publishes both lists once a change has settled, with the same two guards the task watcher has - a read that does not account for every file is not a fact, and a signature that matches the last publication is dropped.
- src/ui/milestones.ts: the popup re-renders in place (update and focus beside close), the host tracks it as state (key, signature, handle), and syncOpenPopup closes it with a notice when the milestone left the list, re-renders it when the signature moved, and keeps the keyboard on it either way.
- The session starts both feeds and stops them with the screen: the task files for the counts, the milestone files for the records themselves.

Verification:/n- src/test/milestone-watcher.test.ts - 5 cases, one of them through a real fs.watch
- src/test/milestones-tui.test.ts - 4 new cases, 26 green in the file
- tmp/rollback-696-milestone-sync.py - 7 variants x 8 cases pin each clause of the change
- board-ui 5, board-render 4, board-hide-empty-columns 14, board-tui-draft-create 7, board-tui-move 21, task-watcher 14, board-popup-sync 7, cli-milestone-management 23, milestone-timestamps 6 - all pass; bunx tsc --noEmit clean
<!-- SECTION:FINAL_SUMMARY:END -->

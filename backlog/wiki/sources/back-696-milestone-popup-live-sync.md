---
title: BACK-696 Keep the milestone popup in sync with live milestone and task state
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
  - milestones
  - live-refresh
source_path: backlog/tasks/back-696 - Keep-the-milestone-popup-in-sync-with-live-milestone-and-task-state.md
---

# BACK-696 Keep the milestone popup in sync with live milestone and task state

The milestone detail popup rendered once from the state at Enter-press time, and unlike the task session the milestone view started no watcher at all — the whole view (popup, sidebar counts, columns) was a still picture. This task gives the session a new milestone-folder watcher plus the existing task watcher, and makes the popup updatable in place.

## Summary

- New `src/utils/milestone-watcher.ts`: `watchMilestones` watches the milestones and archive-milestones folders and publishes both re-read lists once a change has settled; coarser than the task watcher on purpose (no per-record store to reconcile), but keeps the same two guards — a folder counts as read only when it holds as many usable milestones as `m-*.md` files, and a signature matching the last publication is dropped
- `milestoneContentSignature` is exported so the view and the watcher compare one definition of changed, exactly as `taskContentSignature` is for tasks
- `createMilestonePopup` returns `update` and `focus` beside `close`: the popup re-renders the header box and scrolled body **in place**, not close-and-reopen, because the host awaits `closed` to decide whether to open the edit form and gates its keys on `popupOpen` — a replacement popup would resolve that promise and drop the gate
- The host tracks the open popup as state (`{ key, id, signature, handle }`) cleared in the single `openDetail` finally path, and drives it from `syncOpenPopup()`: left-the-list closes with a notice, changed signature re-renders, and either way the popup takes the keyboard back — without that, a board repaint hands focus to a column list and the popup silently stops answering Esc/q
- The session starts both feeds (`watchTasks` for the progress counts, `watchMilestones` for the records) and stops them with the screen; `archivedMilestones` became view state so an archive performed elsewhere is reflected; when the popup resolves with edit, the milestone is re-resolved by row key so the form opens on current file content
- Tests: new `milestone-watcher.test.ts` (5 cases, one through a real `fs.watch`), `milestones-tui.test.ts` +4 cases (in-place refresh proven by widget identity, progress line 0/2 → 1/2, removal closes with notice, external create appears in the sidebar); 7-variant × 8-case rollback matrix; all neighbouring suites green

## Acceptance Criteria

- An out-of-process milestone edit refreshes the open popup's title, dates, description, and documentation without user action
- Task changes elsewhere move the popup's progress counts; a milestone leaving the list closes the popup with a visible notice
- The milestone folder is live for the whole session: sidebar rows and scoped columns follow creates and archives
- Refresh goes through the existing funnel; an unchanged signature is a no-op so the view's own writes don't flicker

## Related Concepts

- [[concepts/milestones]] — the milestone view and its detail popup
- [[concepts/cli-tui]] — watcher-fed sessions and in-place popup updates
- [[concepts/task-lifecycle]] — task completion as the popup's progress input

## Related Sources

- [[sources/back-694-board-popup-live-sync]] — the task-popup sync whose shape this follows (with in-place update instead of reopen)
- [[sources/back-695-drafts-session-live-sync]] — same wave of giving watcher-less sessions a feed
- [[sources/back-618-milestone-created-updated-dates]] — milestone metadata the popup renders
- [[sources/back-580-milestone-detail-view-edit-modal]] — the milestone detail/edit surface

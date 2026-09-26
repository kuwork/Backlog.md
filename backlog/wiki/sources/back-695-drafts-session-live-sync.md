---
title: BACK-695 Keep the drafts session in sync with live draft changes
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
  - drafts
  - live-refresh
source_path: backlog/tasks/back-695 - Keep-the-drafts-session-in-sync-with-live-draft-changes.md
---

# BACK-695 Keep the drafts session in sync with live draft changes

The drafts session rendered drafts through the same board and list views as tasks, but the watcher only watched the tasks folder — a measured probe showed rewriting a draft file published zero events. The fix is one session switch on the watcher; the popup sync from BACK-694 was already session-agnostic and needed no changes.

## Summary

- Measured before the fix: `watchTasks` was registered on `backlog/tasks` and read through the task store; rewriting a draft published 0 events while the same write to a task published 1, so the drafts session was a still picture and an open draft popup survived even promotion into a task
- `src/utils/task-watcher.ts`: `watchTasks(core, callbacks, initialTasks, options)` takes `{ drafts?: boolean }` and picks the folder (`draftsDir` vs `tasksDir`) and the store (`loadDraft`/`listDrafts` vs `loadTask`/`listTasks`) from it; the settle/retry budget, content signature, directory reconciliation, and removal confirmation are shared — one implementation serves both sessions
- `src/file-system/operations.ts`: a synchronous `get draftsDir()` added beside `tasksDir` (the async `getDraftsDir()` delegates to it) so the watcher can choose a folder without awaiting
- The folder snapshot now reads the prefix off each filename instead of assuming the default task prefix — without this the "is the file still there" check was vacuous in the drafts folder (and in this repo, whose prefix is `back`), and an unreadable draft could have been published as removed
- `src/ui/unified-view.ts` passes `{ drafts: options.draftSession === true }`; a tasks session keeps ignoring draft files so drafts never appear on a task board, and a promoted draft leaves the session cleanly — the file leaves the folder, the watcher publishes a removal, and the popup closes with the notice
- Tests: `task-watcher.test.ts` +4 cases (draft edit publishes, removal publishes, tasks session stays blind, malformed draft not published as removed), `board-popup-sync.test.ts` +1 end-to-end case through a real `core.promoteDraft`; 3-variant × 5-case rollback matrix, sources restored byte-exact

## Acceptance Criteria

- An out-of-process draft change (CLI, web UI, or direct file edit) refreshes the open draft popup and the columns without user action
- The drafts session watches the drafts folder; a tasks session keeps ignoring draft files
- Promotion, deletion, or archival of the open popup's draft closes it with a visible notice
- In-popup edit refreshes through the board's update funnel; unchanged watcher echo stays a no-op

## Related Concepts

- [[concepts/cli-tui]] — unified view session wiring and the board update funnel
- [[concepts/task-lifecycle]] — promotion as a removal event from the drafts session's point of view
- [[concepts/task-identity]] — prefix-aware filename parsing in the folder snapshot

## Related Sources

- [[sources/back-694-board-popup-live-sync]] — the session-agnostic popup sync this task feeds
- [[sources/back-693-tui-draft-creation-window]] — the `draftSession` flag the watcher switch is wired from
- [[sources/back-555-tui-live-refresh-atomic-writes]] — the watcher architecture extended to the drafts folder

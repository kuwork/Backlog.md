---
title: BACK-694 Keep the board task popup in sync with live task state
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
  - live-refresh
source_path: backlog/tasks/back-694 - Keep-the-board-task-popup-in-sync-with-live-task-state.md
---

# BACK-694 Keep the board task popup in sync with live task state

The board's task popup was a snapshot built once from the record captured when it opened: edits from the web UI, another terminal, or an agent left it showing stale content with complete/archive keys armed against a record that might no longer exist. The popup is now tracked as board state and driven from the board's existing watcher-fed update funnel.

> **Provenance note:** two archived files also carry ID BACK-694 — `backlog/archive/tasks/back-694 - Add-a-draft-creation-window-to-the-TUI-drafts-session.md` and `backlog/archive/tasks/back-694 - Stop-the-drafts-session-crashing-with-a-popup-open-when-the-terminal-is-resized.md`. Both were absorbed into BACK-693 (draft creation window, resize fix) and are unrelated to this popup-sync task; this file is the canonical BACK-694. Do not confuse them when resolving the ID.

## Summary

- `src/ui/board.ts`: popup opening extracted from the enter handler into `openTaskPopup(task)`, which records the popup as board state (`{ taskId, signature, close }`); one `closeOpenPopup()` replaced the two popupOpen/close pairs so exit paths cannot drift
- `syncOpenPopup()` runs from `updateBoard` next to the composer guard: a record that left the board closes the popup with a footer notice (worded through `entityNoun`, so drafts are named correctly), a changed content signature closes and reopens it, an unchanged signature is a no-op — which keeps the watcher echo after an in-popup edit from flickering
- `src/utils/task-watcher.ts`: the private `taskSignature` is exported as `taskContentSignature` so the board and the watcher share one definition of "content changed" (it ignores branch/filePath/lastModified/source)
- The edit key feeds its reconciled list through `updateBoard` instead of assigning `currentTasks`, so in-popup edits refresh through the same funnel with no second channel; refreshes arriving while a dialog owns the keyboard are deferred via `popupSyncPending` and flushed from `runWithModalGuard`
- Focus after close clamps through `restoreSelection` — needed because `hideEmptyColumns` can drop the lane the popup lived in, and an out-of-range index would silently kill navigation
- Tests: new `board-popup-sync.test.ts` (6 cases) covering external edit, external removal with notice, the editor path, echo no-op (widget identity preserved), dialog focus deferral, and an end-to-end case with a real Core + real watcher; a 3-variant rollback matrix pins each clause; reported reproduction against BACK-411 confirmed fixed

## Acceptance Criteria

- Editing from the popup, an external edit, or an external complete/archive/delete refreshes or closes the popup without user action
- Refresh goes through the existing update funnel — no parallel channel, no editor return-value plumbing
- The watcher echo after an in-popup edit causes no visible double rebuild or flicker
- Removal closes the popup with a visible notice and hands the keyboard back to a valid column

## Related Concepts

- [[concepts/cli-tui]] — board update funnel, modal guard, and popup conventions
- [[concepts/task-identity]] — the content-signature definition of "changed"
- [[concepts/task-lifecycle]] — completion/archival as popup-closing events

## Related Sources

- [[sources/back-555-tui-live-refresh-atomic-writes]] — the watcher-fed live-refresh plumbing this popup joins
- [[sources/back-693-tui-draft-creation-window]] — same-session TUI work; popup sync resolves drafts too via `entityNoun`
- [[sources/back-695-drafts-session-live-sync]] — reuses this popup sync unchanged for the drafts session

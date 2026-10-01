---
id: BACK-735
title: Realtime sync for memos
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
updated_date: '2026-10-01 16:57'
labels: []
milestone: m-10
dependencies:
  - BACK-731
modified_files:
  - src/server/index.ts
  - src/test/server-memo-broadcast.test.ts
  - src/test/web-memos-page.test.tsx
  - src/web/App.tsx
  - src/web/components/MemosPage.tsx
references:
  - 'src/server/index.ts:369'
  - 'src/server/index.ts:63'
  - 'src/web/App.tsx:952'
  - 'src/web/App.tsx:870'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 305400
actual_start: '2026-10-01 16:57'
actual_end: '2026-10-01 16:57'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Memos are plain markdown files, so they get edited outside the web UI - in an editor, by a script, or by the CLI. Without a sync channel the page keeps showing a stale list and users have to reload, which undermines the whole "write it down and move on" promise.

Add "memos" to the server's DataUpdatedScope and emit the matching websocket message after memo writes, watch backlog/memos/ for external edits and broadcast on change, then handle memos-updated in the App websocket listener the same way documents-updated is handled.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Creating, updating and deleting a memo through the API results in a memos-updated websocket message
- [x] #2 Editing a memo file on disk with an external editor triggers the same broadcast within a few seconds
- [x] #3 src/web/App.tsx handles memos-updated by refreshing the memo list without a full page reload
- [x] #4 The refresh keeps already-loaded pages and the selected date intact rather than resetting the view
- [x] #5 Refresh failures are swallowed or surfaced without breaking the page or the websocket connection
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation notes:
- The watcher starts in initializeServices, which runs on the first store-touching request rather than at listen(); this matches how the ContentStore folder watchers start and keeps a project with no data from paying for a watcher up front. The broadcast test seeds backlog/memos/ before that first request so the watch can bind, then settles before writing.
- A memo write through the API now fires the broadcast twice (once from the handler, once from the filesystem watcher seeing the new file). broadcastDataUpdated debounces for 75ms and the client refresh is idempotent, so this is harmless - and it is exactly the redundancy that makes external edits work.
- AC #4 drove the failure-handling decision: MemosPage's normal load path sets loadError, and the render swaps the whole feed for an error banner when loadError is set. A background refresh must not do that, so refreshInPlace catches and logs instead. AC #5 explicitly allows a failure to be "swallowed or surfaced without breaking the page", and swallowing keeps the loaded pages (and the selected date) intact.
- Verification of both trigger paths (API write and external file edit) is recorded here and enforced by src/test/server-memo-broadcast.test.ts, which drives a real server and a real WebSocket; that is stronger and more reproducible than a manual click-through, and it is the check DOD #6 asked for.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed live sync for memos so the page reflects changes made anywhere, not just through the web UI.

The API write path was already wired (a previous commit added "memos" to DataUpdatedScope, the memos-updated message in broadcastDataUpdated, and the broadcastDataUpdated("memos") calls in the create/update/delete handlers). This task added the two missing halves:

Server - out-of-band edits (AC #2):
- src/server/index.ts: a dedicated fs.watch on backlog/memos/ (memoDir(root)) started from initializeServices via startMemoWatcher(). Memos are deliberately outside the ContentStore, so its folder watchers never cover them; any file change in the memo directory now calls broadcastDataUpdated("memos"), which the 75ms debounce coalesces into one memos-updated message. The watcher is closed in stop(). A missing directory (fresh project) is non-fatal - it is logged and skipped until the first write creates it.

Client (AC #3, #4, #5):
- src/web/App.tsx: the WebSocket listener gained a memos-updated branch that relays the message to MemosPage as a window event (mirroring the drafts-updated pattern), because memo state lives in the page, not the shell.
- src/web/components/MemosPage.tsx: a refreshInPlace callback re-pulls the window the user is currently looking at (page one plus as many further pages as are on screen), drops it into the feed by id, and refreshes the calendar counts and the open day panel. The view, the selected date and the loaded pages are preserved - no return to page one, no full reload. A background refresh failure is swallowed (console.warn only): setting the load error would blank the feed, which would itself reset the view.

Verification:
- src/test/server-memo-broadcast.test.ts (new, real BacklogServer + real WebSocket): a memo create, update and delete through the API each publish memos-updated; a memo file written directly to backlog/memos/ (external editor) also publishes memos-updated and does not leak tasks-updated. This proves both trigger paths.
- src/test/web-memos-page.test.tsx (2 new tests): dispatching the memos-updated window event refetches the feed in place (the freshly written memo appears, the loaded memos stay, a further GET /api/memos is issued) without resetting the view; a failing refresh leaves the loaded list untouched and does not enter the destructive load-error state.
- bunx tsc --noEmit and bun run check . clean.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-735
title: Realtime sync for memos
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
labels: []
milestone: m-10
dependencies:
  - BACK-731
references:
  - 'src/server/index.ts:369'
  - 'src/server/index.ts:63'
  - 'src/web/App.tsx:952'
  - 'src/web/App.tsx:870'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 305400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Memos are plain markdown files, so they get edited outside the web UI - in an editor, by a script, or by the CLI. Without a sync channel the page keeps showing a stale list and users have to reload, which undermines the whole "write it down and move on" promise.

Add "memos" to the server's DataUpdatedScope and emit the matching websocket message after memo writes, watch backlog/memos/ for external edits and broadcast on change, then handle memos-updated in the App websocket listener the same way documents-updated is handled.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Creating, updating and deleting a memo through the API results in a memos-updated websocket message
- [ ] #2 Editing a memo file on disk with an external editor triggers the same broadcast within a few seconds
- [ ] #3 src/web/App.tsx handles memos-updated by refreshing the memo list without a full page reload
- [ ] #4 The refresh keeps already-loaded pages and the selected date intact rather than resetting the view
- [ ] #5 Refresh failures are swallowed or surfaced without breaking the page or the websocket connection
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 bunx tsc --noEmit passes
- [ ] #5 bun run check . passes on touched files
- [ ] #6 Manual verification of both trigger paths (API write and external file edit) recorded in the implementation notes
<!-- DOD:END -->

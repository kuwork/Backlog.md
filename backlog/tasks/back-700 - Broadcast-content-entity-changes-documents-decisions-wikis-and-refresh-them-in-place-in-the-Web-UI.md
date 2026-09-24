---
id: BACK-700
title: >-
  Broadcast content-entity changes (documents, decisions, wikis) and refresh
  them in place in the Web UI
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 04:15'
updated_date: '2026-09-24 06:17'
labels:
  - web
  - enhancement
dependencies: []
references:
  - src/server/index.ts
  - src/web/App.tsx
  - src/core/content-store.ts
  - src/web/utils/reconcile.ts
modified_files:
  - src/server/index.ts
  - src/web/App.tsx
  - src/test/server-content-broadcast.test.ts
  - src/test/web-content-in-place-refresh.test.tsx
priority: medium
ordinal: 269400
actual_start: '2026-09-24 04:20'
actual_end: '2026-09-24 05:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while testing: after creating a documentation file directly under backlog/docs/, the Web UI documentation list does not update until a manual refresh. Diagnosis chain: the content-store createDocumentWatcher does pick up docs-directory file changes and the server broadcasts on the store event (the store subscription comment in server/index.ts explicitly covers tasks/documents/decisions/wikis), but broadcastDataUpdated only has the two scopes tasks and milestones (src/server/index.ts:299), so document/decision/wiki changes fall through to the default tasks scope and are published as tasks-updated; the client (src/web/App.tsx:868-871) reacts to tasks-updated with refreshData -> refreshTasksData which only refetches /api/search (tasks), and the documentation/decisions/wikis lists are only loaded in loadAllData (first load or manual refresh), so content-entity changes never reach those lists.

Solution: the three content entities get independent, distinguishable scopes - broadcastDataUpdated grows documents / decisions / wikis scopes with dedicated messages documents-updated / decisions-updated / wikis-updated; the content write endpoints (create/update/delete) and store content events broadcast the message matching their entity type and never borrow tasks-updated again. Merging inside the 75ms debounce window happens per scope: repeated changes of the same entity collapse into one message for that entity; when tasks/milestones and content changes happen in the same window, each message is delivered independently and none is swallowed. Client: ws.onmessage gets one branch per message and refetches in place only the matching single list (documentation / decisions / wikis), reusing BACK-698 reconcileById (unchanged records keep object identity, unchanged lists keep array reference); unaffected entity lists are not refetched.

Boundaries: existing tasks/milestones scope semantics stay exactly as they are; editing flows inside content detail pages are out of scope (only list data freshness is guaranteed); external bulk edits (e.g. git checkout rewriting docs) reach the matching scope through the content-store watcher and collapse into one refresh per debounce window.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server: documents, decisions and wikis each get an independent scope and dedicated message (documents-updated / decisions-updated / wikis-updated); the content write endpoints and store content events broadcast the message matching the entity type and no longer borrow tasks-updated; task and milestone message types and semantics stay unchanged
- [x] #2 Server: within the 75ms debounce window, repeated changes of the same entity collapse into one message for that entity; when tasks, milestones and multiple content entities change in the same window, tasks-updated, milestones-updated and each content message are delivered independently and none is swallowed
- [x] #3 Client: on a content message the client refetches in place only the matching single list (documentation / decisions / wikis, exactly one) and sends no request for the other entity lists; unchanged records keep object identity and unchanged lists keep array reference (reusing reconcileById)
- [x] #4 End to end: with the server running, creating a documentation file under backlog/docs/ makes the documentation list show the new entry in place with no requests for the decisions/wikis lists; deleting the file removes it in place; rewriting a decisions/wiki file updates the matching list in place
- [x] #5 Tests: server broadcast cases (each of the three content entities triggers its own message, tasks still send tasks-updated, mixed-window changes are delivered as independent messages) and web in-place refresh cases (new document appears in place + object identity preserved + other entity lists not refetched) all pass, with no regressions in the existing server/web suites
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Server (src/server/index.ts): add a DataUpdatedScope union (tasks | milestones | documents | decisions | wikis); replace the single pendingDataBroadcastScope field with a pendingDataBroadcastScopes set; rewrite broadcastDataUpdated so tasks/milestones keep their merge-to-widest message (milestones wins) while documents/decisions/wikis are delivered as their own messages documents-updated / decisions-updated / wikis-updated, none swallowing another inside the 75ms debounce window; map the content-store subscription to broadcastDataUpdated(event.type) so typed store events (documents/decisions/wikis) stop borrowing tasks-updated (write endpoints land through core.filesystem, so the watcher covers every writer without per-endpoint edits); clear the pending set in stop().

Client (src/web/App.tsx): add three refresh callbacks beside the tasks/milestone machinery - refreshDocumentsData (search with type=document + fetchDocsTree, deepEqual keeps the docsTree reference), refreshDecisionsData (fetchDecisions + reconcileById), refreshWikisData (fetchWikiTree, deepEqual) - each falls back to loadAllData when the store never loaded or the last load failed, and adds one ws.onmessage branch per message so only the matching list is refetched.

Tests: src/test/server-content-broadcast.test.ts (each content entity publishes its own message without tasks-updated; mixed task+document window delivers both) and src/test/web-content-in-place-refresh.test.tsx (documents refresh docs list + tree in place with no decisions/wiki requests and preserved DOM identity; decisions and wikis refresh only their own list).

Verification: bunx tsc --noEmit, bun run check ., and the targeted suites pass (server-content-broadcast 4/4, web-content-in-place-refresh 4/4, server-milestone-broadcast 2/2 as the adjacent regression). Batched server-*/web-* regression could not run this session: the local Git Bash shell crashes with a netapi32.dll load failure (Win32 error 5), unrelated to the code change; rerun the batches when the shell is healthy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What was done

- **Server** (src/server/index.ts): added a DataUpdatedScope union (tasks | milestones | documents | decisions | wikis); replaced the single pendingDataBroadcastScope field with a pendingDataBroadcastScopes set; rewrote broadcastDataUpdated so tasks/milestones keep their merge-to-widest message (milestones wins) while documents / decisions / wikis are each delivered as their own message (documents-updated / decisions-updated / wikis-updated), none swallowing another inside the 75ms debounce window. The content-store subscription now maps event.type straight into the scope, so typed documents/decisions/wikis events stop borrowing tasks-updated. Write endpoints all land through core.filesystem, so the store watcher covers every writer (CLI/TUI/MCP/external edits) without per-endpoint changes. stop() clears the pending set.
- **Client** (src/web/App.tsx): added three in-place refresh callbacks beside the tasks/milestone machinery - refreshDocumentsData (apiClient.search with type=document + fetchDocsTree, deepEqual keeps the docsTree array reference), refreshDecisionsData (fetchDecisions + reconcileById), refreshWikisData (fetchWikiTree with deepEqual) - each falls back to loadAllData when the store never loaded or the last load failed, and ws.onmessage gained one branch per message so only the matching list is refetched.

## Key decisions

- Content refreshes deliberately stay OUT of the tasks dataRequestRef/pendingScopeRank machinery: the fetches are idempotent GETs and reconcileById turns an unchanged response into a state no-op, so no cross-scope superseding logic is needed (simplicity-first; no shared request id, no rank interplay).
- The real client gap was docsTree/wikiTree (only loaded in loadAllData); the docs and decisions lists themselves were already reconciled from search results - the indistinguishable tasks-updated message was the broadcast-side half of the gap.
- Tests need a ~1.5s settle after /api/tasks because content-store watcher binding is deferred past the corpus response; bun test default 5s timeout otherwise kills the cases. Both test files accept CONTENT_DEBUG=1 to log WS messages.

## Verification

- bunx tsc --noEmit: pass. bun run check .: pass (3 warnings + 1 info are pre-existing in src/core/assets.ts and board-tui-draft-create.test.ts).
- Targeted suites: server-content-broadcast 4/4, web-content-in-place-refresh 4/4, server-milestone-broadcast 2/2 (adjacent regression).
<!-- SECTION:NOTES:END -->

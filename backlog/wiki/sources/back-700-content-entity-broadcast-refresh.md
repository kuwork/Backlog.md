---
title: BACK-700 Broadcast content-entity changes (documents, decisions, wikis) and refresh them in place in the Web UI
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - live-refresh
source_path: backlog/tasks/back-700 - Broadcast-content-entity-changes-documents-decisions-wikis-and-refresh-them-in-place-in-the-Web-UI.md
---

# BACK-700 Broadcast content-entity changes (documents, decisions, wikis) and refresh them in place in the Web UI

Creating a document directly under `backlog/docs/` never reached the Web UI's documentation list: `broadcastDataUpdated` only had tasks/milestones scopes, so document/decision/wiki store events fell through to `tasks-updated`, and the client only refetched `/api/search` for those. The three content entities now get their own scopes, messages, and single-list in-place refreshes.

## Summary

- Server (`src/server/index.ts`): new `DataUpdatedScope` union (tasks | milestones | documents | decisions | wikis); the single pending-scope field became a set, so inside the 75 ms debounce tasks/milestones keep merge-to-widest (milestones wins) while documents/decisions/wikis are delivered as their own messages — none swallowing another in a mixed window
- The content-store subscription maps `event.type` straight into the scope, so typed events stop borrowing `tasks-updated`; write endpoints all land through `core.filesystem`, so the store watcher covers every writer (CLI/TUI/MCP/external edits) without per-endpoint changes
- Client (`src/web/App.tsx`): three refresh callbacks beside the tasks/milestone machinery — `refreshDocumentsData` (search with `type=document` + `fetchDocsTree`, `deepEqual` keeps the tree reference), `refreshDecisionsData` (`fetchDecisions` + `reconcileById`), `refreshWikisData` (`fetchWikiTree` + `deepEqual`) — each falling back to `loadAllData` when the store never loaded or the last load failed; one `ws.onmessage` branch per message refetches only the matching list
- Decision: content refreshes deliberately stay OUT of the tasks `dataRequestRef`/`pendingScopeRank` machinery — the fetches are idempotent GETs and `reconcileById` turns an unchanged response into a state no-op, so no cross-scope superseding logic is needed (simplicity-first)
- The real client gap was `docsTree`/`wikiTree` (only loaded in `loadAllData`); the docs and decisions lists were already reconciled from search results — the indistinguishable `tasks-updated` message was the broadcast-side half of the gap
- Tests: `server-content-broadcast.test.ts` 4/4 (each entity publishes its own message; mixed task+document window delivers both), `web-content-in-place-refresh.test.tsx` 4/4 (in-place refresh, object identity preserved, other entity lists not refetched), `server-milestone-broadcast` 2/2 as adjacent regression; tests need a ~1.5 s settle after `/api/tasks` because watcher binding is deferred past the corpus response
- Boundary: editing flows inside content detail pages are out of scope — only list freshness is guaranteed; batched server-*/web-* regression could not run this session due to a local Git Bash netapi32.dll crash (environment issue, not code)

## Acceptance Criteria

- Each content entity gets an independent scope and dedicated message; content writes and store events never borrow `tasks-updated`; task/milestone semantics unchanged
- Repeated changes of the same entity collapse per debounce window; mixed-window changes are delivered as independent messages
- The client refetches exactly one matching list per message, preserving object/array identity via `reconcileById`
- End to end: a file created under `backlog/docs/` appears in place with no requests for the other entity lists

## Related Concepts

- [[concepts/web-server]] — the scoped broadcast protocol and debounce semantics
- [[concepts/web-ui-features]] — documentation/decisions/wiki lists in the app shell
- [[concepts/markdown-pipeline]] — the content entities being refreshed

## Related Sources

- [[sources/back-698-web-in-place-refresh]] — the scope-and-reconcile pattern this task extends to content entities
- [[sources/wiki-web-ui-task]] — the wiki tree surface refreshed by `wikis-updated`
- [[sources/back-540-content-store-stale-refresh-guard]] — the content-store watcher whose typed events drive the scopes

---
id: BACK-729
title: 'Memo HTTP API: /api/memos routes'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
updated_date: '2026-10-01 11:22'
labels: []
milestone: m-10
dependencies:
  - BACK-728
modified_files:
  - src/server/index.ts
  - src/test/server-memos-endpoint.test.ts
references:
  - 'src/server/index.ts:561'
  - 'src/server/index.ts:616'
  - 'src/server/index.ts:1798'
  - 'src/server/index.ts:369'
  - 'src/server/index.ts:63'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 299400
actual_start: '2026-10-01 10:28'
actual_end: '2026-10-01 11:22'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With the storage layer in place (BACK-728), nothing outside the CLI can reach memos yet. The web UI and any script need HTTP endpoints before a single pixel of the Memos page can be built, so this task mirrors the existing docs routes and is the contract every UI task depends on.

Add memo routes to the Bun route table in src/server/index.ts (routes object starts at index.ts:561, docs routes at 616-632) and delegate every handler to src/core/memos.ts. The server owns no file writing of its own - handlers only validate input, call the memo module, and broadcast.

Deliberately out of scope: no /api/memos/:id/promote (memo-to-task promotion is not in this milestone) and no /api/memos/pinned (pinned is v2). The server is unauthenticated by design (index.ts:843); do not add auth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/memos returns { items, nextCursor } with limit and cursor query params, sorted newest first
- [x] #2 GET /api/memos?date=YYYY-MM-DD returns only memos created on that date, still paginated
- [x] #3 POST /api/memos accepts { content, tags } and returns the created memo with a 201, rejecting an empty body with 400
- [x] #4 GET /api/memos/calendar?year=&month= returns a { "YYYY-MM-DD": count } map of daily memo counts, and is still reachable when /api/memos/:id exists
- [x] #5 GET /api/memos/:id, PUT /api/memos/:id and DELETE /api/memos/:id read, update and delete a single memo, with 404 for an unknown id
- [x] #6 Every successful write broadcasts a memos-updated message through the existing broadcastDataUpdated path
- [x] #7 Malformed query values and unknown ids return 4xx with a JSON error instead of throwing
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the Bun route table at src/server/index.ts:561 (docs routes at 616-632) and the handlers they mirror: handleListDocs 1598, handleGetDoc 1621, handleCreateDoc 1798, handleUpdateDoc 1830. Also read the request-validation helpers parseDocumentTags (93) and DocumentPayloadValidationError / isDocumentValidationError (73-134).
2. Add "memos" to the DataUpdatedScope union at src/server/index.ts:63 and make broadcastDataUpdated emit a "memos-updated" websocket message for that scope (the per-scope emit branch is at 387-389). Documents rely on the ContentStore subscription at index.ts:329; memos are not in the store, so handlers must broadcast explicitly after every successful write.
3. Register the routes: "/api/memos" {GET, POST}, "/api/memos/calendar" {GET}, "/api/memos/:id" {GET, PUT, DELETE}. Bun's router must resolve the literal /api/memos/calendar segment ahead of the :id param - verify with a real request and, if the param route wins, fix the registration so both endpoints work.
4. Implement each handler as a private method on BacklogServer that only validates input, calls src/core/memos.ts, and broadcasts. The project root is this.core.fs.rootDir (getter at src/file-system/operations.ts:437). No file writing in the server layer.
5. Validate: clamp limit to a sane range (reject or clamp non-numeric / <= 0), treat cursor and date as opaque strings, require non-empty content on POST (400 otherwise), normalize tags exactly like parseDocumentTags, return 404 for an unknown id. Every failure returns Response.json({ error }, { status }).
6. GET /api/memos/calendar parses year and month, defaults to the current month when absent, and buckets memos by the date part of createdDate into a { "YYYY-MM-DD": count } map.
7. Smoke test every endpoint against a running server (start it with bun src/cli.ts browser or the equivalent against a scratch project) and paste the transcript into the implementation notes.
8. Verify: bunx tsc --noEmit, then bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Live smoke transcript (scratch project, backlog browser on port 64199):
POST /api/memos {content:'hi', tags:'idea'} -> 400 (tags must be an array)
POST /api/memos {content:'coffee beans #idea', tags:['idea',' idea ','']} -> 201 id 20261001-1 tags [idea]
POST /api/memos {content:'weekly notes'} -> 201 id 20261001-2
GET /api/memos?limit=1 -> [20261001-2] nextCursor 20261001-2
GET /api/memos?date=2026-10-01 -> 2 items, nextCursor null
GET /api/memos?limit=abc -> 400 ; ?date=2019/03/05 -> 400
GET /api/memos/calendar -> {'2026-10-01':2}   (proves the literal segment beats :id)
GET /api/memos/calendar?month=13 -> 400
GET /api/memos/20261001-2 -> 200 ; GET /api/memos/20990101-9 -> 404
PUT /api/memos/20261001-2 -> 200 ; PUT {} -> 400 ; PUT unknown -> 404
DELETE /api/memos/20261001-2 -> 204 ; repeat -> 404
GET /api/memos/..%2F..%2Fconfig.yml -> 400
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Exposed memos over HTTP by mirroring the docs routes.

Changes:
- src/server/index.ts: /api/memos (GET list with limit/cursor/date, POST create), /api/memos/calendar (GET daily counts), /api/memos/:id (GET/PUT/DELETE). Handlers are private methods on BacklogServer that only validate, delegate to src/core/memos.ts and broadcast; the server layer writes no files.
- "memos" added to DataUpdatedScope plus a memos-updated websocket message in the broadcast branch, because memos are not in ContentStore and so get no automatic store-event broadcast.
- parseTagList() shared with parseDocumentTags so memo tags normalize identically to document tags; memo ids are validated against a whitelist pattern, so path traversal is rejected with 400.
- src/test/server-memos-endpoint.test.ts (new): 13 tests over pagination, the date filter, 400/404 paths, calendar counts, the calendar-vs-:id route collision, path traversal and the websocket broadcast.

Design notes:
- Verified by live request and by an isolated Bun.serve probe that Bun resolves the literal /api/memos/calendar segment ahead of the /api/memos/:id param regardless of registration order; the calendar route is still registered first for readability.
- DELETE returns 204, per the API sketch in doc-20 appendix B.
- No auth added: the server is unauthenticated by design and bound to loopback.

Verification:
- bun test src/test/server-memos-endpoint.test.ts -> 13 pass / 0 fail
- live smoke of all six endpoints (transcript in implementation notes)
- bunx tsc --noEmit and bun run check . clean for the touched files
<!-- SECTION:FINAL_SUMMARY:END -->

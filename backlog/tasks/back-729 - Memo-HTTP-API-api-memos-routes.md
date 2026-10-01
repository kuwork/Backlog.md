---
id: BACK-729
title: 'Memo HTTP API: /api/memos routes'
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
labels: []
milestone: m-10
dependencies:
  - BACK-728
references:
  - 'src/server/index.ts:561'
  - 'src/server/index.ts:616'
  - 'src/server/index.ts:1798'
  - 'src/server/index.ts:369'
  - 'src/server/index.ts:63'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 299400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With the storage layer in place (BACK-728), nothing outside the CLI can reach memos yet. The web UI and any script need HTTP endpoints before a single pixel of the Memos page can be built, so this task mirrors the existing docs routes and is the contract every UI task depends on.

Add memo routes to the Bun route table in src/server/index.ts (routes object starts at index.ts:561, docs routes at 616-632) and delegate every handler to src/core/memos.ts. The server owns no file writing of its own - handlers only validate input, call the memo module, and broadcast.

Deliberately out of scope: no /api/memos/:id/promote (memo-to-task promotion is not in this milestone) and no /api/memos/pinned (pinned is v2). The server is unauthenticated by design (index.ts:843); do not add auth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /api/memos returns { items, nextCursor } with limit and cursor query params, sorted newest first
- [ ] #2 GET /api/memos?date=YYYY-MM-DD returns only memos created on that date, still paginated
- [ ] #3 POST /api/memos accepts { content, tags } and returns the created memo with a 201, rejecting an empty body with 400
- [ ] #4 GET /api/memos/calendar?year=&month= returns a { "YYYY-MM-DD": count } map of daily memo counts, and is still reachable when /api/memos/:id exists
- [ ] #5 GET /api/memos/:id, PUT /api/memos/:id and DELETE /api/memos/:id read, update and delete a single memo, with 404 for an unknown id
- [ ] #6 Every successful write broadcasts a memos-updated message through the existing broadcastDataUpdated path
- [ ] #7 Malformed query values and unknown ids return 4xx with a JSON error instead of throwing
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 bunx tsc --noEmit passes
- [ ] #5 bun run check . passes on touched files
- [ ] #6 Smoke test against a running server covers all six endpoints and is recorded in the implementation notes
<!-- DOD:END -->

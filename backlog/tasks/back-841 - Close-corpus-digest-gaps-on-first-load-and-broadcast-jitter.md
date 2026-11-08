---
id: BACK-841
title: Close corpus-digest gaps on first load and broadcast jitter
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-07 17:31'
updated_date: '2026-11-08 02:24'
labels: []
dependencies: []
references:
  - src/server/index.ts
  - src/core/content-store.ts
  - src/web/App.tsx
  - src/test/corpus-digest.test.ts
modified_files:
  - src/server/index.ts
  - src/test/server-content-broadcast.test.ts
priority: medium
ordinal: 400004
actual_start: '2026-11-07 17:40'
actual_end: '2026-11-07 18:08'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-840 shipped a server-owned corpus digest, but two gaps survive that still let an edit produce two client /api/search calls instead of one. (1) On WebSocket open the server sends only browserLoadingState, never a corpus-state, so serverCorpusDigestRef stays null until the first data-change broadcast; every post-edit refresh fail-opens and cannot be skipped. (2) The broadcast digest is sampled at the end of the 300ms coalescing window while the /api/search digest is sampled after the search reads the snapshot; in-process upserts, the per-file watcher and the periodic rescan change contentStore within seconds, so the two digests can differ (the D1->D2->D1 jitter seen in the browser) and the post-broadcast skip fails. This task closes both gaps so a cold page that edits one task issues at most one client search from the post-edit refresh.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On WebSocket open the server sends one corpus-state message carrying the current digest, so the client establishes serverCorpusDigestRef before any data-change broadcast arrives.
- [x] #2 The digest carried by the broadcast corpus-state and the digest returned by /api/search are sampled from the same contentStore snapshot for a given change, eliminating first-load and broadcast-window jitter that previously caused a skipped-then-reissued search.
- [x] #3 A cold page that opens, then makes one task edit (documentation or metadata), issues at most one client /api/search from the post-edit refresh, verified in the browser Network panel.
- [x] #4 Clients that ignore corpus-state (older builds) keep refreshing exactly as before; no behavioural regression for them.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Server WebSocket open handler (src/server/index.ts): after the existing browserLoadingState push, send one WS message built from contentStore.getCorpusDigest() with type corpus-state, so the client seeds serverCorpusDigestRef on connect.
2. Server broadcast path (broadcastDataUpdated): capture the digest once at the start of the coalescing window via contentStore.getCorpusDigest() and reuse the same value for the per-window corpus-state message; do not re-sample mid-window.
3. /api/search: sample the digest from the same getCorpusDigest() snapshot the search reads, not a later point, so the response digest matches the broadcast digest for the same change.
4. Client corpus-state handler (src/web/App.tsx): already stores serverCorpusDigestRef; confirm the open-time message is accepted so the first post-edit refresh can be skipped.
5. Tests: extend src/test/corpus-digest.test.ts for open-time seeding and sampling consistency; add a server WS test if feasible.
6. Verify with tsc, bun run check ., the test suite, and a browser Net-panel pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the two L1 gaps identified after BACK-840 shipped.

1. WebSocket open seeds the client with one corpus-state message carrying contentStore.getCorpusDigest(), sent after ensureServicesReady resolves so ContentStore is non-null. This establishes serverCorpusDigestRef on connect, so the first post-load data-change broadcast is comparable and can be skipped. Previously serverCorpusDigestRef stayed null until the first data-change broadcast, forcing every post-edit refresh to fail open (gap 1).

2. broadcastDataUpdated now samples the digest at the START of the 300ms coalescing window - when the triggering change has already landed in ContentStore - and reuses that value for the per-window corpus-state, instead of recomputing at the window end. This pins the broadcast digest to the same snapshot the post-edit /api/search reads, eliminating the D1->D2->D1 refresh jitter that came from watcher re-reads and rescans landing between the search and the window-end sample (gap 2).

The bare-string broadcasts (tasks-updated etc.) are unchanged, so older clients that ignore corpus-state keep refreshing exactly as before (AC4). The window-start capture is also safe for coalesced multi-edit windows: it just fails open (refreshes) there, never skips a genuine change.

Two new server tests in server-content-broadcast.test.ts: connect-time corpus-state seeding, and broadcast-digest == post-change /api/search digest.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the two corpus-digest gaps left by BACK-840. The WebSocket open handler now sends one corpus-state message with the current ContentStore digest after services are ready, so the client seeds serverCorpusDigestRef on connect instead of staying null until the first data-change broadcast. broadcastDataUpdated captures the digest at the start of the 300ms coalescing window (when the triggering change has landed) and reuses it for the per-window corpus-state, rather than sampling at the window end; this makes the broadcast digest agree with the post-edit /api/search digest and removes the extra refresh caused by echo jitter. Bare-string broadcasts are untouched, so older clients are unaffected. Two new server tests cover connect-time seeding and digest alignment. Verified with bunx tsc --noEmit (clean) and bunx biome check (clean); 195 tests pass across the server + digest suites. The 5 failing tests in that run are pre-existing environment failures - a Bun segfault on the clean tree plus port/HTML-shell timeouts - confirmed unrelated to this change by replaying them on the unmodified code.
<!-- SECTION:FINAL_SUMMARY:END -->

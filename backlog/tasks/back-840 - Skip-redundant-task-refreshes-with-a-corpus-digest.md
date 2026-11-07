---
id: BACK-840
title: Skip redundant task refreshes with a corpus digest
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-07 13:25'
updated_date: '2026-11-07 17:05'
labels:
  - web-ui
  - core
dependencies: []
references:
  - src/core/corpus-digest.ts
  - src/core/content-store.ts
  - src/utils/corpus-state.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/App.tsx
modified_files:
  - src/core/corpus-digest.ts
  - src/core/content-store.ts
  - src/utils/corpus-state.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/App.tsx
  - src/test/corpus-digest.test.ts
priority: medium
ordinal: 399004
actual_start: '2026-11-07 15:59'
actual_end: '2026-11-07 16:41'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A CDP trace aligning WebSocket broadcasts with browser network requests showed one UI edit producing one /api/search from onSaved plus one per tasks-updated broadcast, with the server emitting three such broadcasts 1.1 to 6.9 seconds apart (in-process ContentStore patch, per-file fs.watch, root-watcher and periodic rescan). The 300ms debounce from BACK-818 cannot cover a fan-out measured in seconds, and a client quiet window cannot either without delaying every isolated refresh. This is L1: a server-owned digest derived from the ContentStore snapshot, carried by broadcasts and by /api/search responses; each client keeps its own last-synced cursor and skips a refresh when the two are equal. Source tags are out of scope because watcher events carry no writer identity and deduplication must fail open. Bare-string WS messages stay for older clients; scope-filtered searches and entity deltas belong to later tasks. ContentStoreEvent.version is unusable as a digest because it advances on echo, resets on restart and differs across server instances.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A content digest is derived from the ContentStore snapshot, not from the /api/search result set or the in-memory event counter, and stays stable across server restarts and instances for identical corpus files
- [x] #2 Each data-change broadcast is preceded by a JSON corpus-state message carrying the current digest, while all existing bare-string messages keep going out so older clients still refresh
- [x] #3 Every /api/search response carries the digest of the snapshot that produced it, and the client stores it as its last-synced cursor; the cursor never advances beyond the data in that response
- [x] #4 A tasks-updated broadcast whose digest equals the client cursor skips refreshData, so a burst of three echo broadcasts after one task write produces exactly one /api/search
- [x] #5 First load, reconnect catch-up, an unknown or missing digest and differing digests all still refresh (fail-open); broadcast, refresh and modal suites plus tsc and biome stay green
- [x] #6 Only the two full-corpus loaders may advance the cursor, and only from the digest carried by their own response header; the five filtered or query-based callers (SearchDialog, TaskList, TaskDetailsModal autocomplete, useCompletedTasks, refreshDocumentsData) ignore the digest so a search can never make the client claim it synced data it does not hold
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Server: computeCorpusDigest over ContentStore.getSnapshot() (tasks, completed bucket, documents, decisions, wikis) with stable key ordering, SHA-256 and volatile provenance keys excluded; exposed as ContentStore.getCorpusDigest().
2. Server: broadcastDataUpdated emits one corpus-state JSON message per window before the unchanged bare-string messages, and handleSearch returns the same digest in X-Corpus-Digest after the search has read the current snapshot.
3. Client: apiClient.searchRequest returns { results, digest }; search() keeps returning only results for the five query or filter callers, while searchWithDigest() serves the two full-corpus loaders.
4. Client: App keeps serverCorpusDigestRef (from corpus-state) and lastSyncedDigestRef (from a full-load response) in memory, gates refreshData when they match, serialises it with refreshInFlightRef so broadcasts arriving mid-refresh cannot start competing requests, and clears the server digest on reconnect catch-up.
5. Client: the cursor is written from the response header at Promise.all resolution, before the supersede check, so a losing concurrent request only leaves a safe (possibly older) cursor; a failed or timed-out refresh never writes it and nothing is persisted to localStorage.
6. Tests: corpus-digest.test.ts covers wire helpers, digest determinism and order independence, content and frontmatter-only changes, provenance-field immunity, the skip decision and a three-echo burst collapsing to one refresh.
7. Verified with bunx tsc --noEmit, bun run check . (14 pre-existing warnings), 177 scoped tests and a CDP browser pass aligning WS broadcasts with network requests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented L1 as a server-owned corpus digest with a per-client cursor. computeCorpusDigest hashes the whole parsed entity set with sorted keys and SHA-256; it deliberately does not use Task.rawContent alone because rawContent excludes frontmatter, so a status or priority edit would otherwise leave the digest unchanged and the client would skip its only refresh (caught by a regression test). Volatile provenance keys (source, filePath, mtime) are excluded so an in-process upsert and a watcher re-read of the same file agree. ContentStoreEvent.version was rejected because it is an in-memory event counter that advances on echo and resets on restart. The bare-string WebSocket messages are unchanged; one corpus-state JSON message per window is sent before them so older clients keep refreshing. handleSearch adds X-Corpus-Digest computed after the search has read the snapshot, so the cursor can never lead the response data. Only loadAllData and refreshTasksData use searchWithDigest; the five query or filter callers still use search and cannot advance the cursor. A clean CDP browser pass (page fully loaded, 525 tasks) showed one /api/search for a status change, with corpus-state arriving 1ms before tasks-updated, versus 3-4 full searches before the change. That pass also exposed two real issues, both fixed: concurrent refreshes triggered request-id supersede so the cursor was never written, and broadcasts arriving while a 1-2s refresh was in flight started competing requests. The cursor is now written from the response header at Promise.all resolution (before the supersede check, which can only leave it safely behind), and refreshInFlightRef serialises refreshData. Fail-open is preserved: unknown or missing digests, first load and reconnect catch-up all still refresh. Later long-window browser passes were inconclusive because a second server instance contended for the graph lock and the page did not finish loading.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kimi
created: 2026-11-07 16:56
---
Pending user acceptance: restart bun run cli browser so Bun recompiles the HTML bundle, then confirm in the Network panel that one task status change issues one /api/search. The long-window CDP passes were inconclusive because two browser server instances contended for the graph lock and the page never finished loading, so they are not treated as verification.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a server-owned corpus digest so duplicate task-change broadcasts no longer trigger full refreshes.

- src/core/corpus-digest.ts and content-store.ts compute a stable SHA-256 digest of the ContentStore snapshot, excluding volatile provenance fields and including frontmatter metadata.
- src/utils/corpus-state.ts defines the corpus-state WebSocket message and the skip rule shared by both ends.
- src/server/index.ts broadcasts the digest once per window before the unchanged bare strings and returns it in the X-Corpus-Digest header on /api/search.
- src/web/lib/api.ts adds searchWithDigest for the two full-corpus loaders; the five query callers keep using search and cannot advance the cursor.
- src/web/App.tsx keeps two in-memory digests, skips refreshData on a match, serialises refreshes with refreshInFlightRef and fails open on first load, reconnect or missing digest.
- src/test/corpus-digest.test.ts covers the wire format, digest determinism, frontmatter-only edits, provenance immunity and a three-echo burst collapsing to one refresh.

Verified with bunx tsc --noEmit (clean), bun run check . (14 pre-existing warnings only) and 177 scoped tests across 25 files. A clean CDP browser pass showed one /api/search for a status change instead of 3-4, with corpus-state arriving 1ms before tasks-updated. Later long-window passes were inconclusive because a second server instance contended for the graph lock and the page did not finish loading.
<!-- SECTION:FINAL_SUMMARY:END -->

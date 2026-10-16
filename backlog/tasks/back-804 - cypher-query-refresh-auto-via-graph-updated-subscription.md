---
id: BACK-804
title: 'cypher-query refresh:auto via graph-updated subscription'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-16 15:43'
updated_date: '2026-10-17 15:03'
labels:
  - web-ui
milestone: m-15
dependencies:
  - BACK-802
references:
  - 'src/server/index.ts:498-546'
  - 'src/web/App.tsx:1006-1058'
  - 'src/graph/service.ts:193-207'
  - 'src/web/components/GraphDatabases.tsx:55-115'
documentation:
  - backlog/docs/PRDS/cypher/doc-27 - Cypher-Live-Query：只读图查询块与可配置样式.md
modified_files:
  - src/sqlite/block.ts
  - src/graph/block.ts
  - src/graph/updated.ts
  - src/server/index.ts
  - src/web/App.tsx
  - src/web/components/SqlQueryBlock.tsx
  - src/web/components/CypherQueryBlock.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/graph-block.test.ts
  - src/test/cypher-query-block.test.tsx
ordinal: 366001
actual_start: '2026-10-16 18:07'
actual_end: '2026-10-16 23:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SQL blocks only support manual refresh (disk files have no change notification), but graph databases have the graph-updated broadcast from the GraphService hot-update chain. cypher-query uses this existing channel for true live refresh: re-run the query when graph data changes, with zero new server state. Design basis: doc-27 section 7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With refresh: auto the block listens to graph-updated and re-runs only when the payload database name matches the block's source
- [x] #2 Multiple changes within a 500ms quiet period trigger a single re-run; results are deep-compared and identical results skip re-render
- [x] #3 Block header shows a Live badge with pause/resume; pause stops re-runs without unsubscribing
- [x] #4 refresh defaults to manual with behavior identical to SQL blocks; auto is opt-in
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Client subscription: add refresh-mode support to QueryBlock; in auto mode subscribe to the existing WebSocket graph-updated messages (channel already in App.tsx; follow the graphVersion pattern in GraphDatabases.tsx).
2. Debounce and anti-flicker: mark dirty, wait out a 500ms quiet period, then re-run; deep-compare results and skip re-render when identical.
3. Database matching: graph-updated payloads carry the database name; only matching blocks re-run.
4. UI: Live badge plus pause/resume in the block header; pause only stops re-runs; manual mode behavior unchanged.
5. Server adds no watcher and no push computation; the broadcast reuses the existing GraphService chain.
6. Acceptance: a test proves batched-import bursts coalesce into one re-run; bunx tsc --noEmit, bun run check ., related tests green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. parseQueryBlock gained a 4th param refreshModes (default ['manual'], SQL error copy byte-identical); cypher passes ['manual','auto']. New src/graph/updated.ts shares the graph-updated wire protocol (message type, window event backlog-graph-updated, encode/parse) across server/App/block. Server onChanged payload now {type:'graph-updated', database:'default'} (only server change, no new watcher). App.tsx parses it, bumps graphVersion only for default/legacy payloads, re-dispatches a window CustomEvent (memos-updated precedent). QueryEngineConfig.refresh.auto.subscribe extension point; QueryBlock subscribes on mount, 500ms quiet-period debounce, resultFingerprint deep-compare excluding elapsedMs (identical results keep the same state object, no re-render), failed re-runs keep current values silently, pause via ref (stops re-runs, keeps subscription), Live badge + pause/resume in header (4 locales). CypherQueryBlock matches detail.database === source. Key decisions: WS payload did need the database name (was a bare string); user databases have no broadcast source so their blocks behave as manual until one exists; reused the single App-level WS instead of per-block sockets. Tests: 264 pass across 16 targeted files. Full bun test: 3670 pass / 298 fail - failures verified environmental (uv_spawn git ENOENT, 5s hook timeouts), none touching graph/query/block files. Full-suite run polluted backlog/config.yml; restored original values with Edit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
cypher-query blocks support refresh: auto: the block subscribes to the graph-updated broadcast (payload now carries the database name), coalesces bursts into one re-run after a 500ms quiet period, deep-compares results to skip no-op re-renders, and shows a Live badge with pause/resume. Default manual mode and both SQL blocks are behavior-identical (byte-identical request/response and error copy). 264 targeted tests green; tsc and biome clean.
<!-- SECTION:FINAL_SUMMARY:END -->

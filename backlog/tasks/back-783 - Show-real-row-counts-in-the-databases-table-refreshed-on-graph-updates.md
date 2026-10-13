---
id: BACK-783
title: 'Show real row counts in the databases table, refreshed on graph updates'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 03:55'
updated_date: '2026-10-13 04:12'
labels:
  - graph
  - web-ui
dependencies: []
modified_files:
  - src/graph/service.ts
  - src/graph/browser.ts
  - src/server/index.ts
  - src/web/App.tsx
  - src/web/components/GraphDatabases.tsx
  - src/web/lib/api.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/graph-sync.test.ts
  - src/test/web-graph-databases-refresh.test.tsx
ordinal: 342001
actual_start: '2026-10-13 03:44'
actual_end: '2026-10-13 03:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to BACK-771's Databases page. Two things it got wrong: the `default` row reported no counts at all (a "重建" placeholder that claimed counting meant rebuilding the corpus), and the page never noticed the corpus graph changing underneath it. The graph service holds the corpus graph in this process, so both counts and the change signal were already available - the page just was not asking. A false note under the query box is corrected in the same pass: `default` is served from a warm in-process store, so querying it does not rebuild anything.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Databases page shows real node/edge counts for `default` from the graph service, no longer a "rebuild" placeholder
- [x] #2 The list refreshes its counts automatically after graph-updated / graph-ready broadcasts, without remounting the page
- [x] #3 A failed refresh keeps the existing table instead of blanking the page
- [x] #4 Below the query box, `show_tables` / `table_info` are offered as clickable hints alongside a note about CLI `backlog graph schema`
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `GraphService.getCounts()`: sum the resident store's `countNodes()` with `countEdges()` over every edge table, returning null until ready. Does not go through `getPayload()`, which would materialize the whole graph just to print two numbers.
2. `GET /api/graph/databases`: after `describeDatabases()` (pure file reads), fill `default`'s nodes/edges from the already-running graph service. The cold start is not awaited, so the list request is never blocked.
3. Front end: `GraphDatabases` takes a `graphVersion` prop and refetches when it changes, keeping the current selection; `App` passes `graphVersion` and also bumps it on `graph-ready` (a client that connects mid-build never sees that `graph-updated`).
4. Change the count placeholder from "rebuild" to a neutral "—", narrowing its meaning to "the graph is not ready yet".
5. Add the click-to-fill `show_tables` / `table_info` hints and the CLI schema note below the query box.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Count semantics (corrected after user feedback): **include Tag nodes**. The first cut reused the store's `countNodes()`, which by API semantics counts only `FileNode`s (Tags and Meta excluded), so the web UI read 1407 while the graph page header said 1588. Cross-checking `graph describe default` against the derived-graph snapshot `.kuzu.graph.json` pinned the gap to exactly 181 Tag nodes (1407 + 181 = 1588; the 4622 edges = 44 + 47 + 113 + 332 + 2333 + 1753 were consistent from the start). Corrected to `countNodes() + getAllTags().length`; `Meta` is bookkeeping that no view draws and stays excluded. Tests now assert `counts.nodes === payload.nodes.length` (the set the canvas actually draws when nothing is hidden) and `counts.edges === payload.edges.length`, plus a wiki page carrying a label to pin the Tag count.
The graph page header is a **view** count while the databases row is a **whole-store** count: the task graph defaults to 826 · 204, the knowledge graph to 762 · 4107, and only with every legend entry enabled does it read the full 1588 · 4622. The two therefore agree only when nothing is hidden - by design, not a bug.
`/api/graph/databases` deliberately reads `this.graphService` instead of awaiting `getGraphService()`: the cold start takes seconds on a large repo and a list request has no reason to wait on it; the counts catch up when the page refetches after the `graph-ready` broadcast.
Refresh failures keep the old table: `loadedRef` tracks whether a list was ever obtained, so only a first-load failure falls through to the error page. Otherwise a single network blip would take the selected database and the query results down with it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The `default` row now reports the graph service's live counts (FileNode + Tag, matching the graph page with everything shown), the page subscribes to graph change broadcasts and refreshes itself, and the query box offers `show_tables` / `table_info` plus a CLI schema hint.
<!-- SECTION:FINAL_SUMMARY:END -->

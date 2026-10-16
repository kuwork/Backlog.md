---
id: BACK-803
title: cypher-query graph view with legend config integration
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
  - src/web/components/CypherResultGraph.tsx
  - 'src/web/utils/graph-legend-config.ts:236'
  - src/web/components/GraphDatabases.tsx
documentation:
  - backlog/docs/PRDS/cypher/doc-27 - Cypher-Live-Query：只读图查询块与可配置样式.md
modified_files:
  - src/sqlite/block.ts
  - src/graph/block.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/SqlQueryBlock.tsx
  - src/web/components/CypherQueryBlock.tsx
  - src/web/components/CypherResultGraph.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/graph-block.test.ts
  - src/test/cypher-query-block.test.tsx
  - src/test/server-cypher-query-endpoint.test.ts
ordinal: 365001
actual_start: '2026-10-16 17:15'
actual_end: '2026-10-16 23:51'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The differentiating view of cypher-query: render node/relationship results as a force-directed graph that shares the Databases page legend config (BACK-794), so node color buckets and relationship line styles configured there apply automatically inside document blocks. Design basis: doc-27 sections 6 and 8.2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 view: graph renders node/rel results with CypherResultGraph, visually consistent with the Databases page
- [x] #2 Results over 3000 nodes degrade to table view with an in-block notice
- [x] #3 Legend reads graph-legend-config (localStorage) keyed by the block's source database, the same config as the Databases page; legend edits take effect immediately without document diffs
- [x] #4 Text views (table/list/value) are unaffected when graph view is enabled
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend QueryEngineConfig: engines declare graph view support; QueryBlock hands raw node/rel results (not the section 5.4 compact-string conversion) to CypherResultGraph when view is graph.
2. Server response carries the raw node/rel structure plus nodeKeys (existing runCypher fields) on a graph-view-only path, leaving text-view serialization untouched.
3. Legend integration: read graph-legend-config keyed by the block's source field; reuse the GraphLegendSettings editor; add no new editing UI inside query blocks.
4. Node cap guard: over 3000 nodes, degrade to table and show an explanatory notice.
5. Acceptance: bunx tsc --noEmit, bun run check ., related tests green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. view: graph enabled only for cypher engine (parseQueryBlock third param views; SQL blocks still reject graph, locked by test). Data channel: same POST /api/graph/cypher-query, request with view=graph returns both coerced rows (for degrade-to-table) and raw graphRows (node/rel/path with _id/_src/_dst intact); text views send no view field and responses are byte-identical to BACK-802 contract. QueryEngineConfig gained optional graph { fromResult, render, nodeLimit }; nodeLimit reuses exported GRAPH_NODE_LIMIT (3000) from CypherResultGraph. Legend: CypherResultGraph database={source} reads the same localStorage keys as the Databases page (backlog.graph.<source>.legend), gear panel is the existing immediate-effect mechanism; no new legend UI or cross-component broadcast added. >3000 nodes degrade to coerced table with i18n notice (4 locales). Tests: 146 pass across 9 files incl. unchanged 27 SQL block tests.
WARNING: workspace was externally stashed twice during implementation (back802-wip 01:35, back802-wip2 01:43); work recovered from dangling commit a92ca689, backup patch at tmp/back-803-backup.patch.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
cypher-query blocks now support view: graph: node/relationship results render as a force-directed graph via the same CypherResultGraph component and legend config (BACK-794, localStorage keyed by database name) as the Databases page. Over 3000 nodes the block degrades to the coerced table with a notice. Text views and sqlite/duckdb blocks are behavior-identical (request/response contracts unchanged unless view=graph is sent). 146 related tests green, tsc and biome clean.
<!-- SECTION:FINAL_SUMMARY:END -->

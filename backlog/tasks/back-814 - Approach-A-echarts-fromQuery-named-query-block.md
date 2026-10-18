---
id: BACK-814
title: 'Approach A: echarts block fromQuery referencing named query-block'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-18 02:37'
updated_date: '2026-10-18 04:55'
labels:
  - web-ui
  - charts
milestone: m-17
dependencies:
  - BACK-812
references:
  - backlog/docs/PRDS/echarts/doc-30 - ECharts-图表引擎设计（统一-ChartBlock-引擎注册表）.md
modified_files:
  - src/sqlite/block.ts
  - src/web/charts/types.ts
  - src/web/charts/from-query.ts
  - src/web/charts/query-result-registry.tsx
  - src/web/charts/echarts-engine.ts
  - src/web/components/ChartBlock.tsx
  - src/web/components/SqlQueryBlock.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/test/from-query.test.ts
  - src/test/query-result-registry.test.tsx
  - src/guidelines/cli-instructions/documents.md
  - backlog/docs/PRDS/echarts/doc-31 - ECharts-图表演示.md
ordinal: 376001
actual_start: '2026-10-18 04:02'
actual_end: '2026-10-18 04:07'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A standalone echarts block references results of a named query-block in the same document via fromQuery: extend query-blocks with an optional id field, add a QueryResultRegistry (React Context), and have the echarts engine resolve fromQuery.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Query-blocks (all three types) gain an optional id field (parser explicitly allows it; fail-closed)
- [x] #2 Add QueryResultRegistry (Context + Provider + useQueryResult); on successful execution a query-block calls registry.set(id, result); visible only within the same document
- [x] #3 The echarts engine resolves fromQuery (whole dataset / series-level field mapping); after JSON.parse it recursively substitutes, executing no functions
- [x] #4 Lifecycle: when the query refreshes, the echarts chart re-runs setOption automatically; with an empty registry it first renders a placeholder
- [x] #5 Scope: fromQuery only references same-document blocks; duplicate id within a document is detected and warned on set (later write overwrites); cross-document references are out of scope
- [x] #6 The Charts section of src/guidelines/cli-instructions/documents.md documents fromQuery usage (id field, fromQuery reference, same-document scope, duplicate-id note)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per doc-30 §8.3.A (loose coupling: echarts block fromQuery).
1. Parser: add an optional id field to all three query-block types (src/sqlite/block.ts, src/graph/block.ts), fail-closed.
2. New QueryResultRegistry (Context + Provider + useQueryResult); a query-block calls set(id, result) on success; same-document scope; duplicate id is detected and warned on set.
3. echarts engine: resolve fromQuery by recursively substituting dataset.source / series from the registry (JSON only, no functions).
4. Lifecycle: re-setOption when the query refreshes; render a placeholder while the registry is empty.
5. Document fromQuery in documents.md Charts section (id field, reference, scope, duplicate-id note).
6. Tests: named query + binding, refresh update, missing id fallback.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approach A implemented. Parser accepts an optional id on all three query-block types. New QueryResultProvider / useQueryResultRegistry (Context, per-document scope, duplicate-id warn-on-set) in src/web/charts/query-result-registry.tsx. SqlQueryBlock publishes a result under its id on success (initial run and auto refresh). New pure resolveFromQuery (dataset + series-level fromQuery) wired into the echarts engine; ChartBlock passes the resolver and only re-runs when the source uses fromQuery. MermaidMarkdown wraps the reading view with the Provider. documents.md documents fromQuery.
Validation: bunx tsc --noEmit clean; bun run check . exit 0 (pre-existing warnings only); bun test 12 new (from-query + registry) and 129 regression (mermaid/sqlite/duckdb/cypher/echarts) all pass.

Demo document: doc-31 "ECharts 图表演示" (§24–§27) now shows a named query (id: monthly), series-level and dataset-level fromQuery, and the refresh/auto-update behaviour.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented BACK-814 (Approach A: echarts fromQuery referencing a named query-block).

Changes:
- src/sqlite/block.ts: optional id field (shared by sqlite/duckdb/cypher, fail-closed)
- src/web/charts/query-result-registry.tsx: QueryResultProvider + useQueryResultRegistry (per-document, duplicate-id warn)
- src/web/charts/from-query.ts: resolveFromQuery (dataset + series-level field mapping, missing-id message)
- src/web/charts/echarts-engine.ts + ChartBlock: resolve fromQuery and re-render on result updates
- src/web/components/SqlQueryBlock.tsx: publish result under id
- src/web/components/MermaidMarkdown.tsx: mount the Provider around the reading view
- documents.md: fromQuery usage, scope, duplicate-id note

Verification:
- bunx tsc --noEmit clean
- bun run check . exit 0
- bun test: 12 new + 129 regression pass
<!-- SECTION:FINAL_SUMMARY:END -->

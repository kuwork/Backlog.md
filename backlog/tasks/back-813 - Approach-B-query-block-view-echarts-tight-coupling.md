---
id: BACK-813
title: 'Approach B: query-block view: echarts (tight coupling)'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-18 02:36'
updated_date: '2026-10-18 04:54'
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
  - src/graph/block.ts
  - src/web/charts/echarts-query.ts
  - src/web/charts/EchartsFromResult.tsx
  - src/web/components/SqlQueryBlock.tsx
  - src/test/echarts-query-block.test.ts
  - src/test/sqlite-query-block.test.tsx
  - src/guidelines/cli-instructions/documents.md
  - backlog/docs/PRDS/echarts/doc-31 - ECharts-图表演示.md
ordinal: 375001
actual_start: '2026-10-18 03:49'
actual_end: '2026-10-18 04:01'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let a query-block render its own chart: extend the view enum with echarts, add a chart field (simple mapping form + advanced full-form using @result / @result:<column>), and add a render branch in SqlQueryBlock reusing the echarts engine.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Parser (src/sqlite/block.ts, src/graph/block.ts) adds "echarts" to the view enum and a new optional chart field (fail-closed: must be explicitly allowed)
- [x] #2 SqlQueryBlock adds a view===echarts render branch reusing the echarts engine, converting result to dataset.source, with ResizeObserver + dispose
- [x] #3 Simple mapping form (chart.type / categoryField / valueField / title) renders bars, lines, etc.
- [x] #4 Advanced full-form (chart.option + @result / @result:<column> placeholders) resolves and renders correctly
- [x] #5 The Charts section of src/guidelines/cli-instructions/documents.md documents view:echarts usage (simple and advanced examples, @result placeholder explanation, positioning as a table-like "value" view)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per doc-30 §8.3.B (tight coupling: query-block view:echarts).
1. Parser: add "echarts" to the view enum + an optional chart field in src/sqlite/block.ts and src/graph/block.ts (fail-closed, explicitly allowed).
2. New src/web/charts/echarts-query.ts: build the ECharts option from the result (simple mapping form, and advanced form with @result / @result:<column> placeholders).
3. New src/web/charts/EchartsFromResult.tsx: reuse the echarts engine load/render/dispose.
4. SqlQueryBlock: add the view === "echarts" render branch (sqlite / duckdb / cypher).
5. Document view:echarts in documents.md Charts section (simple + advanced examples, @result explanation).
6. Tests: parser, option builder, render branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approach B implemented. Parsers widened (view: echarts + optional chart field, fail-closed) in src/sqlite/block.ts and src/graph/block.ts. New pure buildEchartsOption (simple mapping + advanced @result / @result:<col>) and EchartsFromResult (reuses the echarts engine load/render/dispose). SqlQueryBlock gained the view === "echarts" branch. documents.md documents the usage.
Validation: bunx tsc --noEmit clean; bun run check . exit 0 (pre-existing warnings only); bun test 28 pass (echarts/sqlite), 112 pass (duckdb/cypher/mermaid regression).

Demo document: doc-31 "ECharts 图表演示" (§22–§23) now shows both the simple mapping form and the advanced option + @result form, live against backlog/databases/demo-shop.sqlite.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented BACK-813 (Approach B: query-block view: echarts).

Changes:
- view enum + optional chart field (fail-closed) in src/sqlite/block.ts and src/graph/block.ts
- src/web/charts/echarts-query.ts: buildEchartsOption (simple mapping + advanced @result placeholders)
- src/web/charts/EchartsFromResult.tsx: reuses the echarts engine load/render/dispose
- SqlQueryBlock: view === "echarts" render branch (sqlite / duckdb / cypher)
- documents.md Charts section documents view:echarts

Verification:
- bunx tsc --noEmit clean
- bun run check . exit 0
- bun test: echarts-query-block + sqlite-query-block (28) and duckdb/cypher/mermaid regression (112) all pass
<!-- SECTION:FINAL_SUMMARY:END -->

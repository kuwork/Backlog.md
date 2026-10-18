---
id: BACK-812
title: Core ECharts chart engine
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-18 02:35'
updated_date: '2026-10-18 06:47'
labels:
  - web-ui
  - charts
milestone: m-17
dependencies: []
references:
  - backlog/docs/PRDS/echarts/doc-30 - ECharts-图表引擎设计（统一-ChartBlock-引擎注册表）.md
modified_files:
  - backlog/docs/PRDS/echarts/doc-31 - ECharts-图表演示.md
ordinal: 374001
actual_start: '2026-10-18 02:35'
actual_end: '2026-10-18 03:40'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the core engine: the ChartEngine interface + registry, the ECharts engine (echarts/core with all built-in series, theming, and lifecycle), the ChartBlock universal render component, plus the MermaidMarkdown routing and editor-preview rename. This unblocks Approach B and A.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ChartEngine + registry resolves engines by fence language; mermaid and echarts each register one engine
- [x] #2 ECharts registers all built-in series and required components via echarts/core (tree-shaking entry), lazy-loaded through dynamic import so it stays out of the initial bundle
- [x] #3 Light/dark theme follows automatically; init / setOption / ResizeObserver / dispose lifecycle is correct
- [x] #4 Only JSON.parse is used; option cannot contain JS functions (aligned with mermaid securityLevel:strict); invalid JSON falls back to a plain code block
- [x] #5 MermaidMarkdown routes echarts through ChartBlock; the editor preview is renamed to ChartAwarePre and matches the rendered body
- [x] #6 Add a Charts section to src/guidelines/cli-instructions/documents.md covering both mermaid and echarts fences (echarts option JSON, automatic light/dark theme, supported type list, invalid-input fallback), matching the style of the existing Live SQL/Cypher Query Blocks section
- [x] #7 Add an example document (suggested path src/guidelines/cli-instructions/echarts-examples.md) that demonstrates the supported ECharts chart types: echarts fences covering every built-in series (bar, line, pie, scatter, radar, heatmap, gauge, funnel, sankey, treemap, sunburst, graph, map, parallel, candlestick, boxplot, lines, pictorialBar, themeRiver, custom, etc.), each with a copy-pasteable option JSON; link this example document from the Charts section in documents.md
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Per doc-30 §3: types/registry → echarts-engine → ChartBlock → wiring (MermaidMarkdown:432 routing, PasteAwareMDEditor:110 rename)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the unified chart engine.
- Added src/web/charts/{types,registry,mermaid-engine,echarts-engine}.ts and src/web/components/ChartBlock.tsx.
- registry maps fence language -> engine; mermaid and echarts each register one engine.
- echarts engine uses echarts/core with all built-in series + components, dynamically imported so it stays out of the initial bundle; theme follows light/dark via echarts.init; lifecycle init/setOption/ResizeObserver/dispose; invalid JSON falls back to raw text.
- MermaidMarkdown now routes mermaid/echarts fences through ChartBlock (PreBlock), removing the old renderMermaidIn post-render pass and the key={theme} remount hack; PasteAwareMDEditor renamed MermaidAwarePre -> ChartAwarePre.
- Added echarts-examples.md (every built-in series with copy-paste option JSON) and a Charts section in documents.md.
- Validation: bunx tsc --noEmit clean; biome check clean; bun test mermaid/mermaid-markdown/mermaid-preview/state-machine-editor all green (85 tests).

Example document migrated (2026-10-18).
- src/guidelines/cli-instructions/echarts-examples.md is not reachable at runtime: cli-instructions files are imported by src/guidelines/cli-instructions/index.ts, and this one was never registered, so the link from documents.md resolved to nothing in `backlog instructions documents`.
- Moved to a Backlog document instead: doc-31 "ECharts 图表演示" (backlog/docs/PRDS/echarts/doc-31 - ECharts-图表演示.md), same doc-28 style — every built-in series as a live `echarts` fence, plus view: echarts (BACK-813) and fromQuery (BACK-814) sections and an acceptance checklist.
- documents.md now points at doc-31 (`backlog doc view doc-31`); the standalone guidelines file was deleted.

Correction to the note above: `backlog doc view doc-31` does not resolve id references (pre-existing bug, `doc view doc-30` fails the same way; the full filename `PRDS/echarts/doc-31 - ECharts-图表演示.md` works). documents.md therefore references doc-31 by id + path, without a copy-paste command.

Bug found while verifying doc-31 in the browser (2026-10-18): themeRiver rendered blank. Two causes — (1) the engine registered every series but only 12 components, missing SingleAxisComponent, so `setOption` threw `singleAxisModel.get is not an object` and the block stayed empty (the error was swallowed by the promise catch); (2) the demo option used `singleAxis: {}` instead of `{type: \"time\"}`, which draws no river bands even when the component is present. Fixed both, then audited the whole registration list against echarts/charts + echarts/components: added ChordChart (v6, 23rd series) and the remaining coordinate/graphic components (polar, calendar, parallel, radar, transform, markArea, graphic, timeline, brush, aria, matrix, thumbnail, gridSimple). Added src/test/echarts-engine-registration.test.ts so an un-registered series/component fails the build instead of blanking silently. Demo doc: §19 fixed, chord added as §22 (view: echarts / fromQuery renumbered to §23–§24 / §25–§28). SSR check of all 23 echarts blocks: 21 render, 2 (fromQuery) covered by unit tests, 0 blank, 0 errors. tsc clean, bun run check . exit 0, 103 chart tests + 2 registration tests pass.

Demo doc §18 expanded (2026-10-18). The pictorialBar section only had one literal example (`symbol: "rect"`), so the claim that `symbol` also accepts `path://` and `image://` had nothing behind it. It now carries a symbol-form table (built-in shapes / `path://` / `image://`), an option table (symbolSize, symbolPosition, symbolRepeat, symbolBoundingData, symbolClip), a warning that `symbolRepeat` fills to `symbolBoundingData` so the data value only shows once `symbolClip` is on, and five live examples: per-item built-in shapes, bar + diamond at `symbolPosition: "end"`, a `path://` star, `image://` with an inline SVG data URI, and a two-layer water-level chart. Re-verified by SSR over the whole doc: 27 echarts blocks, 25 render (0 blank, 0 error), the 2 fromQuery blocks are covered by unit tests.

doc-31 §18 second pass (2026-10-18).
- Added a local-asset example: `image:///assets/images/web.jpeg` (§18.4); `backlog/assets` is served at `/assets/`, and the symbol is stretched to `symbolSize` (2:1 image -> 44x22). The data-URI example moved to §18.5.
- Fixed the water-level chart (§18.6): the old version stacked a grey `pictorialBar` track under the clipped coins, so above the water line there was a row of grey coins and the chart read as full. The track is now a plain light `bar` (rgba(148,163,184,0.25), borderRadius 8) with the coin layer clipping on top.
- Both image examples now use `symbolRepeat: true`: without it a single symbol sits at the bar origin, which is why the earlier example looked like images dropped on the axis.
- Verified by rasterising the rendered SVG (resvg), not just counting nodes: §18.2 / §18.4 / §18.5 / §18.6 all look right, and `GET /assets/images/web.jpeg` returns 200 image/jpeg. Whole doc: 28 echarts fences, 26 render, the 2 fromQuery ones covered by unit tests.

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the core ECharts chart engine (BACK-812).

What changed:
- Unified ChartBlock + engine registry; mermaid and echarts each register an engine.
- New echarts engine (echarts/core, all series/components, lazy dynamic import, light/dark theme, ResizeObserver + dispose, JSON-only option with invalid-JSON fallback).
- MermaidMarkdown routes chart fences through ChartBlock; removed the post-render renderMermaidIn pass and key={theme} hack. Editor preview renamed MermaidAwarePre -> ChartAwarePre.
- Usage guide: added Charts section to documents.md and a new echarts-examples.md covering every built-in series.

Verification:
- bunx tsc --noEmit: clean
- biome check: clean
- bun test (mermaid, mermaid-markdown, mermaid-preview, state-machine-editor): 85 pass / 0 fail
- echarts@6.1.0 added to dependencies (subpath exports verified present in v6).
<!-- SECTION:FINAL_SUMMARY:END -->

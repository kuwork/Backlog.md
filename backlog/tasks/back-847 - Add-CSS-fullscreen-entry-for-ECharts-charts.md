---
id: BACK-847
title: Add CSS fullscreen entry for ECharts charts
status: Done
assignee:
  - '@kuwork'
created_date: '2026-11-09 15:51'
labels:
  - web
dependencies: []
references:
  - src/web/components/ChartBlock.tsx
  - src/web/charts/EchartsFromResult.tsx
  - src/web/charts/echarts-engine.ts
  - src/test/chart-fullscreen-surface.test.tsx
  - src/test/sqlite-query-block.test.tsx
  - src/test/mermaid-preview.test.tsx
modified_files:
  - src/web/components/ChartBlock.tsx
  - src/web/charts/EchartsFromResult.tsx
  - src/web/charts/echarts-engine.ts
  - src/test/chart-fullscreen-surface.test.tsx
  - src/test/sqlite-query-block.test.tsx
  - src/test/mermaid-preview.test.tsx
ordinal: 406004
actual_start: '2026-11-09 15:29'
actual_end: '2026-11-09 16:11'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ECharts blocks render through ChartBlock to a canvas, but the CSS fullscreen entry added in BACK-846 was limited to the mermaid fence language. Extend the same overlay to echarts: re-render the chart into a clean overlay container with an explicit size and ECharts dark theme, and dispose the chart instance when the overlay closes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ECharts blocks show the fullscreen entry button at the top-right corner
- [x] #2 Opening it re-renders the chart into the dimmed overlay with an explicit container size so the canvas is never blank
- [x] #3 ECharts renders with its dark theme on the dimmed backdrop and is NOT inverted (only classic Mermaid is)
- [x] #4 Wheel zoom, drag pan, rotate, reset, Esc and close button work for ECharts as for Mermaid
- [x] #5 The chart instance and ResizeObserver are disposed when the overlay closes
- [x] #6 tsc --noEmit, biome check, and unit tests pass
- [x] #7 Query-direct charts (`view: echarts`) get the same fullscreen entry as fenced ECharts blocks
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 tsc --noEmit, biome check, and bun test pass
- [x] #2 A unit test covers the ECharts fullscreen button, dark overlay render, absence of inversion, sizing and dispose
- [x] #3 Modified files, actual start/end, and final summary recorded in the task
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `echarts` to `FULLSCREEN_LANGS` in ChartBlock so the existing top-right entry button and overlay render for ECharts blocks too. The overlay already re-renders into a clean container (BACK-846), so no cloning is involved and a canvas backend is viable.
2. Base the per-block overlay theming on the resolved engine id (`getChartEngine(lang).id`), not the global `useDiagramEngine()` setting: only the classic Mermaid backend needs the `invert(1) hue-rotate(180deg)` filter; Pele and ECharts render natively dark on the dimmed backdrop. Pass `mode: "dark"` to ECharts so `echarts.init` uses its built-in dark theme.
3. Before rendering, give the overlay surface an explicit pixel size (90% of the viewport) for canvas backends; an auto-sized flex box has zero width/height and ECharts would render a blank bitmap. Skip the SVG fit/readability-floor logic for canvas (there is no SVG to size) and reset the overflow flag.
4. Dispose the renderer on overlay cleanup so the ECharts instance and its `ResizeObserver` are torn down; keep the existing zoom/pan/rotate/Esc/close interactions unchanged.
5. Add a jsdom test seam to `echarts-engine.ts` (`__ECHARTS_MOCK__`, mirroring the existing `__MERMAID_MOCK__`) so a stub renderer can exercise the overlay path without a real canvas context; assert the button, fresh render, explicit sizing, dark mode, no inversion, and dispose. Update the two tests that previously asserted ECharts has no fullscreen button.
6. Route query-direct charts (`view: echarts`) through ChartBlock as well. `EchartsFromResult` becomes a thin adapter that builds the ECharts `option` from `chart` + query result and passes it as `ChartBlock`'s `source` with `lang="echarts"`; keep its inline error rendering for invalid config. Assert the button in the SqlQueryBlock test and cover the full overlay path with the ECharts stub.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The original fullscreen entry was gated to `mermaid` because the first design cloned the on-page SVG DOM, which would be blank for a canvas engine. BACK-846 later replaced cloning with a fresh re-render into a clean overlay container, which removed that constraint — the overlay is now engine-agnostic, so opting `echarts` in is mostly a matter of widening the allow-list.

Two subtleties were fixed along the way. First, the overlay theme and the invert filter were keyed off `engineId` from `useDiagramEngine()`; that value is the global diagram-backend setting and is meaningless for an echarts block (an ECharts chart would be inverted whenever the user picked the classic Mermaid backend). Both now derive from `getChartEngine(lang).id`, the backend that actually renders the block. Second, `echarts.init` reads the container size at creation time, so the overlay surface must have an explicit box before `render` runs; an auto-sized flex container yields a 0x0 bitmap. A canvas engine also keeps an `echarts` instance plus a `ResizeObserver` attached to its container, so the overlay cleanup now calls `renderer.dispose(target)` — previously only the on-page render effect disposed.

The SVG fit/readability-floor logic is skipped for canvas (`target.querySelector("svg")` returns null) and `hasOverflow` is reset to false, so a full-bleed ECharts chart starts centered without a spurious pan affordance; zoom still enables pan through the existing `canPan` rule. ECharts renders with its built-in dark theme (light text/axes on the dimmed `bg-black/90` backdrop) and is deliberately not inverted, unlike the light-baked classic Mermaid SVG.

Query-direct charts (`view: echarts`) have their own entry point: `SqlQueryBlock` renders `EchartsFromResult` instead of a fenced `ChartBlock`. That component used to call `echartsEngine.load().render()` from a private effect, so it never saw the fullscreen button no matter which languages were allow-listed. `EchartsFromResult` is now a thin adapter: it builds the standard ECharts `option` from `chart` + the query result (simple mapping or advanced `@result` form), serializes it, and renders `<ChartBlock lang="echarts" source={optionJson} />`. ChartBlock is thus the single render path for every ECharts source, and theme switching, registry-based `fromQuery` resolution, ResizeObserver, dispose and the overlay all apply uniformly. Invalid `chart` config is still caught before ChartBlock mounts and shown as an inline `.chart-block-error` message. The `source` is a JSON string, so an unchanged result keeps the same string and ChartBlock's render effect does not re-run on unrelated parent renders.

Testing: jsdom has no canvas context, so `echarts-engine.ts` gained a `__ECHARTS_MOCK__` seam (same pattern as `__MERMAID_MOCK__` in `utils/mermaid.ts`) that returns a stub `ChartRenderer`. `chart-fullscreen-surface.test.tsx` uses it to verify the ECharts button, a fresh render child in the overlay, non-empty inline width/height, `mode: "dark"`, absence of `invert(1)`, that `dispose` fires on close, and — via `EchartsFromResult` — that a query-direct chart gets the same button and dark overlay render. `sqlite-query-block.test.tsx` asserts the button through the real `SqlQueryBlock` path. The two assertions that previously required ECharts to have no button were flipped.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ECharts charts now have the same CSS fullscreen viewer as Mermaid diagrams. Adding `echarts` to `FULLSCREEN_LANGS` opts it into the existing top-right entry button and dimmed overlay, which re-renders the block into a clean container with wheel zoom (cursor-centered), drag pan, rotate ±90°, reset, and Esc/close dismissal — no new interaction code was needed.

Per-block theming now uses the resolved engine id instead of the global diagram-engine setting: ECharts renders with its native dark theme on the dimmed backdrop and is not inverted (only the classic Mermaid backend keeps the `invert(1) hue-rotate(180deg)` filter). The overlay gives canvas backends an explicit pixel size before `render` so `echarts.init` never produces a blank 0x0 bitmap, skips the SVG-only fit logic, and disposes the chart instance plus its `ResizeObserver` when the overlay closes. A `__ECHARTS_MOCK__` test seam (mirroring `__MERMAID_MOCK__`) lets jsdom exercise the path; two tests that asserted ECharts had no fullscreen button were updated, and new tests cover the button, fresh dark render, sizing, no inversion, and dispose.

Query-direct charts are covered too: `EchartsFromResult` now builds the option and delegates to `ChartBlock lang="echarts"`, so `view: echarts` blocks show the same button and get the same dark, sized, disposable overlay as fenced charts. Invalid `chart` config still renders an inline error.

Verification: `bunx tsc --noEmit` clean, `biome check` clean, and `bun test` passes — `chart-fullscreen-surface` + `sqlite-query-block` 23 tests, plus `mermaid-preview`, `mermaid-markdown`, `echarts-query-block`, `echarts-engine-registration`, `query-result-registry`, `duckdb-query-block` and `cypher-query-block` 129 tests. No locale changes were needed — the existing `viewFullscreen` label is reused.
<!-- SECTION:FINAL_SUMMARY:END -->

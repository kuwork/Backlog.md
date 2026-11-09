---
id: BACK-846
title: Add CSS fullscreen entry for Mermaid diagrams
status: Done
assignee:
  - '@kuwork'
created_date: '2026-11-09 11:14'
updated_date: '2026-11-09 23:29'
labels:
  - web
dependencies: []
references:
  - src/web/components/ChartBlock.tsx
  - src/web/charts/pele-engine.ts
  - src/file-system/operations.ts
  - src/test/chart-fullscreen-surface.test.tsx
modified_files:
  - src/web/components/ChartBlock.tsx
  - src/web/charts/pele-engine.ts
  - src/file-system/operations.ts
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/web/locales/ko.ts
  - src/test/chart-fullscreen-surface.test.tsx
  - src/test/mermaid-preview.test.tsx
ordinal: 405004
actual_start: '2026-11-09 11:05'
actual_end: '2026-11-09 15:32'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mermaid diagrams render to SVG through ChartBlock but had no fullscreen viewer like the image lightbox. This adds a fullscreen entry button plus a CSS overlay that clones the rendered SVG and supports zoom/pan/rotate/Esc, matching the image lightbox interaction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Mermaid diagrams show a fullscreen entry button at the top-right corner
- [x] #2 Clicking it opens a CSS fullscreen overlay with a dimmed backdrop showing the cloned SVG
- [x] #3 The overlay supports wheel zoom, drag pan when zoomed, rotate left/right 90 degrees, reset, Esc close and a close button
- [x] #4 Non-SVG engines such as echarts do not show the fullscreen button
- [x] #5 Reuses the image lightbox zoomIn/zoomOut/resetZoom/rotateLeft/rotateRight/close strings; only a viewFullscreen label is added across all five locales
- [x] #6 tsc --noEmit, biome check, and the unit tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 tsc --noEmit, biome check, and bun test pass
- [x] #2 A unit test covers the fullscreen button for mermaid and its absence for non-svg engines
- [x] #3 Modified files, actual start/end, and summary recorded in the task
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a fullscreen entry button to ChartBlock, shown only for SVG-based engines (mermaid); it is a top-right overlay button with an expand icon and the viewFullscreen aria-label.
2. On open, re-render the diagram fresh into a clean fixed, dimmed CSS overlay (a fresh container each open, so the async classic Mermaid backend renders reliably instead of coming up empty); the rendered SVG is sized to contain-fit with a readability floor and centered.
3. The overlay mirrors the image lightbox interactions: wheel zoom (centered on the cursor), drag pan when zoomed in, rotate left/right 90°, reset, Esc close, and a close button. Page scroll is locked while open.
4. Reuse existing image lightbox strings (zoomIn/zoomOut/resetZoom/rotateLeft/rotateRight) and common.close; add a single viewFullscreen label to all five locales (en/zh-CN/zh-TW/ja/ko) so the TranslationDict type stays in sync.
5. Add a unit test covering the fullscreen button for mermaid and its absence for non-svg engines; keep the existing ChartAwarePre / MermaidMarkdown tests passing by wrapping their render in I18nProvider (ChartBlock now calls useI18n).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The fullscreen entry lives in ChartBlock (which owns the render-target div). It re-renders the diagram into a clean overlay container rather than cloning the on-page SVG: the classic Mermaid backend renders asynchronously and its `run` skips nodes already marked `data-processed`, which made cloning (or re-rendering into a reused node) come up empty — a fresh render into a clean node is reliable for both backends. Only SVG-based engines are opted in via FULLSCREEN_LANGS; non-SVG engines (echarts) draw to a canvas and are excluded. The overlay is a self-contained component (not the shared ImageLightboxContext) because the lightbox is built around an image src while here the source is a live diagram. a11y: outer layer role="dialog" aria-modal; zoom/pan surface role="application"; background click-to-close is intentionally omitted (matches the image lightbox, closes via X + Esc) to satisfy biome's static-element-interaction rules.

Dark treatment on the dimmed `bg-black/90` backdrop: Pele is re-rendered with `mode: "dark"` (true dark palette via the `--pele-*` CSS variables sourced from pele-engine's exported `peleDarkPalette`); the classic Mermaid backend does not expose a dark render, so its light-baked SVG is shown with `filter: invert(1) hue-rotate(180deg)`, flipping the (light) strokes to light-on-transparent so they stay visible.

Sizing uses contain-fit with a readability floor: after render we read the SVG's natural coordinate space (viewBox, falling back to getBoundingClientRect), then `fit = min(availW/naturalW, availH/naturalH)` so the whole diagram is visible with no overflow; if the contained size drops below a readability floor (each side >= 50% of the 90%-viewport), we stop shrinking so text stays legible — the diagram then overflows and can be panned/zoomed. An explicit pixel size is set on the SVG and the parent flexbox centers it, so any native aspect ratio (e.g. a very wide sequence diagram that would otherwise be ~1/6 screen height) is centered and as large as possible without depending on the SVG's own `preserveAspectRatio` (some Mermaid outputs align content top-left, leaving it stuck in a corner). Pan is allowed when zoomed (scale > 1) or when the diagram overflows (hasOverflow).

Wheel zoom is bound as a NATIVE non-passive listener (`overlayRef.addEventListener("wheel", …, { passive: false })`) instead of React's `onWheel`: React delegates wheel through a passive root listener, so `preventDefault()` there throws "Unable to preventDefault inside passive event listener". The native listener reads the latest view via a `viewRef` so the zoom center stays correct. Page scroll is locked while open (body + html overflow hidden).

Related fix (separate root cause, discovered while testing the overlay with the classic Mermaid engine): the diagram-engine choice silently reverted to Pele after restart. `parseConfig` in file-system/operations.ts had two bugs: (1) its return object literal omitted the `diagramEngine` field, so the parsed value was dropped on every load; (2) `serializeConfig` writes `diagram_engine: "mermaid"` (quoted) while the old compare used raw equality. Both fixed — `diagramEngine` is added to the returned config and the parsed value is quote-stripped (`replace(/['"]/g, "")`) before matching. Verified via a round-trip `loadConfig` check (`diagramEngine => mermaid`).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a CSS fullscreen entry for Mermaid/Pele diagrams in ChartBlock. A top-right expand button (only for SVG-based engines) opens a dimmed fixed overlay that re-renders the diagram fresh into a clean container and supports wheel zoom (cursor-centered), drag pan, rotate left/right 90°, reset, and Esc/close dismissal — the same interaction set as the image lightbox. Zoom/rotate/reset/close reuse the existing image lightbox strings; a single viewFullscreen label was added across all five locales. Non-SVG engines (echarts) do not show the button. ChartAwarePre and MermaidMarkdown tests were wrapped in I18nProvider because ChartBlock now uses useI18n.

Follow-up fixes rolled into this task:
- Overlay reliability: switched from cloning the on-page SVG to a fresh re-render into a clean overlay node, fixing the classic Mermaid backend's empty overlay (its async `run` skips `data-processed` nodes).
- Dark contrast on the dimmed backdrop: Pele re-renders with its dark palette (peleDarkPalette from pele-engine); the classic Mermaid backend's light-baked SVG is shown via `filter: invert(1) hue-rotate(180deg)`.
- Sizing: contain-fit + readability floor (each side >= 50% of the 90%-viewport). Extreme aspect ratios (e.g. wide sequence diagrams that would otherwise be ~1/6 screen height) are centered and as large as possible; if the contained size would be unreadable it overflows and becomes pannable/zoomable. No dependence on the SVG's own preserveAspectRatio.
- Passive-wheel error fixed by binding wheel as a native non-passive listener (`{ passive: false }`), eliminating "Unable to preventDefault inside passive event listener"; the latest view is read through a `viewRef` so the zoom center stays correct.
- Related config bug: `parseConfig` (file-system/operations.ts) dropped `diagramEngine` on return and compared the quoted serialized value literally, so the engine choice reverted to Pele on restart; now returned and quote-stripped.

Verification: tsc --noEmit, biome check, and the unit tests (chart-fullscreen-surface, mermaid-preview, diagram-engine, mermaid-markdown) all pass.
<!-- SECTION:FINAL_SUMMARY:END -->

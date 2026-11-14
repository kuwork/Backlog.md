---
id: BACK-849
title: Fix Mermaid theme re-render races and treeView dark colors
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-14 13:09'
updated_date: '2026-11-14 16:13'
labels:
  - web-ui
dependencies: []
references:
  - src/web/utils/mermaid.ts
  - src/web/components/ChartBlock.tsx
  - src/test/mermaid-theme-rerender.test.ts
  - backlog/docs/doc-32 - Mermaid-Diagram-Gallery.md
modified_files:
  - src/web/utils/mermaid.ts
  - src/test/mermaid-theme-rerender.test.ts
  - package.json
  - bun.lock
priority: high
ordinal: 408004
actual_start: '2026-11-14 12:50'
actual_end: '2026-11-14 14:48'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two classic-Mermaid rendering regressions were found while previewing articles under `diagram_engine: mermaid`.

Phase 1 (doc-28): switching the web UI between light and dark turns a rendered mermaid fence into raw source text, and a full page refresh restores the diagram but leaves it in a light palette. Root cause: ChartBlock re-runs its render effect on a color-mode change while keeping the same DOM container; `renderMermaidDiagram` resets that container to the diagram source, while `mermaid.run()` skips any node already carrying `data-processed="true"`, so the second pass produces no SVG. A separate defect: `treeView-beta` is an experimental diagram whose stylesheet hardcodes `labelColor` and `lineColor` to black and ignores the active theme, so a correctly dark-initialized diagram still renders black-on-dark.

Phase 2 (doc-32, 26 mermaid fences): toggling the color mode made neighboring diagrams overlap / render incorrectly. Root cause: React effect cleanup cannot cancel a render already in flight, so an older render can finish last and overwrite the newer SVG; `mermaid.run()` reads `element.innerHTML` as its diagram source, so overlapping renders on one container parse the previous SVG as source text; and `renderMermaidDiagram` cleared the container to raw source before every render, so 26 diagrams collapsed and jumped while re-rendering in turn.

Both phases only affect the classic Mermaid engine in the web UI. The default Pele backend is unaffected (it re-renders from scratch and themes treeView via CSS variables); no CLI, MCP, or config contract changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Switching between light and dark mode re-renders a Mermaid diagram into an SVG instead of leaving the raw source text in the container
- [x] #2 A treeView-beta diagram uses light label, line, icon and description colors on a dark background with the classic Mermaid engine
- [x] #3 Light mode keeps the Mermaid default theme and the stock treeView colors
- [x] #4 Other Mermaid diagram types keep their dark theme variables when the treeView palette override is active
- [x] #5 After a theme switch every diagram container holds exactly one top-level SVG, with no overlap between neighbors
- [x] #6 The previous SVG stays visible until its replacement is ready, with no raw source or empty box during a theme switch
- [x] #7 A stale render that finishes after a newer one does not overwrite the newer SVG
- [x] #8 A failed first render surfaces the diagram source instead of leaving an empty container
- [x] #9 Regression tests cover same-container re-render, the dark-only palette switch, overlapping renders, and the generation guard
- [x] #10 Pele upgrades to 1.13.0 and Mermaid to 12.3.0 with no build or test regression
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Phase 1: reproduce the doc-28 theme switch under the classic Mermaid backend and confirm that the reused container is skipped by `mermaid.run()` because of `data-processed`.
2. Phase 1: clear `data-processed` in the shared `renderDiagram` helper before every render, covering both `renderMermaidDiagram` and `renderMermaidIn` with one change.
3. Phase 1: inject a dark treeView palette through `themeVariables.treeView` in `initializeMermaid`, after verifying with a real `mermaid.render()` call that the top-level `treeView` config only controls layout.
4. Phase 2: reproduce the doc-32 theme switch in a real browser and confirm that 26 diagrams re-render in one tick with overlap.
5. Phase 2: replace the `mermaid.run()` path with `mermaid.render()` so the diagram source is passed as a string instead of being read back from `element.innerHTML`.
6. Phase 2: add a per-container generation guard so a stale in-flight render cannot write into a container already claimed by a newer render, and keep the previous SVG in place until the new SVG is ready.
7. Add regression tests for same-container re-render, the dark-only palette switch, overlapping renders, the generation guard, and the failure fallback; run scoped tests, tsc, Biome, and a web rebuild.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Phase 1: `mermaid.run()` sets `data-processed="true"` before parsing and skips any node that already has it. ChartBlock owns the container and `mermaidEngine` has no dispose hook, so clearing the attribute in the shared `renderDiagram` helper was the single point covering both render entry points. The treeView palette override must live under `themeVariables.treeView`: Mermaid passes `{...config.themeVariables, theme, look}` to the diagram stylesheet, while `getConfig().treeView` feeds the layout database; a real `mermaid.render()` call confirmed only the `themeVariables` path changes the generated CSS. The override does not disturb other diagrams: a flowchart rendered with `theme: dark` keeps `primaryColor #1f2020`, `background #333` and `lineColor lightgrey` with and without the override.

Phase 2: the doc-32 gallery exposed a deeper race that phase 1's `data-processed` clear could not fix. `mermaid.run()` reads `element.innerHTML` as its diagram source, so overlapping renders on one container parse the previous SVG as source text; React's effect cleanup cannot cancel a render already in flight, so an older render can finish last and overwrite the newer SVG; and clearing all 26 containers to raw source at once made the page collapse and jump. The fix drops `mermaid.run()` entirely (which also removes the `data-processed` handling from phase 1) and renders through `mermaid.render(id, text)` with the source passed as a string. The render id uses a global counter plus randomness so a gallery rendering dozens of diagrams in the same tick never shares one. A per-container `renderGeneration` guard (a `WeakMap<HTMLElement, number>` plus a global counter) marks each container with the generation of its newest render; a render that finishes after a newer one sees a stale generation and returns without writing. The container keeps its SVG until the replacement is ready, so the page no longer collapses; only a failed first render shows the source text. `renderMermaidIn` uses the same helper.

Validation: 121 pass / 0 fail across nine scoped test files, `bunx tsc --noEmit` passes, scoped Biome clean. Real-browser CDP verification (Chrome headless, doc-32, 26 diagrams): with the old bundle, 400ms after a theme toggle 24 of 26 containers were empty and 14 showed raw source text; with the rebuilt bundle the same toggle and a toggle back to dark kept `empty / sourceBoxes / extraSvgs / overlaps` at 0 at 400ms, 2s and 4s, each container holding exactly one top-level SVG. The two `architecture-beta` diagrams legitimately contain 6 nested icon SVGs each; that is not an overlap. Mermaid 12.3.0 and Pele 1.13.0 were both active at fix time.

Pele remains the default backend and was never affected; removing `diagram_engine: mermaid` from the promotion repo config also avoids both symptoms without rebuilding.

Dependency upgrades: Pele moved 1.8.0 -> ^1.13.0 (latest 1.13.0) and Mermaid 11.16.1 -> 12.3.0, a major bump made so the classic-engine fixes could be validated against the current Mermaid. Mermaid 12.3.0 pulls in new transitive dependencies: @mermaid-js/parser 2.0.1, chevrotain 13.2.0 (with its @chevrotain/* subpackages), elkjs 0.12.1, katex 0.18.11 (and commander 15.1.0), plus a wider direct set (@braintree/sanitize-url, @iconify/utils, cytoscape*, d3*, dagre-d3-es, dayjs, dompurify, es-toolkit, khroma, marked, roughjs, stylis, ts-dedent). Both changes are confined to package.json and bun.lock.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the classic-Mermaid theme-switch rendering regressions found while previewing doc-28 and doc-32.

Changes: `src/web/utils/mermaid.ts` now renders through `mermaid.render()` with a unique id and the source passed as a string, guards every container with a render generation so a stale in-flight render cannot overwrite a newer one, keeps the previous SVG until its replacement is ready, and injects a dark `treeView` palette through `themeVariables.treeView` so `treeView-beta` no longer renders black-on-dark. `renderMermaidIn` uses the same helper. Added regression tests in `src/test/mermaid-theme-rerender.test.ts` for same-container re-render, the dark-only palette switch, overlapping renders, the generation guard, and the failure fallback.

Why: `mermaid.run()` permanently marks processed nodes and reads `element.innerHTML` as source (parsing a previous SVG as diagram text), React effect cleanup cannot cancel a render already in flight, clearing all containers at once made the gallery collapse and jump, and `treeView-beta` hardcodes black text and lines instead of reading the active theme. The default Pele backend was never affected.

Verified with 121 passing tests across nine scoped files, `bunx tsc --noEmit`, scoped Biome, and a web bundle rebuild. A real `mermaid.render()` check confirmed the palette injection point and that other diagrams keep their dark theme variables; real-browser CDP checks confirmed zero overlap or source leakage on the 26-diagram doc-32 gallery across theme toggles. Separately, Pele was upgraded to 1.13.0 and Mermaid to 12.3.0 (package.json, bun.lock) so the classic-engine fixes were validated against the current Mermaid; tsc, the web bundle build, and the scoped test suite stayed green. No CLI, MCP, or config contract changes.
<!-- SECTION:FINAL_SUMMARY:END -->

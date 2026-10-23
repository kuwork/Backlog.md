---
id: BACK-819
title: 'Switchable diagram engine: Pele default with Mermaid fallback'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-23 01:56'
updated_date: '2026-10-23 02:02'
labels:
  - web-ui
  - charts
dependencies: []
references:
  - 'https://github.com/obsidianmd/pele'
documentation:
  - backlog/docs/doc-32 - Mermaid-Diagram-Gallery.md
modified_files:
  - backlog/docs/doc-32 - Mermaid-Diagram-Gallery.md
  - src/web/charts/pele-engine.ts
  - src/web/charts/diagram-engine.ts
  - src/web/charts/registry.ts
  - src/web/components/ChartBlock.tsx
  - src/web/components/MermaidDiagram.tsx
  - src/web/components/Settings.tsx
  - src/web/App.tsx
  - src/types/index.ts
  - src/file-system/operations.ts
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/web/styles/source.css
  - src/test/pele-engine.test.ts
  - src/test/diagram-engine.test.ts
  - src/test/mermaid-preview.test.tsx
  - src/test/mermaid-markdown.test.tsx
  - src/test/mermaid.test.ts
  - package.json
  - bun.lock
  - backlog/config.yml
ordinal: 381001
actual_start: '2026-10-22 15:00'
actual_end: '2026-10-23 01:45'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the hard-wired Mermaid renderer with a switchable diagram engine. Pele (Obsidian team open-source, renders Mermaid 12.1.0 syntax to SVG, zero dependencies) becomes the default; Mermaid 11.16.1 remains available as a selectable fallback. The engine is chosen at runtime from a new Settings control and persisted in config. This update also ships doc-32, a comprehensive Mermaid diagram gallery (18 categories and 25 copy-paste examples using both this project's workflow and common WeChat/Alipay scenarios), fixes three previously un-previewable figures in that doc, and resolves dark-theme line/arrow contrast.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 doc-32 Mermaid Diagram Gallery created with 18 categories and 25 detailed copy-paste examples covering the project workflow and WeChat/Alipay scenarios
- [x] #2 The three previously un-previewable figures in doc-32 render under both engines (XY chart Chinese x-axis labels quoted; architecture-beta labels switched to ASCII-safe English)
- [x] #3 Pele engine added as a ChartEngine and made the default diagram renderer (renders Mermaid 12.1.0 syntax to SVG with zero dependencies)
- [x] #4 Mermaid 11.16.1 remains a selectable fallback (files restored and dependency re-added)
- [x] #5 A Settings control switches the active engine at runtime and persists it via config.diagramEngine (default pele)
- [x] #6 Dark-theme line/arrow contrast fixed so Pele diagrams are clearly visible (light --pele-line/border/fg tokens)
- [x] #7 Both engines verified by headless Chrome on doc-32: 25/25 mermaid blocks render under Mermaid 11.16.1 and 25/25 under Pele
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes
- [x] #2 bun run check . passes on touched files
- [x] #3 bun test passes for the relevant suites
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Step 1 - Create doc-32 Mermaid Diagram Gallery with 25 detailed examples spanning the Backlog.md workflow and WeChat/Alipay scenarios

Step 2 - Add pele-engine.ts implementing the ChartEngine interface over Pele, with light and dark palettes

Step 3 - Add diagram-engine.ts reactive store (useSyncExternalStore) defaulting to pele

Step 4 - Wire registry.ts to resolve the mermaid engine by the active engine id and re-register the Mermaid path

Step 5 - Restore Mermaid engine files from git HEAD and re-add mermaid@11.16.1 so Mermaid is selectable again

Step 6 - Make ChartBlock depend on the active engine id so switching re-renders immediately

Step 7 - Initialize the engine from config in App.tsx and add the Settings dropdown plus BacklogConfig type plus operations parse/serialize

Step 8 - Add diagramEngine i18n keys across en/zh-CN/zh-TW/ja

Step 9 - Fix dark-theme contrast by setting light --pele-line/border/fg tokens

Step 10 - Add unit tests for pele-engine and diagram-engine and verify both engines render doc-32 via headless Chrome
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the switchable diagram engine end to end.

Engine core (steps 2 to 4).
- Added src/web/charts/pele-engine.ts exporting a ChartEngine with languages ["mermaid"]; render(source) synchronously builds an SVG via the Pele API and injects it into the container. PALETTES holds light and dark tokens; dark sets --pele-line #c9d1d9, --pele-border #8b949e, --pele-fg #e6edf3, light sets --pele-line #1f2328.
- Added src/web/charts/diagram-engine.ts with a reactive store built on useSyncExternalStore: activeEngine defaults to pele, plus getActiveDiagramEngine/setActiveDiagramEngine/normalizeDiagramEngine/useDiagramEngine.
- Rewrote src/web/charts/registry.ts so getChartEngine(mermaid) returns enginesById.get(getActiveDiagramEngine()); both pele and mermaid engines are registered (ids pele and mermaid). echarts still resolves by language.

Mermaid fallback restored (step 5).
- Restored src/web/charts/mermaid-engine.ts, src/web/utils/mermaid.ts and src/types/mermaid-dist.d.ts from git HEAD and re-added mermaid@11.16.1 (bun add mermaid@11.16.1) so the Mermaid path is selectable again.

Switch wiring (steps 6 to 8).
- ChartBlock.tsx now calls useDiagramEngine() and includes engineId in the render effect deps, so changing the engine re-renders immediately.
- App.tsx initializes the engine after fetchConfig via setActiveDiagramEngine(normalizeDiagramEngine(configData.diagramEngine)); default pele.
- Settings.tsx applies setActiveDiagramEngine on save and adds a Diagram Engine dropdown (Pele default / Mermaid).
- src/types/index.ts adds diagramEngine?: pele | mermaid to BacklogConfig.
- src/file-system/operations.ts parseConfig gains a diagram_engine branch and serializeConfig writes the diagram_engine line (otherwise the value never persisted).
- backlog/config.yml adds diagram_engine: pele as the shipped default.
- i18n: en/zh-CN/zh-TW/ja settings blocks gain diagramEngine/diagramEngineDesc/diagramEnginePele/diagramEngineMermaid.

doc-32 gallery and preview fixes (steps 1 and 9).
- Created backlog/docs/doc-32 - Mermaid-Diagram-Gallery.md with 18 categories and 25 detailed mermaid blocks using both the Backlog.md workflow and WeChat/Alipay scenarios.
- Fixed three un-previewable figures (fig 15/16 XY chart and architecture diagram): the XY chart x-axis used unquoted Chinese labels (lexer error) so labels were wrapped in quotes; the architecture-beta diagram used Chinese node labels which Mermaid restricts to ASCII, so those labels were switched to English. Architecture figures keep English labels so both engines render them.
- Dark-theme contrast: Pele maps CSS variables --pele-line/--pele-border/--pele-fg to internal --_l/--_b/--_fg. Initially they were set to near-black, making lines invisible on dark surfaces. Setting them to light values (line #c9d1d9, border #8b949e, fg #e6edf3) restored visibility; verified by reading computed stroke in headless Chrome (rgb(201,209,217)).

Verification (step 10).
- Added src/test/pele-engine.test.ts (light/dark palette tokens) and src/test/diagram-engine.test.ts (store plus registry resolution, 4 cases); adjusted mermaid-preview.test.tsx and mermaid-markdown.test.tsx; removed the obsolete src/test/mermaid.test.ts.
- Headless Chrome rendered all 25 mermaid blocks of doc-32 under both Mermaid 11.16.1 and Pele: 25/25 on each path.
- bunx tsc --noEmit clean; biome clean on touched files; relevant suites 76/76 green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered a switchable diagram rendering engine with Pele as the default and Mermaid as a selectable fallback, plus the doc-32 Mermaid gallery and a dark-theme contrast fix.

What changed:
- New pele-engine.ts renders Mermaid 12.1.0 syntax to SVG via Pele (zero-dependency, Obsidian team); light/dark palettes.
- New diagram-engine.ts reactive store (useSyncExternalStore) with active engine defaulting to pele.
- registry.ts now resolves the mermaid engine by the active engine id; both pele and mermaid engines registered.
- Mermaid path restored (files from HEAD, mermaid@11.16.1 re-added) so it is selectable again.
- ChartBlock re-renders on engine change; App initializes the engine from config; Settings gains a Diagram Engine dropdown.
- BacklogConfig.diagramEngine typed; operations parse/serialize the diagram_engine key; config.yml ships diagram_engine: pele.
- i18n keys added for the new setting in en/zh-CN/zh-TW/ja.
- doc-32 Mermaid Diagram Gallery added (18 categories, 25 examples: project workflow plus WeChat/Alipay scenarios); three un-previewable figures fixed (XY chart Chinese labels quoted; architecture labels switched to English).
- Dark-theme line/arrow contrast fixed by setting light --pele-line/border/fg tokens.

Why:
- Users wanted sharper, dependency-light diagrams and the freedom to fall back to Mermaid; a settings toggle makes the choice explicit and persistent.

Verification:
- Headless Chrome: doc-32 all 25 mermaid blocks render 25/25 under both Mermaid 11.16.1 and Pele.
- bunx tsc --noEmit: clean
- biome check on touched files: clean
- bun test (pele-engine, diagram-engine, mermaid-preview, mermaid-markdown): 76/76 pass
<!-- SECTION:FINAL_SUMMARY:END -->

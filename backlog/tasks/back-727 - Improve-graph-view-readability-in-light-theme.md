---
id: BACK-727
title: Improve graph view readability in light theme
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 09:01'
updated_date: '2026-10-01 09:03'
labels: []
dependencies: []
references:
  - src/web/components/GraphLegend.tsx
  - src/web/components/GraphView.tsx
  - src/web/components/TaskDependencyGraph.tsx
modified_files:
  - src/web/components/GraphLegend.tsx
  - src/web/components/GraphView.tsx
  - src/web/components/TaskDependencyGraph.tsx
ordinal: 297400
actual_start: '2026-10-01 08:30'
actual_end: '2026-10-01 09:03'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The graph views (/graph page and the task relationship graph in the task details modal) were tuned for the dark canvas: edges used slate-400 (#94a3b8) and node outlines used pale 300-scale tints, both of which wash out on a light surface — relationships read as gaps and nodes as outline-less dots. Dark theme stays untouched.

Chosen approach (user picked from options): keep the fills, switch light theme to a same-hue 700-scale dark border per node kind, and darken edges to slate-500 in light theme only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Edges and edge labels use slate-500 (#64748b) in light theme, slate-400 unchanged in dark theme
- [x] #2 Node outlines use a same-hue 700 shade in light theme, pale tints unchanged in dark theme; tag gray stays one step lighter to remain recessive
- [x] #3 Legend line samples follow the same theme-aware edge color so legend and canvas never disagree
- [x] #4 bunx tsc --noEmit, bun run check ., bun run build and graph canvas tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. GraphLegend.tsx: add edgeStroke(theme) (dark: #94a3b8 unchanged, light: #64748b) and nodeStroke(style, theme) (dark: existing 300 tints, light: same-hue 700 shades; tag stays #6b7280).
2. GraphView.tsx and TaskDependencyGraph.tsx: route edge strokes, edge labels and node outlines through the theme-aware helpers.
3. LegendLine: use edgeStroke(theme) so the legend matches the canvas.
4. Verify with tsc, biome, graph canvas tests, build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan approved by user choosing the same-hue dark border option over a colorblind-safe palette swap or borderless fills. Palette: task #1d4ed8, completed #047857, draft #b45309, milestone #7e22ce, wiki #0e7490, decision #be185d, document #4338ca, tag #6b7280 (one step lighter, stays recessive per doc-15 §7).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Light-theme readability pass for both graph views (dark theme untouched).

Changes:
- GraphLegend.tsx: new edgeStroke(theme) — slate-500 (#64748b) in light theme, slate-400 in dark; new nodeStroke(style, theme) — same-hue 700 outlines in light theme, existing 300 tints in dark
- GraphView.tsx and TaskDependencyGraph.tsx: edges, deep-zoom relation labels and node outlines all use the theme-aware helpers
- LegendLine samples follow edgeStroke(theme) so the legend always matches the canvas

Verification:
- bunx tsc --noEmit, bun run check ., bun run build pass; web-graph-canvas tests pass
<!-- SECTION:FINAL_SUMMARY:END -->

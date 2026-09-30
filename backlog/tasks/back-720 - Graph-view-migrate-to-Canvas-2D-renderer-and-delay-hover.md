---
id: BACK-720
title: Optimize GraphView rendering performance and hover experience
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-30 01:18'
updated_date: '2026-09-30 04:26'
labels:
  - web-ui
dependencies: []
modified_files:
  - src/web/components/GraphLegend.tsx
ordinal: 290400
actual_start: '2026-09-30 01:25'
actual_end: '2026-09-30 04:20'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate the graph views (task graph and knowledge graph) from the D3+SVG renderer to a Canvas 2D renderer for better performance, and add a deliberate delay to hover triggers so quick pointer sweeps no longer cause tooltip/highlight flicker.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GraphView 页面改用 Canvas 2D 渲染，功能与交互与现状一致（缩放、拖拽、焦点淡化、相机飞行、标题分层、边名标签）
- [x] #2 悬停提示/高亮加入明显的触发延迟，指针快速划过时不再闪烁
- [x] #3 删除或归档 GraphSigmaView/GraphCanvasView 评估页，只保留一套实现
- [ ] #4 GraphView renders with Canvas 2D while preserving all current behavior: zoom, drag, focus dimming, camera fly-in, tiered captions, edge labels
- [ ] #5 Hover tooltip and highlight have a noticeable activation delay; rapid pointer movement across nodes does not flicker
- [ ] #6 Only one graph view implementation remains; the redundant duplicate page and its route are removed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Merge the Canvas 2D renderer from GraphCanvasView.tsx into GraphView.tsx, replacing the SVG paint layer for both variants (task + knowledge); keep d3-force layout, position persistence, d3-zoom/d3-drag, tiered captions, edge labels, focus dimming, camera fly-in unchanged
2. Migrate TaskDependencyGraph.tsx (the per-task dependency subgraph in TaskDetailsModal) to Canvas 2D as well, extracting shared canvas-draw helpers so the two views do not duplicate the paint code
3. Add hover activation delay (timer-based, cancelled on pointer move/leave) for tooltip and neighbour highlight in both views; 300ms unless the user prefers otherwise
4. Delete GraphCanvasView.tsx, its /knowledge-canvas route, nav entry and i18n keys so one implementation remains
5. Extend the jsdom smoke test (web-graph-canvas.test.tsx) to cover GraphView both variants and TaskDependencyGraph
6. Verify: bunx tsc --noEmit, bun run check, graph-related test suites, bun run build; smoke-test /graph, /knowledge and a task modal's graph via WebBridge screenshot
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged the Canvas 2D renderer into GraphView.tsx (both task and knowledge variants); position caches keep their existing keys so saved layouts survive.
TaskDependencyGraph.tsx migrated to Canvas 2D as well; shared paint helpers extracted to src/web/utils/graph-canvas.ts (platePath via arcTo, strokeEdge with rim-trim + arrowheads, drawEdgeLabel, drawCaption, canvasThemeColors, ensureZoomInterrupt for the d3-transition prototype issue).
Hover tooltip + neighbour highlight now arm a 300ms timer (HOVER_DELAY_MS); cursor feedback stays instant; timer cancelled on move/leave/drag.
Removed the evaluation page: GraphCanvasView.tsx, /knowledge-canvas route, nav entries, i18n keys.
jsdom smoke tests cover GraphView task + knowledge variants, the roundRect-less fallback, and TaskDependencyGraph.

Fixed a canvas regression: d3-zoom's own dblclick.zoom handler calls stopImmediatePropagation(), swallowing the canvas dblclick before the open-node handler. dblclick.zoom is now disabled and the handler owns double-click entirely (node -> open, empty canvas -> zoom in x2). Verified live via WebBridge: double-clicking BACK-101 opens /task/101 modal.

Fixed all-hidden freeze: when the legend hides every kind the visible subset is empty and the effect returned early - on canvas that left the last frame painted with no listeners (the SVG version had dropped its children on rebuild). The empty-subset path now clears the canvas explicitly. Covered by a new smoke case with an empty payload.

Tag nodes are now theme-compensated: nodeFill() in GraphLegend brightens the tag gray (#9ca3af -> #cbd5e1) on the dark canvas, where it previously read as absent. Applied to both canvas painters and the legend dots so dot and node always match. The 167 tags were being drawn all along (knowledge view node count included them); they were just invisible on dark.

Changed the tag visibility rule in selectVisibleGraph: a Tag is now dropped only when it has no TaggedWith edge anywhere in the payload (true orphans, e.g. task-only labels). Tags whose carriers are merely hidden by the legend stay visible - a lit legend entry now always means the nodes are in the picture. Edges still require both ends visible, so a tag with hidden pages shows as a lone node. Note: doc-15 §4 documents the old rule and should be updated in a follow-up if this behavior is accepted.

doc-15 amended via backlog doc update: appended a revision block marking §4's old tag-drop rule superseded by the BACK-720 behavior (orphan-only drop, lit legend = visible).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Graph views now render on Canvas 2D instead of SVG: GraphView (task + knowledge variants) and TaskDependencyGraph share canvas paint helpers in utils/graph-canvas.ts. Behaviour preserved: d3-force layout with persisted positions, zoom/pan/drag, tiered captions, edge labels, focus dimming, camera fly-in, legend filters. Hover tooltip and highlight gained a 300ms activation delay to stop flicker on fast pointer sweeps. The temporary evaluation page was removed; one implementation remains. Verified: tsc, Biome, 93 graph/web tests, bun run build.

Follow-up fixes during review:
- Fixed double-click-to-open (d3-zoom's dblclick.zoom swallowed the event via stopImmediatePropagation; the handler now owns dblclick entirely - node opens, empty canvas zooms in x2)
- Fixed all-hidden freeze (empty visible subset now clears the canvas explicitly instead of leaving a stale inert frame)
- Tag nodes theme-compensated via nodeFill() (brightened #9ca3af -> #cbd5e1 on dark)
- Tag visibility rule changed: tags are dropped only when they have no TaggedWith edge in the whole payload, so a lit legend entry always means visible nodes
- New KnowledgeGraph nav icon (user-supplied glyph) at w-5 h-5

Final verification: bunx tsc --noEmit, bun run check, graph-related suites (71 tests) + canvas smoke tests (5), bun run build - all green. Live-checked via WebBridge: both graph pages render, zoom/captions/edge labels correct, double-click opens task modal.
<!-- SECTION:FINAL_SUMMARY:END -->

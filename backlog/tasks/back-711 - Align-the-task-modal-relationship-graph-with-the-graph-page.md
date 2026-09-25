---
id: BACK-711
title: Align the task-modal relationship graph with the /graph page
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-25 08:18'
updated_date: '2026-09-25 18:54'
labels: []
dependencies: []
modified_files:
  - src/web/components/GraphLegend.tsx
  - src/web/components/GraphView.tsx
  - src/web/components/TaskDependencyGraph.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
ordinal: 281400
actual_start: '2026-09-25 08:05'
actual_end: '2026-09-25 08:45'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The relationship graph in the task details modal (BACK-710) reads as the same product as the /graph page: it uses the shared legend and node palette, fills the modal body, and keeps its reading state per task - graph mode, zoom/pan and legend filters all belong to the task being read, so a drill-down round trip returns to the view the parent was left in. Leaving the graph is the modal title's back arrow, the same move as leaving a drilled-into task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The relationship graph uses the shared /graph legend (kind dots with counts plus edge-style samples) and the shared node palette
- [x] #2 The graph canvas fills the modal body and a small neighbourhood is framed to use that area
- [x] #3 Graph mode and the zoom/pan and legend filters each belong to the task being read - drilling into a neighbour lands on that neighbour's own state (its detail view unless it was itself left as a graph)
- [x] #4 Returning from a drill-down restores the parent's graph mode and its zoom/pan and legend filters exactly
- [x] #5 Leaving the graph is a back arrow in the modal title's back slot (Escape does the same) rather than an x inside the panel
- [x] #6 bunx tsc --noEmit is clean and the web test suite passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract the shared legend and palette into src/web/components/GraphLegend.tsx and import them from both graph views (GraphView and TaskDependencyGraph).
2. TaskDependencyGraph: render that legend in the header row, fill the modal body with the canvas, drop the 1.5x fit cap for a modal neighbourhood and center a subgraph of fewer than two nodes at 1:1; take viewports and hiddenStyles as props instead of owning them.
3. TaskDetailsModal: own the per-task reading state (graphOpenByTask, viewports, legend filters), reset it only when the modal opens, and render the back arrow in the modal title's leftActions slot with a "back one step" precedence shared with Escape.
4. Verify over CDP (drill-down round trip, filters, arrow and Escape) and run bunx tsc --noEmit plus the web test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The task-modal relationship graph and the /graph page share one visual implementation: src/web/components/GraphLegend.tsx exports NodeStyle, NODE_FILL, NODE_STROKE, EDGE_STROKE, EDGE_DASH, nodeStyle, LegendDot and LegendLine, and GraphView imports them instead of defining its own copies, so the two views cannot drift apart. TaskDependencyGraph renders that same legend - the kind dots with live subgraph counts plus the three edge-style samples - in its header row, next to the title.

The canvas fills the modal body: w-full with height min(calc(94vh - 9.5rem), 44rem). fitToView drops the 1.5x upper bound - /graph keeps its cap because it frames a whole corpus well below 1x, while a modal neighbourhood is a handful of nodes and filling the reading area is the point - and keeps only the 0.2 floor. A subgraph of fewer than two nodes has no extent to frame, so it is centered at 1:1 instead of zoomed to k=12, which the radius clamp turned into a single node drawn 60px across instead of 36px. Measured at 1280x940 on the 974x590 canvas: a 5-node neighbourhood fits at k~4.38 and spans 67% x 69% of the canvas (it used to span 46% x 50% in a 608px square), a 19-node one at k~1.79 spans 60% x 90%.

The reading state belongs to the task being read, not to the modal. TaskDetailsModal owns graphOpenByTask (Map<taskId, boolean>), the per-task viewports (Map<taskId, ZoomTransform>, exported as GraphViewports) and the per-task legend filters (Map<taskId, Set<NodeStyle>>), and a fresh modal open clears all three. Drilling into a neighbour therefore lands on that neighbour's own state - its detail view, unless the neighbour was itself left open as a graph - and coming back restores the parent's mode, zoom/pan and filters exactly. The viewport and the filters have to live in the modal because the graph component unmounts while a neighbour's detail view is on screen; TaskDependencyGraph takes viewports/hiddenStyles/onHiddenStylesChange as props and keeps only the layout, the filtering and the toggle semantics.

Leaving the graph is a back arrow in the modal title's leftActions - the slot and glyph a drilled-into task already gets (HeaderBackButton in TaskDetailsModal), so opening the graph looks like stepping into the task - instead of the x at the far right of the panel header, where it read as decoration. That slot carries one precedence, "back one step": graph open -> close the graph, even on a task that was itself reached by a drill-down; graph closed -> the history back arrow returns. Escape follows the same order and Modal's disableEscapeClose keeps the dialog itself open. The panel keeps only its title and legend, and TaskDependencyGraph no longer takes an onClose prop. The i18n key was renamed with the semantics, taskDetails.dependencyGraphClose -> dependencyGraphBack ("返回任务详情 (Esc)" / "Back to task details (Esc)", plus ja and zh-TW).

Verified over CDP at 1280x940: the drill-down round trip restores the transform byte for byte and keeps the hidden filter; the modal title shows exactly one 28x28 arrow, 36px left of the title, vertically centred in the sticky header, and no x remains in the panel; Escape and a click on that arrow both close the graph and leave the dialog on the detail view. bunx tsc --noEmit clean; bun run check . passes (3 pre-existing warnings in src/core/assets.ts and src/test/board-tui-draft-create.test.ts); bun test src/web 99 pass / 1 fail (getSearchResultMeta, pre-existing and unrelated to these files).

Tooling: scripts/cdp-session.mjs (backlog-web-ui skill) gained a waitFor step (poll an expression until true) and an optional clip/scale on shots for close-ups of small controls, which cut a verification run from 12s of blind sleeps to 3s.
<!-- SECTION:NOTES:END -->

---
id: BACK-710
title: Add relationship graph view to task detail modal
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-25 00:48'
updated_date: '2026-09-25 01:44'
labels: []
dependencies: []
modified_files:
  - src/web/utils/task-subgraph.ts
  - src/web/utils/task-subgraph.test.ts
  - src/web/components/TaskDependencyGraph.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
ordinal: 280400
actual_start: '2026-09-25 00:54'
actual_end: '2026-09-25 01:38'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the task detail modal (Web UI), the Dependencies panel currently only shows a flat tag-input list. Add a small graph button in the top-right corner of the Dependencies panel that toggles an expanded relationship-graph view.

Button: reuse the same graph icon as the left sidebar Graph navigation item (four connected nodes), no text label.

Expanded view: when clicked, replace the entire modal body area below the title bar with a force-directed relationship graph, like the existing /graph page: the current task as the focused root node, showing all its relationships and related nodes with cascading/transitive connections (parent, children, depends-on, milestone) and labeled edges. The subtitle inside the expanded view shows only the localized graph title (no task id or task title suffix). A legend with per-kind toggles controls which node kinds (task, completed, draft, milestone) are displayed.
- Clicking the button again or pressing Escape collapses back to the normal detail view.

Live-refresh (added during execution): the view subscribes to the app's graphVersion (bumped by the graph-updated WebSocket message), so relationship changes made anywhere — including inside the modal itself or externally — refetch and re-layout the graph automatically. Draft tasks are first-class citizens: their DependsOn edges come from the same /api/graph payload.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A graph toggle button appears in the top-right of the Dependencies section of the task detail modal
- [x] #2 Clicking the button expands a full-width (below-title) graph canvas showing the current task as root
- [x] #3 The graph shows both upstream (depends-on) and downstream (dependent) tasks, including transitive/cascading dependencies
- [x] #4 The expanded view can be dismissed and returns to the normal detail view
- [x] #5 bun test (or scoped test) passes and bunx tsc --noEmit is clean
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/web/utils/task-subgraph.ts: BFS subgraph extraction over the typed graph payload (DependsOn, ParentOf, BelongsToMilestone), transitive in both directions, cycle- and budget-protected; unit tests.
2. src/web/components/TaskDependencyGraph.tsx: fetch apiClient.getGraph(), cut the focus-task neighborhood, d3-force SVG render like GraphView.tsx (styled nodes, labeled directed edges, zoom/drag), subtitle shows only the localized title, legend bar with node-kind visibility toggles (root always stays visible).
3. TaskDetailsModal.tsx: showGraph state; toggle button with the sidebar graph icon in the Dependencies SectionHeader right slot; body swap below the title bar; Escape collapses (disableEscapeClose while open).
4. i18n keys dependencyGraphTitle/Toggle/Close in en/ja/zh-CN/zh-TW.
5. bun test, bunx tsc --noEmit, bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in the Web UI task detail modal.
- src/web/utils/task-subgraph.ts: buildRelationshipSubgraph() — BFS over the typed /api/graph payload (DependsOn, ParentOf, BelongsToMilestone) in both directions, cycle-protected, depth- and node-bounded; 8 unit tests in task-subgraph.test.ts.
- src/web/components/TaskDependencyGraph.tsx: d3-force SVG render modeled on GraphView (styled nodes per kind, labeled directed edges, zoom/drag, fit-to-view, node click drills down). Header subtitle shows only the localized title; legend bar toggles node-kind visibility (root always stays visible).
- src/web/components/TaskDetailsModal.tsx: showGraph state; sidebar-style graph icon button in the Dependencies SectionHeader right slot; replaces modal body below the title bar; Escape collapses (disableEscapeClose while open); resets on task switch.
- Live refresh: graphVersion prop threaded App -> TaskDetailsModal -> TaskDependencyGraph; refetches on graph-updated WebSocket events.
- i18n: dependencyGraphTitle/Toggle/Close in en/ja/zh-CN/zh-TW.
Verified: bun test (task-subgraph 8/8), bunx tsc --noEmit clean, web bundle builds; biome ignores src/web by project config.
<!-- SECTION:NOTES:END -->

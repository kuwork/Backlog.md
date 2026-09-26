---
title: BACK-710 Add relationship graph view to task detail modal
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - graph
  - web-ui
source_path: backlog/tasks/back-710 - Add-dependency-graph-view-to-task-detail-modal.md
---

# BACK-710 Add relationship graph view to task detail modal

The Dependencies panel in the Web UI task modal gained a graph toggle button (the sidebar's four-node icon) that swaps the modal body for a force-directed relationship graph rooted at the current task, with transitive connections in both directions and a per-kind legend.

## Summary

- `src/web/utils/task-subgraph.ts`: `buildRelationshipSubgraph()` — BFS over the typed `/api/graph` payload (DependsOn, ParentOf, BelongsToMilestone) in both directions, cycle-protected, depth- and node-bounded; 8 unit tests
- `TaskDependencyGraph.tsx`: d3-force SVG render modeled on GraphView — styled nodes per kind, labeled directed edges, zoom/drag, fit-to-view, node click drills down; subtitle shows only the localized title; legend bar toggles node-kind visibility with the root always visible
- `TaskDetailsModal.tsx`: `showGraph` state, icon button in the Dependencies SectionHeader right slot, body swap below the title bar, Escape collapses (`disableEscapeClose` while open), resets on task switch
- Live refresh added during execution: `graphVersion` threaded App → TaskDetailsModal → TaskDependencyGraph, so any `graph-updated` WebSocket event refetches and re-lays out; draft tasks are first-class citizens via the same `/api/graph` payload
- i18n keys `dependencyGraphTitle/Toggle/Close` in en/ja/zh-CN/zh-TW; verified with bun test, `tsc`, and a web bundle build

## Acceptance Criteria

- Graph toggle button in the top-right of the Dependencies section
- Expanded full-width canvas shows the current task as root with upstream, downstream and transitive connections
- Dismissal returns to the normal detail view; tests and type-check pass

## Related Concepts

- [[concepts/web-ui-features]] — modal interaction conventions (SectionHeader slots, Escape handling)

## Related Sources

- [[sources/back-704-graph-view-web-ui]] — the /graph page whose rendering this mini view models (same batch)
- [[sources/back-709-dependency-closure-query]] — the closure API rendered next to this graph in the same modal (same batch)
- [[sources/back-711-modal-graph-alignment]] — follow-up aligning this view with the /graph page (same batch)
- [[sources/back-628-task-hierarchy-section]] — earlier modal enrichment with drill-down navigation

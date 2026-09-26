---
title: BACK-711 Align the task-modal relationship graph with the /graph page
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - graph
  - web-ui
source_path: backlog/tasks/back-711 - Align-the-task-modal-relationship-graph-with-the-graph-page.md
---

# BACK-711 Align the task-modal relationship graph with the /graph page

The BACK-710 modal relationship graph was aligned with the /graph page into one visual product: shared legend and palette, a canvas that fills the modal body, and per-task reading state so a drill-down round trip restores exactly the view the parent was left in.

## Summary

- One shared visual implementation: new `GraphLegend.tsx` exports `NodeStyle`, `NODE_FILL`, `NODE_STROKE`, `EDGE_STROKE`, `EDGE_DASH`, `nodeStyle`, `LegendDot`, `LegendLine`; `GraphView` imports them instead of defining its own copies, so the two views cannot drift; `TaskDependencyGraph` renders the same legend (kind dots with live counts plus three edge-style samples) in its header row
- Canvas fills the modal body (`min(calc(94vh - 9.5rem), 44rem)`); `fitToView` drops the 1.5x cap (a modal neighbourhood is a handful of nodes and filling the reading area is the point) keeping the 0.2 floor; a sub-2-node subgraph centers at 1:1 instead of zooming to k=12 — measured: 5-node neighbourhood spans 67%×69% of the canvas (was 46%×50%)
- Reading state belongs to the task, not the modal: `TaskDetailsModal` owns `graphOpenByTask`, per-task viewports (`GraphViewports`) and per-task legend filters, cleared only on a fresh modal open; they must live in the modal because the graph component unmounts while a neighbour's detail view is on screen — drill-down lands on the neighbour's own state and return restores the parent's mode, transform and filters byte-for-byte
- Leaving the graph is a back arrow in the modal title's `leftActions` slot (the same glyph a drilled-into task gets), replacing the decorative x in the panel; one "back one step" precedence shared with Escape: graph open → close graph, else history back; i18n key renamed `dependencyGraphClose` → `dependencyGraphBack` in four locales
- Verified over CDP: transform restored byte for byte, exactly one 28×28 arrow in the header, no x remains; `tsc` clean; web tests 99 pass / 1 pre-existing unrelated fail
- Tooling: `scripts/cdp-session.mjs` gained a `waitFor` step and optional clip/scale on shots, cutting a verification run from 12s of blind sleeps to 3s

## Acceptance Criteria

- Shared /graph legend and node palette in the modal graph; canvas fills the modal body
- Graph mode, zoom/pan and legend filters belong to the task being read; drill-down round trip restores them exactly
- Leaving via the title's back arrow (or Escape) with "back one step" precedence

## Related Concepts

- [[concepts/web-ui-features]] — modal navigation and drill-down state conventions

## Related Sources

- [[sources/back-710-task-modal-relationship-graph]] — the modal graph this aligns (same batch)
- [[sources/back-704-graph-view-web-ui]] — the /graph page supplying the shared legend/palette (same batch)
- [[sources/back-628-task-hierarchy-section]] — drill-down navigation whose back-slot convention the arrow reuses

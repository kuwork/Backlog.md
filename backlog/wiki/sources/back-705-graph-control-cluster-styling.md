---
title: BACK-705 Unify the graph control cluster styling
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - graph
  - web-ui
source_path: backlog/tasks/back-705 - Unify-the-graph-control-cluster-styling-so-the-overview-key-matches-its-neighbours.md
---

# BACK-705 Unify the graph control cluster styling

The overview (fit) key in the graph control panel dropped its accent tint so all seven keys share one neutral style — once the key owned the panel's top-left cell (BACK-704 polish), the tint only added a second visual weight.

## Summary

- `GraphView.tsx`: `CtrlButton` loses its accent variant entirely — the prop, its JSDoc and the blue class string removed; the overview key renders through the plain branch; the 3-column grid and every key cell position unchanged
- Verified against the source server with a throwaway corpus: computed background/border/text colors went from 2 distinct values to 1 in both light and dark themes, and all seven keys kept their exact rectangles
- The legend half of the original request needed no code: clicking a node-kind chip already dims it (opacity 1 → 0.4) and hides that kind in the graph (nodes to 0.00 with pointer-events none, edges to 0.00), restored on second click — re-measured live; only the three edge-type legend lines are static by design
- Gates: `tsc` clean; web suites 293 pass / 0 fail across 42 files

## Acceptance Criteria

- Overview key renders with the same border/background/text colors as pan and zoom keys in both themes; no accent variant left in GraphView
- Control panel keeps its 3-column grid with every key at its previous screen position

## Related Concepts

- [[concepts/web-ui-features]] — control-cluster styling conventions applied to the graph page

## Related Sources

- [[sources/back-704-graph-view-web-ui]] — introduced the accent tint this task removes (same batch)

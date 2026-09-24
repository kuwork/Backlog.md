---
id: BACK-705
title: >-
  Unify the graph control cluster styling so the overview key matches its
  neighbours
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 21:10'
updated_date: '2026-09-24 21:23'
labels: []
milestone: m-9
dependencies:
  - BACK-704
ordinal: 275400
actual_start: '2026-09-24 21:11'
actual_end: '2026-09-24 21:23'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every key in the graph control panel shares one neutral style - the overview (fit) key drops its accent tint, so no key reads as a different class of action.

Context: the tint was introduced while the overview key sat between the zoom pair (BACK-704 review polish). It now owns the panel top-left cell, so the tint only adds a second visual weight next to its neighbours.

The legend half of the original request needs no code. Clicking a node-kind entry already dims the legend chip and hides that kind inside the graph (BACK-704, commit bb5eee44); re-measured live on 2026-09-24 against the source server: chip opacity 1 -> 0.4, the 4 task nodes 1.00 -> 0.00 with pointer-events none, edges 0.50 -> 0.00, and a second click restores both. The only legend entries without a toggle are the three edge-type lines (static, by design).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The overview key renders with the same border, background and text colours as the pan and zoom keys, in light and dark themes, and no accent-tinted button variant is left in GraphView
- [x] #2 The control panel keeps its 3-column grid - overview top-left, pan cross centred, minus/plus in the outer columns of the bottom row - with every key at its previous screen position
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - One style for the cluster
- 1.1 src/web/components/GraphView.tsx: drop the accent branch of CtrlButton plus the flag handed to the overview key, so the component carries a single button style.
- 1.2 Leave the 3-column grid and every key cell where they are; only the colours change.
- 1.3 Re-run the layout probe (tmp/gfit-btn.sh) against the source server: identical computed colours per key, identical getBoundingClientRect for all seven keys.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
GraphView.tsx: CtrlButton loses its accent variant entirely - the prop, its JSDoc and the blue class string are gone, and the overview key renders through the plain branch, so all seven keys in the control panel carry one style. The panel stays the same 3-column grid; no cell moved.

Verified against the source server on port 6478 with a throwaway corpus (BACKLOG_CWD=tmp/back698-proj) by reading the computed colours of all seven keys before and after the edit, in light and dark. Distinct background / border / text values went 2/2/2 -> 1/1/1 in both themes, i.e. the overview key stopped being its own group; every key kept its rectangle (overview 339,152 - up 377,152 - left 339,190 - down 377,190 - right 415,190 - minus 339,228 - plus 415,228). Probe: tmp/gbtn-color.sh; screenshots tmp/gbtn-light.png / tmp/gbtn-dark.png.

The legend half of the request needed no code. Clicking a node-kind chip already dims it and hides that kind in the graph (BACK-704, commit bb5eee44), re-measured live: chip opacity 1 -> 0.4, all 4 task nodes 1.00 -> 0.00 with pointer-events none, edges 0.50 -> 0.00, and a second click restores both. Probe: tmp/glegend.sh.

Gates: bunx tsc --noEmit clean; bun test --timeout 240000 src/test/web- = 293 pass / 0 fail across 42 files.
<!-- SECTION:NOTES:END -->

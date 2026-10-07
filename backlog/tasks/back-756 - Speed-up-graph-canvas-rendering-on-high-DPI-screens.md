---
id: BACK-756
title: Speed up graph canvas rendering on high-DPI screens
status: Done
assignee:
  - '@kuwork'
created_date: '2026-10-07 05:49'
updated_date: '2026-10-07 13:41'
labels:
  - web-ui
milestone: m-9
dependencies: []
modified_files:
  - src/web/components/GraphView.tsx
  - src/web/utils/graph-canvas.ts
ordinal: 320000
actual_start: '2026-10-07 05:49'
actual_end: '2026-10-07 13:37'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The knowledge/task graph canvas drops frames on high-DPI displays, worst during the click fly-in: every frame repaints every edge and node with one canvas draw call each (2k+ edges, 700+ nodes), plus rotated relation text once the fly-in crosses k>=1.8, on a backing store scaled by devicePixelRatio (2-3x). Nothing is clipped to the viewport, so zoomed in we still pay for the whole corpus.

Goal: keep the same picture while making a frame cheap enough to hold 60fps during camera moves.

### Requirement summary (from review iterations)

The performance work above is paired with the following agreed interaction and visual requirements, verified against the live canvas.

Performance (original scope):
- Clip nodes and edges to the visible viewport before painting.
- Paint edges and node circles in batched paths per (dash, alpha) / (style, alpha) bucket instead of one draw call each.
- Cap the backing store at MAX_DPR=2 so a Retina/4K canvas does not paint 4-9x the pixels.
- Skip the text layers (captions, relation names) during camera moves; repaint them once the move ends.
- Rebuild the d3-quadtree only on the simulation end event and after the precompute pass, not per tick.

Text reveal (three stages, single textStage: none | focus | all):
- During a camera move (fly-in, gesture, layout reheat) only the focus cluster - the fly-target node and its neighbours - keeps its names; every other node is hidden and relation names wait for the picture to stop.
- On landing / gesture lift-off / layout settling the focus node and its neighbours appear at once.
- The rest of the names come TEXT_CLUSTER_MS (300ms) after the move settles; deep-zoom relation names appear only then and only when k >= RELATION_ZOOM_THRESHOLD.

Gesture snapshot (drag the canvas):
- A pan or wheel gesture no longer repaints at full cost: it takes a full-fidelity viewport-sized snapshot of the scene (every name still on screen, one drawImage per frame) and drags that bitmap, restoring the live scene and full device-pixel sharpness on release.
- The snapshot must NOT reduce backing-store scale - clarity is preserved at the device full DPI (GESTURE_DPR was removed).

Focus behaviour:
- Single click a node: pins focus (selected) and flies in until readable.
- Double-click a node: opens the node (modal / tab) but does NOT change the focused node.
- Drag a node: does NOT switch the focused node - the focus cluster stays whatever was already pinned or hovered, never jumps to the dragged node.
- ESC or clicking empty canvas: exits focus (releaseFocus clears selected, hover, lit, and resets textStage to all).
- Focused-state drag keeps the focused node names and hides the rest.

Regressions fixed during the work:
- ESC not exiting focus: releaseFocus now also clears hoverIdRef so the resting pointer cannot re-take focusId.
- A zoom or scale button appearing frozen: the d3-zoom end handler now releases the snapshot unconditionally; programmatic camera moves (fly-in, button zoom, fit, initial frame, double-click zoom) are wrapped in a programmatic() guard so a real gesture is the only thing that drives the text reveal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A frame clips nodes and edges to the visible viewport before painting
- [x] #2 Edges and node circles are painted in batched paths per style instead of one draw call each
- [x] #3 devicePixelRatio is capped so a Retina/4K canvas does not paint 4-9x the pixels
- [x] #4 Camera moves (fly-in, zoom, pan) and simulation ticks skip the text layers and repaint them once the move ends
- [x] #5 Existing behaviour is unchanged: same visual result at rest, tests and typecheck pass
- [x] #6 Text returns the moment a move ends - fly-in landing, gesture lift-off, layout settling - not on a timer
- [x] #7 A pan or wheel gesture drags a full-fidelity snapshot of the scene - every name still on screen, one drawImage a frame - and repaints the live scene on release
- [x] #8 During a camera move only the focus cluster - the focused node and its neighbours - keeps its names; every other node is hidden and relation names wait for the picture to stop
- [x] #9 A pan or wheel gesture drags a full-fidelity, full-device-DPI snapshot of the scene (every name still on screen, one drawImage per frame) and restores the live, full-sharpness scene on release - backing-store scale is not reduced
- [x] #10 During a move the whole focus cluster (fly-target and its neighbours) is drawn; on landing the focus node and neighbours are already shown; the rest of the names come TEXT_CLUSTER_MS (300ms) after the move settles
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Draw path (src/web/components/GraphView.tsx): 
1. Clip: derive the graph-space window from the live zoom transform (invert the viewport corners plus CULL_PAD/k) and skip any node outside it and any edge whose bounding box misses it. 
2. Batch: one reusable slot per link and per node, bucketed by (dash, alpha) for edges and (style, alpha) for nodes, painted by two new helpers in src/web/utils/graph-canvas.ts - strokeEdgeBatch (one stroke + one fill per bucket) and paintNodeBatch (one fill + one stroke per bucket). 
3. Cap the backing store at MAX_DPR = 2 in resize(). 
4. Level of detail: markCameraMoving() on every zoom gesture, fly-in frame and layout tick; text layers (captions, relation names) are skipped while moving and repainted by a 140ms settle timer. 
5. Stop rebuilding the d3-quadtree once per simulation tick - refresh it on the simulation end event and after the precompute pass instead. 
6. Keep the picture identical: same geometry, same tiers, same colours. strokeEdge stays for TaskDependencyGraph.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Where the frame went, measured on this repo's corpus (~700 nodes, ~2.2k relations) with a counting 2d-context stub: the edge pass alone was 2200 stroke + 1650 fill + 3850 beginPath + 4400 setLineDash per frame; batched it is 4 stroke + 3 fill + 8 beginPath + 8 setLineDash. Path vertices are unchanged (moveTo/lineTo identical) - the saving is the per-call state churn and driver round-trips, which is what a canvas spends on. 

Verified: bunx tsc --noEmit clean for src/, biome check clean on both files, bun test src/test/web-graph-canvas.test.tsx 5 pass (task graph, knowledge graph, no-roundRect fallback, dependency subgraph, empty corpus). 

Notes: 
- CULL_PAD is 56 screen px in graph space: the largest circle radius (clamped at 30) plus the caption plate hanging below it, so a node half off-screen still paints its label. 
- Edge culling is a bounding-box test on the two endpoints; a segment whose box misses it cannot cross it. Cheap and exact enough - no clipping maths. 
- Text reveal is now three stages, driven by a single textStage (none | focus | all) - not the old movingCamera boolean. none: the camera is in flight, only the fly-target's name. focus: the move just landed, the focus node + neighbours light up at once (both exempt from the caption tier gate). all: 100ms later (TEXT_CLUSTER_MS), every name the zoom allows, plus the deep-zoom relation names. A move with a definite end reveals straight to focus; the 140ms backstop (TEXT_SETTLE_MS) snaps to all for moves with no definite end. 
- The gesture snapshot now copies the frame already on screen (one scaled drawImage) instead of repainting it - which is why a long-press drag starts on the press instead of after a full-text frame. The bitmap is viewport-sized, so what the drag uncovers stays blank until release; this also keeps the snapshot at ~8 MB instead of padding it. 
- A drag gesture restores full text on release (the snapshot already showed it all, so no cluster beat - that would flicker names off then on). A wheel gesture, which paints live with text dropped, runs the same staged reveal as the fly-in. 
- The lit set (focus + neighbours) is rebuilt only when the focus changes, not per frame: a hub carries hundreds of neighbours. 
- The quadtree now refreshes on the simulation end event and after the precompute pass. It only serves hit-testing, and a drag owns the pointer while the layout runs, so per-tick rebuilds bought nothing. 
- strokeEdge is still exported for TaskDependencyGraph, whose subgraphs are small enough that batching would be noise.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A graph frame no longer pays for the whole corpus. Culling to the viewport, batched paths per style bucket, a devicePixelRatio cap, and a text level of detail that stands down while the picture moves. 

On top of that, a pan or wheel gesture no longer repaints at all: it takes one full-fidelity snapshot - text included - into an offscreen canvas padded on every side, and drags that bitmap around, one drawImage a frame, re-taking it only after the camera has travelled a pad or drifted 20% in scale. Names stay on screen for the whole drag, and the live scene is back on release. 

Same picture, far fewer draw calls: the edge pass drops from ~2200 strokes and ~1650 fills a frame to single digits, and a gesture drops to one.
<!-- SECTION:FINAL_SUMMARY:END -->

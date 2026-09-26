---
title: BACK-704 D3.js task graph visualization page in the Web UI
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - graph
  - web-ui
source_path: backlog/tasks/back-704 - D3.js-task-graph-visualization-page-in-the-Web-UI.md
---

# BACK-704 D3.js task graph visualization page in the Web UI

Adds a Neo4j-style graph page to the Web UI on top of BACK-703's `/api/graph` payload (doc-014 §4 view layer), and — same day — moves graph artifacts out of the project tree into a slot-keyed OS cache with a lock-takeover protocol.

## Summary

- Navigation/routing: Graph entry below Statistics in SideNavigation, `/graph` registered in the SPA fallback; opening a node pushes its popup over the graph via `backgroundLocation`, so closing lands back on the graph with the viewport untouched (milestones included)
- `GraphView.tsx` carries the whole surface: selective d3 imports, a synchronous 250-tick precomputed layout that re-heats only on drag, and a constant-screen-size rule — every graph-space quantity (radius, dashes, arrowheads, captions, edge labels) is divided by the live zoom factor `k`, re-applied from the zoom handler
- Visual grammar: screen-constant radius encodes degree (sqrt into 6–20px), per-kind fill + tinted outline, caption plates with entity codes disclosed in three zoom tiers, relation names on edges at deep zoom, clickable legend filtering kinds; DependsOn solid, ParentOf dashed (arrowhead at parent), BelongsToMilestone dotted
- Interaction: hover/click neighbourhood focus (rest fades to 0.18/0.06) with a pinned selection surviving modal round-trips; click either flies the camera to a readable zoom (600ms eased) or opens the details modal; keyboard layer (arrows pan, Ctrl+]/[ zoom, Ctrl+0 overview, Esc clear)
- Bun bundles a second d3-selection copy lacking `interrupt()`, which d3-zoom calls — patched the held prototype and set zoom duration 0; cold-start fast path now requires `nodeCount > 0` so a warm-but-empty cache never serves an empty graph
- Slot-keyed cache: graph artifacts moved to the OS cache dir as `backlog-graph-<sha256-16>.{kuzu,kuzu.meta.json,kuzu.lock}`, hashed from lowercased project path + slot (web = bound port, TUI = "tui", default) so two browser sessions never contend; `BACKLOG_GRAPH_CACHE_DIR` overrides (tests pin it via `bunfig.toml` preload)
- Lock takeover: `startGraphService(core, {slot, onChanged?, onColdStart?, onLockConflict?})` is the single host entry; the CLI handler recycles dead pids with a notice, asks y/N on a TTY only (never blocks piped) for live holders; without a handler the old silent 503-degraded behavior holds
- Control-cluster review polish: overview moved out from between the zoom pair into a 3-column grid (top-left cell) with an accent tint, so a near miss no longer reads as zoom
- Verified in a real browser against a seeded project: camera fly-in, focus pin, arrowhead rim gap stays 2px from k=0.05 to k=4, two sessions each owning a database

## Acceptance Criteria

- Graph nav entry + route; interactive force-directed zoom/pan/drag rendering of `/api/graph`
- Node kinds and edge types visually distinguished with a legend; click opens the details modal
- `graph-updated` WS messages refetch in place; 700+ nodes stay interactive
- Slot-keyed OS-cache artifacts, two sessions coexist; dead-pid recycle and TTY-only takeover prompt
- `startGraphService` as single host entry; control cluster grid keeps every key at its original position

## Related Concepts

- [[concepts/web-ui-features]] — modal popup, legend and control conventions the page follows
- [[concepts/web-server]] — SPA fallback, WS broadcast and graph hosting this page rides on

## Related Sources

- [[sources/back-703-graph-incremental-sync]] — `/api/graph` payload and `graph-updated` broadcast (same batch)
- [[sources/back-705-graph-control-cluster-styling]] — follow-up removing the overview accent tint (same batch)
- [[sources/back-710-task-modal-relationship-graph]] — mini graph view modeled on this page (same batch)

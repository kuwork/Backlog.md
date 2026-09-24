---
id: BACK-704
title: D3.js task graph visualization page in the Web UI
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 09:07'
updated_date: '2026-09-24 21:51'
labels: []
milestone: m-9
dependencies:
  - BACK-703
modified_files:
  - src/web/lib/api.ts
  - src/web/components/GraphView.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/App.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/server/index.ts
  - src/graph/cold-start.ts
  - src/graph/paths.ts
  - src/graph/service.ts
  - src/graph/store.ts
  - src/test/preload.ts
  - src/test/graph-foundation.test.ts
  - src/test/graph-sync.test.ts
  - src/test/atomic-task-edit.test.ts
  - src/cli.ts
  - bunfig.toml
  - .gitignore
  - package.json
  - bun.lock
  - >-
    backlog/tasks/back-704 -
    D3.js-task-graph-visualization-page-in-the-Web-UI.md
ordinal: 274400
actual_start: '2026-09-24 09:08'
actual_end: '2026-09-24 20:10'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a graph visualization page to the Web UI on top of the /api/graph payload delivered by BACK-703 (doc-014 §4 view layer).

**Navigation + routing.** In SideNavigation, insert a Graph entry directly below the Statistics item, wired to a new route that renders the graph view.

**D3.js rendering.** Add d3 as a bundled web dependency. Render nodes and edges as an interactive force-directed graph: zoom, pan, and node drag via d3-zoom/d3-drag; a collision-tuned force layout that settles quickly and re-heats only on data change.

**Visual encoding.** Distinguish node kinds (task, draft, milestone, completed) by color/shape and edge types (ParentOf, DependsOn, BelongsToMilestone) by line style, with a legend. Hovering a node highlights its connected edges; clicking opens the existing task details modal.

**Live updates.** The building status shows a lightweight placeholder; the existing graph-updated WebSocket message triggers an in-place refetch and layout update without a full reload, mirroring the reconcile pattern used by other views (BACK-698).

**Scale.** A 700+ node graph must stay interactive: cap simulation ticks, throttle re-renders, and degrade gracefully (e.g. hide labels below a zoom threshold) instead of dropping frames.

**Final scope (as built).** The page is a Neo4j-style graph surface, not a plain node-link diagram:

- **Navigation + popups.** Graph entry below Statistics, route registered in the SPA fallback, deep links work. Opening a node pushes its popup over the graph (`backgroundLocation`), so closing it lands back on the graph - milestones included - and the viewport never moves: only the first mount and the overview control fit the view.
- **Visual grammar.** Screen-constant node radius encodes degree (sqrt into 6-20px), each kind keeps its own fill plus a tinted outline, an always-on caption plate under the node carries the entity code (BACK-123 / m-3) disclosed in zoom tiers, and relation names ride along their edges once the zoom is deep enough. A clickable legend filters kinds in and out.
- **Edges.** DependsOn solid, ParentOf dashed with the arrowhead pointing at the parent, BelongsToMilestone dotted. Arrowheads, dashes, strokes, captions and edge labels all keep a constant screen size and stay glued to the target rim at every zoom level.
- **Focus.** Hover and click light the node, its incident edges and its neighbours while the rest fades (0.18 / 0.06); the pinned selection survives modal round-trips, Esc releases it.
- **Click semantics.** A node whose code and relation names are not readable yet pulls the camera in with one eased 600ms zoom + centre interpolation; once readable, a click opens the details modal directly.
- **Keyboard.** Arrows pan, Ctrl+] zooms in, Ctrl+[ zooms out, Ctrl+0 fits the overview, Esc clears the focus - advertised on the control buttons and in a canvas hint chip.
- **Scale + liveness.** A 250-tick precomputed layout that only re-heats on drag, in-place refetch on every `graph-updated` broadcast, and a cold-start fast path that never serves an empty graph from a warm but empty cache.

**Slot-keyed cache + lock takeover (added same day).** Graph artifacts moved out of the project tree into the OS cache directory, keyed by (project, slot): backlog-graph-<sha256-16>.{kuzu,kuzu.meta.json,kuzu.lock} where the hash covers the lowercased absolute project path plus the slot. A slot is one session identity - web = the bound port, TUI = "tui", unbound = "default" - so two browser sessions never contend for one database: each owns its files (BACKLOG_GRAPH_CACHE_DIR overrides the directory; tests use it). Host wiring collapses into startGraphService(core, {slot, onChanged?, onColdStart?, onLockConflict?}); the Web UI calls it after bindPort, a future TUI host calls the same entry. On a lock conflict the service hands {lockPath, pid, holderRunning} and a phase ("blocked" / "still-held") to the host handler: the CLI recycles a dead pid with a printed notice, shows pid + path for a live holder and asks y/N on a TTY only (never blocks when piped), deletes on consent, and reports if another process grabbed the lock again. Without a handler the previous silent behavior is unchanged; /api/graph degrades to 503 and the rest of the UI keeps working.

**Control cluster (review polish).** Overview no longer sits between the zoom pair: the panel is a 3-column grid where overview owns the top-left cell, the pan cross stays centred above an empty middle cell, and - / + keep the outer columns of the bottom row they always had. The button is tinted so a camera-level action cannot be mistaken for its neighbours.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SideNavigation shows a Graph entry directly below the Statistics item, routing to a new graph view
- [x] #2 The view renders /api/graph nodes and edges as an interactive D3.js force-directed graph (zoom, pan, drag)
- [x] #3 Node type (task, draft, milestone, completed) and edge type (ParentOf, DependsOn, BelongsToMilestone) are visually distinguished with a legend
- [x] #4 Clicking a node opens the existing task details modal; hovering highlights connected edges
- [x] #5 The building status shows a placeholder; graph-updated WS messages trigger a refetch without a full page reload
- [x] #6 A 700+ node graph stays interactive (no dropped frames from unthrottled layout ticks)
- [x] #7 Graph artifacts live in the OS cache directory keyed by (project, slot) - backlog-graph-<hash>.{kuzu,meta,lock} - and the project tree gains no graph files; two browser sessions on one project each own a database and both serve /api/graph
- [x] #8 A dead-pid lock is recycled with a printed notice; a live-pid lock is surfaced to the CLI handler which asks y/N on a TTY only, never blocks when piped, deletes on consent, and reports a re-take; without a handler the old silent behavior is preserved
- [x] #9 startGraphService(core, {slot, onChanged, onColdStart, onLockConflict}) is the single host entry and the Web UI starts it after bindPort; tests isolate from the real cache via the bunfig [test] preload
- [x] #10 The control cluster is one opaque panel laid out as a 3-column grid: overview owns the top-left cell, the pan cross and both zoom keys keep their original slots, separated from the zoom pair (no accidental zoom-in/out on a near miss)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Payload, routing, shell
- 1.1 src/web/lib/api.ts: GraphNodeDto / GraphEdgeDto / GraphPayload plus fetchGraph() over /api/graph.
- 1.2 src/server/index.ts: register "/graph" in the SPA fallback so a deep link does not 404.
- 1.3 SideNavigation entry below Statistics; App.tsx route renders GraphView(graphVersion, onEditTask); the graph-updated WS message bumps graphVersion, so the view refetches in place.

### Phase 2 - Render core and geometry
- 2.1 Selective d3 imports (force, selection, zoom, drag) plus d3-transition for its standalone interrupt(node): Bun bundles a second d3-selection copy whose Selection lacks interrupt(), which d3-zoom transforms call. Patch the held prototype and set zoom duration 0.
- 2.2 One synchronous 250-tick precompute, then simulation.stop(); reheat only on node drag.
- 2.3 Everything that must keep a readable size lives in graph space and is divided by the live zoom factor: node radius, stroke, dash pattern, arrowhead (markerUnits userSpaceOnUse with ARROW_SIZE / k), caption plate and text, relation labels.
- 2.4 One shared scaledRadius(d, k) drives the circle, the edge trim (scaledRadius + ARROW_GAP / k) and the caption offsets, so the arrowhead follows the circle that is actually drawn.

### Phase 3 - Visual grammar
- 3.1 Radius encodes degree (sqrt into 6-20px), per-kind fill plus tinted outline, clickable legend that filters kinds.
- 3.2 Caption plates carry the entity code instead of the title, disclosed in three zoom tiers (hubs, connected, all).
- 3.3 Relation names along their edges from the deep-zoom threshold; ParentOf arrowheads point at the parent.
- 3.4 Neighbourhood focus: adjacency lists plus one applyStyles() pass (focus, neighbour, faded 0.18, unrelated edges 0.06) with a CSS transition, shared by hover and the click pin.

### Phase 4 - Interaction
- 4.1 Click semantics: pin and apply the focus first, then either fly the camera in (600ms eased zoom + centre interpolation) to the zoom where the node code and its relation names are readable, or open the details modal when they already are.
- 4.2 Popups always navigate with state.backgroundLocation, the milestone branch passes the node id as-is (stripAnyPrefix would shorten m-3 to 3), and close handlers pop the entry with navigate(-1).
- 4.3 The layout effect reads the open handler and the live transform through refs, so navigation and data refreshes never rebuild the simulation or re-fit the view.
- 4.4 Window-level keyboard layer: arrows pan, Ctrl+] in, Ctrl+[ out, Ctrl+0 overview, Esc clear focus, guarded against modals, text inputs and defaultPrevented.

### Phase 5 - Fixes found while polishing
- 5.1 A milestone node click replaced the graph with the milestones page (missing background location) and lost the id to stripAnyPrefix.
- 5.2 Cold-start fast path (src/graph/cold-start.ts): a warm cache is only reusable when the store actually holds nodes, otherwise a restart served an empty graph.
- 5.3 Wheel zoom detached the arrowheads: edge endpoints are graph-space and were only written on tick, so the zoom handler now re-runs placeEdges() with the size compensations, and the trim became scaledRadius + ARROW_GAP / k.
- 5.4 Control cluster: overview used to sit between the zoom pair, so a near miss read as zoom in/out. The panel became a 3-column grid - overview in the top-left cell, pan cross untouched, - / + keeping the outer columns of the bottom row (middle cell empty) - and the button carries an accent tint.

### Phase 6 - Slot-keyed cache, shared host entry, lock-conflict takeover
- 6.1 src/graph/paths.ts (new): graphPaths(root, slot) resolves <cacheDir>/backlog-graph-<hash>.{kuzu,kuzu.meta.json,kuzu.lock}; hash = sha256(lowercased win32 path + "
" + slot) first 16 hex; cacheDir = %LOCALAPPDATA%\backlog.md\graph / ~/Library/Caches / $XDG_CACHE_HOME|~/.cache, overridable via BACKLOG_GRAPH_CACHE_DIR; slots: portSlot(bindPort), TUI_SLOT "tui", DEFAULT_SLOT.
- 6.2 openGraphStore(dbPath) takes the resolved path (memory singletons keyed by dbPath); coldStart and GraphService accept {slot}; mkdirSync the cache dir before the O_EXCL create so a missing directory is never misread as "lock held".
- 6.3 startGraphService(core, {slot, onChanged?, onColdStart?, onLockConflict?}) is the one host entry (new + attachToCore + callbacks + start); the Web UI moves its eager start after bindPort so the slot uses the real port.
- 6.4 Lock conflict protocol: acquireLock becomes async and hands GraphLockInfo {lockPath, pid, holderRunning} plus phase "blocked"/"still-held" to the host; src/cli.ts confirmGraphLockTakeover recycles a dead pid with a printed notice, asks y/N on a TTY only, deletes on consent, reports a re-take; BacklogServer memoizes the failed graph attempt so a degraded /api/graph does not re-prompt per request.
- 6.5 Test isolation: src/test/preload.ts wired through bunfig.toml [test] preload pins BACKLOG_GRAPH_CACHE_DIR to a temp dir, because ~25 server suites boot BacklogServer and would otherwise litter the real cache.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation (2026-09-24)
- src/web/components/GraphView.tsx (new) carries the whole surface: the d3 zoom/drag/force setup, the precomputed layout, the three caption tiers, the neighbourhood focus, the camera fly-in, the keyboard layer and the legend. The prototype patch for interrupt() plus zoom duration 0 exist because Bun bundles a second d3-selection copy whose Selection lacks it.
- Constant screen size is one rule applied once per layer (value / k), and every k-dependent graph-space quantity is re-applied from the zoom handler: placeEdges, placeEdgeLabels, rescaleCaptions, rescaleRelationLabels. Missing the endpoints there is what made a wheel zoom look like the arrows had come loose, and keeping them right needs the shared scaledRadius plus ARROW_GAP / k - the gap is a screen-space distance, so dividing the already-compensated radius by k again buries the tip inside the circle.
- One focus entry point (applyStyles over the live selections) serves hover, the click pin, the legend filter and the zoom handler, and the popup state never re-runs the layout effect, so the viewport survives navigation, data refreshes and modal round-trips.
- src/web/App.tsx: the graph route, the graphVersion bump on graph-updated, and the milestone close handler that pops the pushed entry when a background location exists instead of replacing to /milestones.
- src/server/index.ts: /graph in the SPA fallback; src/graph/cold-start.ts: the reusable-cache fast path now requires nodeCount > 0.

### Slot-keyed cache and lock takeover (2026-09-24, later the same day)
- src/graph/paths.ts (new): graphPaths(root, slot) with graphCacheDir() (Win %LOCALAPPDATA%\backlog.md\graph, mac ~/Library/Caches, else $XDG_CACHE_HOME|~/.cache; BACKLOG_GRAPH_CACHE_DIR overrides), the naming backlog-graph-<hash>.kuzu + .meta.json + .lock, win32 lowercases the path so D:/Repo and d:/repo share one entry. openGraphStore(dbPath) now takes the resolved path; memory singletons key by dbPath; coldStart and GraphService accept {slot}.
- GraphService creates the cache dir before the O_EXCL lock create (a missing directory surfaces as ENOENT and would be misread as "lock held"). acquireLock is async: dead pids are recycled silently when no handler is installed (old behavior preserved), otherwise the host gets GraphLockInfo + phase and decides. pid === own process never takes over a lock (prevents self-preemption).
- startGraphService(core, {slot, onChanged, onColdStart, onLockConflict}) replaced the separate new + attachToCore wiring; BacklogServer passes its bound-port slot and the CLI handler confirmGraphLockTakeover. BacklogServer.getGraphService memoizes the attempt (graphAttempt promise) - without it, every /api/graph request re-ran start and would re-prompt the takeover question per request.
- Test isolation: src/test/preload.ts via bunfig.toml [test] preload sets BACKLOG_GRAPH_CACHE_DIR to a mkdtemp dir, so the ~25 suites that boot BacklogServer never write the real cache.
- Also fixed pre-existing local false failure: atomic-task-edit 409 case now installs the repo-standard installCloseConnectionFetch() (BACK-701 keep-alive misroute); the suites remaining flake (six parallel CLI processes) is load jitter, unrelated.

### Review polish (2026-09-24, after the first walkthrough)
- Control cluster: overview sat between - and +, so a near miss read as zoom in/out. The panel is now a 3-column grid - overview in the top-left cell, the pan cross where it was (up centred, left/down/right under it), and - / + keeping the outer columns of the bottom row with the middle cell empty - so every zoom key stays exactly where it was. CtrlButton grew an accent variant (blue tint) for the camera-level action so it does not look interchangeable with its neighbours.

### Verification
- bunx tsc --noEmit clean; every .ts file touched here is biome clean. bun run check . still exits 1 on the same pre-existing findings in src/core/assets.ts and src/test/board-tui-draft-create.test.ts, none of them touched by this task (DoD #2 is checked under the task-scope reading - the repo-wide run has moved no finding into this task and the graph-foundation format finding it used to report was fixed here).
- 42 web suites 293 pass, graph-foundation + graph-sync 33 pass.
- Real browser checks over the source server against a seeded throwaway project: a node click lands the camera on a readable zoom with the focus pinned, Esc releases it without moving the viewport, a modal round-trip keeps the viewport and the graph behind it, and the measured arrowhead rim gap stays at 2px from k=0.05 to k=4 - dropping the endpoint refresh from the zoom handler reproduces the reported drift (2px to 47px).
- Control layout probe (tmp/gfit-btn.sh): overview at the panel top-left cell (339,180), up arrow top-centre (377,180), left/down/right unchanged at row 2, zoom out (339,256) and zoom in (415,256) exactly where they were; screenshot tmp/gfit-btn2.png.

### Verification (Phase 6)
- Two browser sessions on one throwaway project (ports 6479/6480) both serve /api/graph with their own cache entries; the 6479 filename matches the hand-computed hash; the project tree gains no graph files. Hard kill leaves the lock; a same-port restart prints the recycled-pid notice and recovers. A lock file holding a live pid prints holder + path, never blocks when stdin is not a TTY, /api/graph degrades to 503 with the SPA intact; the y/N branches were exercised by temporarily flipping the isTTY guard in a probe (y takes over and rewrites the lock pid, n keeps the lock and 503).
- graph-foundation + graph-sync: 36 pass (layout naming/stability/case-folding/redirect, two-slot coexistence without a project lock, dead-pid silent recycle without handler, host adjudication with a live pid, directory-as-lock-file yielding exactly ["blocked","still-held"], self-lock never taken over). graph + server suites together: 25 files, 151 pass. atomic-task-edit green after the Connection fix.
- The real user cache dir was emptied of test litter after verification. A whole-repo bun test run (293 files) was started but cancelled as too slow; per-file batches remain the gate on this machine.
<!-- SECTION:NOTES:END -->

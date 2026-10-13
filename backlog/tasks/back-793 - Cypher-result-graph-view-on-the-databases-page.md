---
id: BACK-793
title: Cypher result graph view on the databases page
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 14:39'
updated_date: '2026-10-13 17:18'
labels:
  - web-ui
  - graph
milestone: m-13
dependencies:
  - BACK-771
modified_files:
  - src/cli.ts
  - src/graph/browser.ts
  - src/graph/service.ts
  - src/graph/store.ts
  - src/server/index.ts
  - src/web/components/CypherResultGraph.tsx
  - src/web/components/GraphCanvas.tsx
  - src/web/components/GraphDatabases.tsx
  - src/web/components/GraphLegend.tsx
  - src/web/components/GraphView.tsx
  - src/web/lib/api.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/utils/cypher-graph.ts
  - src/web/utils/graph-canvas.ts
  - src/web/utils/graph-palette.ts
  - src/test/cypher-graph.test.ts
  - src/test/web-cypher-result-graph.test.tsx
  - src/test/web-graph-palette.test.ts
ordinal: 352001
actual_start: '2026-10-13 14:49'
actual_end: '2026-10-13 17:18'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The databases page (BACK-771 #3) renders a read-only Cypher result as a generic table only. A user asked for the same result to also read as a knowledge graph: nodes and relations drawn with the corpus graph's interactions - zoom and pan, hover highlight, click focus with fly-in, node drag, legend toggles - minus the in-view Cypher search, which belongs to the corpus graph page and would duplicate the Cypher box already on this page.

The blocker is the transport, not the renderer: serializeCypherValue strips _id from node cells and _src/_dst from relationship cells, so a result row carries no way to tell which edge connects which nodes. The canvas machinery itself already exists in GraphView and must be shared, not copied.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The result area offers three view modes - table, graph, and both at once - and the chosen mode survives re-running the same statement.
- [x] #2 The graph pane draws the result as nodes and relations: node cells become deduplicated nodes, relationship cells become edges joined to their endpoints through the internal ids, and path cells expand to their node/relation chain. A result carrying no node (e.g. RETURN count(*)) shows an empty state instead of a broken canvas.
- [x] #3 The graph pane's interactions match the knowledge graph exactly: wheel and double-click zoom, drag pan, the control cluster (fit, pan cross, zoom pair), keyboard shortcuts (arrows, Ctrl+[ / Ctrl+] / Ctrl+0 / Escape), delayed hover with tooltip and neighbour dimming, click-to-focus with camera fly-in, node drag with simulation reheat, caption tiers with relation names at deep zoom, and a legend that toggles node labels and lists the relation types. It has no Cypher search control.
- [x] #4 Relationship endpoints survive serialization: a node cell keeps its internal id and a relationship cell keeps both endpoint ids, so the client can join edges to nodes, while the result table and the CLI printer keep hiding these internal keys.
- [x] #5 The canvas machinery is shared with GraphView through one component instead of a second copy: GraphView's existing behaviour, including its Cypher filter camera rules, is preserved and the existing web-graph-canvas smoke tests still pass.
- [x] #6 The graph title carries a fullscreen toggle whose icon is the memo board's, so the pane can be read at screen size and put back.
- [x] #7 A legend entry stays in the legend when it is switched off - dimmed and struck through, the way the task graph does it - so whatever is hidden can be shown again. The legend is built from the whole result, not from what is currently drawn.
- [x] #8 The interactive 500-row display cap is a rendering budget, not a limit on the data: a checkbox on the Cypher box asks for every row, and the CLI's `graph query --all` does the same. The table says when it is showing a capped result.
- [x] #9 Node tables Backlog.md writes for itself - `Meta`, the store's own key/value shelf - are tagged as internal. The result graph leaves them out of the picture and says how many it hid, while the legend keeps their entry so they can be shown: a corpus of 1599 business nodes draws 1599 circles, not 1600.
- [x] #10 "View ALL" sits alongside the one-click schema examples: one click fills the Cypher box with the statement returning every node together with whatever relationship touches it, and runs it - against the database the box is scoped to.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/graph/store.ts: serializeCypherValue keeps _id on node cells and _src/_dst on relationship cells (the toString-recovery path already carries them).
2. src/web/utils/cypher-graph.ts: a pure graphFromCypherResult(result) that walks every cell of every row - nodes deduplicated by internal id, edges joined through _src/_dst, paths expanded, arrays recursed - plus unit tests.
3. src/web/components/GraphCanvas.tsx: extract GraphView's canvas engine (force layout with precomputed ticks and persisted positions, d3-zoom with snapshot-blit drags, quadtree hit-testing, delayed hover, click focus with fly-in, node drag reheat, staged text reveal, batched painting, keyboard and control-cluster chrome) into one configurable component.
4. GraphView consumes GraphCanvas; its Cypher filter camera rules are expressed as a camera token plus an explicit restore request, so the shipped behaviour and its acceptance criteria stay intact.
5. src/web/utils/graph-palette.ts: a deterministic label-to-colour palette (theme aware) for arbitrary user labels, reusing the legend components.
6. CypherResultGraph.tsx: header with counts and legend plus GraphCanvas, no search control.
7. GraphDatabases.tsx: view mode toggle (table / graph / both) with the graph pane sized against the viewport; cellText hides internal keys in the table.
8. Locale keys in all four web locales; unit and smoke tests; bunx tsc --noEmit, bun run check ., bun test.
9. Fullscreen toggle on the result graph's title, reusing the memo board's icon and the browser's fullscreen API - the icon follows document.fullscreenElement, because the reader can also leave with Esc.
10. Legend entries built from the whole result set rather than the visible subset, so toggling a label off never removes its own switch.
11. A way past the 500-row display cap: the Cypher box's "every row" checkbox posts a null cap through /api/graph/db-cypher, and `graph query --all` does the same on the CLI. The cap is a rendering budget, so the result keeps telling the reader when it is capped.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### #1 Transport: the internal handles now survive serialization (src/graph/store.ts)

`serializeCypherValue` keeps `_id` on node cells and `_src`/`_dst` on relationship cells, and the two transport paths now speak one identity format:

- The structured path hands the handles over as embind InternalID structs (`{offset, table}`, both BigInt). They are normalised to the `table:offset` string the text path already prints, so a client joins an edge to its nodes the same way whichever path a result took.
- The toString recovery path - the one any INT64 column forces a whole result onto - previously left a relationship cell as the raw string `(0:0)-{_LABEL: KNOWS, _ID: 2:0}->(0:1)` and mangled a path cell through the flat key:value scan. Both are now parsed into real values: a relationship object whose endpoints live in the same table:offset namespace a node's `_ID` does, and a path whose `_nodes`/`_rels` are actual lists. An INT64 database (the project's own `demo` is one) used to lose the graph entirely on this path.
- BigInt values are coerced to a JSON-safe number (or string past 2^53). This also fixes a pre-existing crash: a `count()` result over `POST /api/graph/cypher` used to throw inside `Response.json`.
- The CLI printer and the Web UI's `cellDisplayText` filter the internal keys back out of tables, so the terminal and the result table read exactly as before.

### #2 Extraction (src/web/utils/cypher-graph.ts)

Pure `graphFromCypherResult(result)`: walks every cell of every row, collects nodes (deduplicated by internal id, property-fingerprint fallback), joins relationship cells through `_src`/`_dst`, expands path values, recurses into lists. A relationship whose endpoints the result does not carry is counted (`danglingEdges`) and skipped rather than drawn to a nameless dot. Caption preference: name > title > key > path > filePath > id > label > code, then the first scalar property, then the label. 11 unit tests.

### #3 The shared engine (src/web/components/GraphCanvas.tsx)

GraphView's canvas machinery, lifted out verbatim and parameterised over the visual vocabulary, the position key, the camera token, the pinning rule and the open handler. Everything a reader experiences as "the graph" lives here exactly once: the force layout with its precomputed tick budget and persisted positions, d3-zoom with the snapshot-blit drag, quadtree hit-testing, the delayed hover, click-to-focus with the fly-in, node drags with a simulation reheat, the staged text reveal and the batched painting, plus the keyboard shortcuts, the control cluster and the hint panel.

The camera rules became a token map: a token's first build fits it, and returning to a token restores the camera it was left with. That reproduces GraphView's filter behaviour exactly - entering a filter fits the result set, a new query on top fits its own, clearing restores the pre-search viewport - without the `preFilterTransform`/`fitForFilter` ref pair. GraphView keeps the payload fetch, the legend and the Cypher search, and maps its kinds and relations onto the engine through a memoised visual config. `edgeStroke`/`EDGE_STROKE` moved to graph-canvas.ts (re-exported from GraphLegend) so the engine does not depend on the corpus legend module.

### #4 The result graph view (CypherResultGraph.tsx, GraphDatabases.tsx)

Header with the visible counts, a legend of node labels (palette colour, count, toggleable) and the relation types, then the engine - no Cypher search control, and a double-click zooms in rather than opening anything, because a query result has no detail page. Positions are not persisted: a result's node set is not stable across visits. Labels are hashed (FNV-1a with a finaliser - a plain `*31` hash piled short labels onto one hue, measured) onto a 12-hue ring with theme-aware strokes.

The page gained a table / graph / both switch that survives a re-run, a per-run camera token, and a graph pane sized against the viewport (78vh alone, 48vh beside a 42vh table in split mode). Four locales, five smoke tests (JSDOM, stubbed canvas) covering the switch, the engine mounting with its legend, split mode, the filtered table cells and the no-node empty state.

### #5 Fullscreen on the graph title (CypherResultGraph.tsx)

A toggle sits on the title, carrying the memo board's icon - four outward corners to enter, four inward to leave. It asks the pane's own container for fullscreen rather than the whole page, so the header and the canvas come along and nothing else does. The icon is driven by `document.fullscreenElement` instead of a click count, because a reader can leave fullscreen without us: Esc, or the browser's own chrome would otherwise leave the button reading "enter" while already inside. Where the API is absent - jsdom, an older Safari prefix - the button degrades to doing nothing rather than throwing.

### #6 The legend outlives what it hides (CypherResultGraph.tsx)

The legend was built from the *visible* nodes, so switching a label off removed the very entry that had to be clicked to bring it back; the reader was left with no way to undo. The legend now reads the whole result, and the headline above counts what is actually drawn - the two together still say "Person 12 · 9 drawn". This is what the task graph already did with its fixed eight entries; the result graph had to learn it, because its labels are whatever the user's schema happens to contain.

### #7 Past the 500-row display cap

The cap was there to keep an interactive result renderable, but it read to users as a limit on the data. It is now opt-out: the databases page's "every row" checkbox sends `maxRows: null`, and `backlog graph query --all` does the same. `null` is the only way to say it - `undefined` has to keep meaning "apply the default", or every unqualified call would silently start returning whole tables. The store translates null to Infinity at the one place a row count is applied, so the dump path (which already passed Infinity) and the interactive path share the rule instead of each restating it. Verified end to end over a 600-node database: the default request reports 500 rows capped, `--all` reports 600.

The graph pane guards its own end of that bargain: past 3000 nodes the force layout - 250 synchronous ticks over the whole set - stops being an interaction, so the pane declines to draw and says why, leaving the table to show every row.

### #8 The 1600th node was ours

Review noticed the count disagreeing: a corpus that holds 1599 business nodes answered `MATCH (n) RETURN n` with 1600 rows. The extra one is `Meta` - a real node table the store writes for its own bookkeeping (the corpus fingerprint), which a bare `MATCH (n)` is entitled to return and which nothing had been labelling as ours. Measured on the project's own corpus: FileNode 1418 + Tag 181 = 1599, plus Meta 1 = 1600.

So `INTERNAL_LABELS` now tags it at extraction, and the result graph starts those labels hidden - but only while the result carries something else, because a query that asked for the internal table (`MATCH (m:Meta)`) must not open onto an empty pane. The header says how many it is holding back, and the legend keeps the entry, so hiding never becomes losing. The table is untouched: it shows every row, since this was always a matter of what to draw, not what to return.

### #9 View ALL, next to the examples

The canned sweep belongs with the other one-click statements rather than in a per-row action column: it runs against whichever database the Cypher box is scoped to, and a menu on every row would suggest it is per-row. One click fills the box and runs, because a reader who wants everything should not have to click twice.

The statement is `MATCH (n) OPTIONAL MATCH (n)-[r]-() RETURN n,r`. `OPTIONAL MATCH` is load-bearing: dropping it would silently discard every node that has no relationship, which in a database imported from bare node CSVs is nearly all of them.

Filling the box and then clicking Run from the menu does not work - `setStatement` only lands on the next render, so a run queued behind it would execute the previous text. `run` therefore takes an explicit `{ db, statement }` pair and the menu passes the statement twice over: once for the box the reader sees, once for the query that actually goes out. The existing Run button now calls `run()` with no argument, which would otherwise receive a click event as its first parameter.

### Pre-existing bug found, not fixed here

`graph insert "<cypher>"` on a user database reports success but dumps an EMPTY snapshot: the CREATE lands nowhere `show_tables()` can see at dump time (reproduced on the clean tree, `countNodes=0` at the dump). CSV import is unaffected. Worth its own task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The databases page now reads a Cypher result two ways at once. A 表格 / 图谱 / 并列 switch above the result area picks between the table, the graph, and both side by side; the choice survives re-running a statement, and each run gets its own camera token, so a fresh result fits itself while returning to an earlier one comes back to where it was left.

Getting there meant fixing the transport first. A Cypher result reaches the browser by one of two paths - embind's structured values, or, whenever any returned column is INT64, RyuGraph's CLI-style text. Neither carried enough to rebuild a graph: the structured path handed the internal handles over as `{offset, table}` BigInt structs, and the text path left a relationship as the bare string `(0:0)-{_LABEL: KNOWS, _ID: 2:0}->(0:1)`. Both now normalise to the same `table:offset` identity, so a relationship's `_src`/`_dst` join to the nodes of the very same result set whichever path it took. An INT64 database - the project's own `demo` is one - used to lose the graph completely on the text path. The same pass stops BigInt reaching `Response.json`, which used to throw on a `count()` result. Tables in both the terminal and the Web UI filter the internal keys back out, so nothing a reader sees changed.

`graphFromCypherResult` turns the rows into nodes and edges as a pure function, handling every shape a user's query can return: bare nodes, `RETURN a, r, b`, paths, and lists of any of these. An edge whose endpoints the result does not carry is counted and skipped rather than drawn to a nameless dot, and a result with no node at all gets an empty state instead of a broken canvas.

The interactions are the knowledge graph's, not an imitation of them, because they are the same code. GraphView's canvas machinery was lifted into `GraphCanvas.tsx` - force layout with its precomputed tick budget and persisted positions, d3-zoom with the snapshot-blit drag, quadtree hit-testing, delayed hover with neighbour dimming, click-to-focus with the camera fly-in, node drags with a simulation reheat, staged text reveal, batched painting, and the keyboard and control-cluster chrome - and both views now render through it. GraphView's Cypher filter camera rules survived the move as a token map instead of the `preFilterTransform`/`fitForFilter` ref pair, and its smoke tests still pass unchanged. What the result graph leaves out is the Cypher search box, which would only duplicate the one already on the page, and double-click opens nothing, since a query row has no detail page to go to.

Then review noticed the count disagreeing: a corpus of 1599 business nodes answered `MATCH (n) RETURN n` with 1600 rows. The extra one is ours - a `Meta` node table the store writes for its own bookkeeping (the corpus fingerprint), which a bare `MATCH (n)` is entitled to return and which nothing had been labelling as internal. Internal labels now start hidden in the result graph, but only while the result carries something else, because a query that asked for them must not open onto an empty pane; the header says how many it is holding back and the legend keeps the entry, so hiding never becomes losing. The table is left alone - it shows every row, since this was always about what to draw, not what to return.

Review then asked for a way to see everything at once. "View ALL" now sits with the one-click schema examples rather than in a per-row action column - the statement runs against whichever database the box is scoped to, so a menu on every row would misrepresent it. One click fills the box and runs it, since a reader who wants everything should not have to click twice; this needed `run` to take an explicit database/statement pair, because setting the state and clicking in the same beat would have executed the previous text.

Review asked for three more things. The graph title now carries a fullscreen toggle using the memo board's icon, and it follows `document.fullscreenElement` rather than its own clicks, since Esc and the browser chrome can end fullscreen behind our back. The legend had a real bug: it was built from the visible nodes, so switching a label off deleted the entry needed to switch it back on - the reader could hide a category and never recover it. It is built from the whole result now, dimmed and struck through when off, which is what the task graph was already doing. And the 500-row cap, which is a rendering budget rather than a limit on the data, is now opt-out: a checkbox on the Cypher box and `graph query --all` both send a null cap, translated to Infinity at the one place rows are counted so the dump path and the interactive path cannot drift apart. Verified over a deliberately oversized database - 500 capped versus 600 returned - and the graph pane bows out with an explanation past 3000 nodes instead of freezing on 250 synchronous layout ticks.

One thing worth a task of its own: `graph insert "<cypher>"` reports success and then dumps an empty snapshot, so Cypher writes never land. It reproduces on the clean tree; CSV import is unaffected.
<!-- SECTION:FINAL_SUMMARY:END -->

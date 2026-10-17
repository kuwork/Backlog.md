---
id: BACK-810
title: 'Server: watch graph-legends.yaml and broadcast legend updates'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-17 13:26'
updated_date: '2026-10-17 15:10'
labels:
  - web-ui
  - docs
dependencies:
  - BACK-806
modified_files:
  - src/graph/legend-store.ts
  - src/server/index.ts
  - src/utils/graph-legend-watcher.ts
  - src/web/components/CypherResultGraph.tsx
  - src/web/utils/graph-legend-config.ts
  - src/test/graph-legend-watcher.test.ts
  - src/test/server-graph-legend-endpoint.test.ts
  - src/test/web-graph-legend-persistence.test.tsx
  - src/guidelines/cli-instructions/graph.md
  - src/guidelines/mcp/graph.md
ordinal: 372001
actual_start: '2026-10-17 13:25'
actual_end: '2026-10-17 13:41'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
backlog/databases/graph-legends.yaml is written by several paths - the server's own PUT /api/graph/legend route (a null config removes the entry), the CLI (BACK-808), the MCP tools (BACK-809) - and it can be hand-edited in an editor. Only the server's API route broadcasts graph-legend-updated, so an out-of-band write leaves every open Web UI legend panel stale until a manual reload. backlog/databases/ is the one content directory with no watcher (tasks, memos, milestones and the config file all have one). Add a watcher that turns a local file change into the same per-database broadcast the API route sends, mirroring startMemoWatcher/startMilestoneWatcher.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An out-of-band write to graph-legends.yaml (CLI set, MCP set, or an editor) makes the server broadcast graph-legend-updated naming the changed database, so an open Web UI legend panel re-fetches and applies it without a reload
- [x] #2 The watcher does not echo the server's own API write - a PUT /api/graph/legend produces exactly one legend broadcast (the API's), not a second one from the watcher
- [x] #3 A removal broadcasts like a write (the entry disappearing is a change), and a rewrite with identical content produces no broadcast
- [x] #4 Rapid successive writes coalesce into one broadcast per settled state, and a file caught mid-write (in-place editor save) is re-read until stable instead of broadcasting a half-parsed state
- [x] #5 A project without backlog/databases/ starts the server without error (the watcher waits for the directory, the same tolerance the memo and milestone watchers have), and stopping the server closes the watcher
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. New util src/utils/graph-legend-watcher.ts mirroring milestone-watcher.ts: watch the user databases directory (not the file - the store writes via temp+rename so the file's inode changes while the directory sees the rename), settle plus double-read stability, per-database signature diff against a baseline, and suppression of a state the API route already published. Watch the parent directory until the databases directory appears, because a fresh project has neither.
2. Wire it into src/server/index.ts next to startMemoWatcher/startMilestoneWatcher: broadcast encodeGraphLegendUpdatedMessage(db) per changed database via sendToSockets, stop it in stop(), and refresh the watcher baseline after a successful PUT so the API write is not echoed.
3. Tests: new src/test/graph-legend-watcher.test.ts for the util (external write broadcasts the changed database only, identical rewrite is silent, removal broadcasts, rapid writes coalesce, unstable reads are retried, missing directory waits, baseline refresh suppresses the API echo) plus a server-level test in src/test/server-graph-legend-endpoint.test.ts asserting an out-of-band file write produces a graph-legend-updated frame on the WebSocket channel.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
What was done
- New util src/utils/graph-legend-watcher.ts (watchGraphLegendStore) mirroring milestone-watcher/config-watcher: it watches the user databases DIRECTORY - the store writes via temp+rename, so the file's inode changes while the directory sees the rename - settles 50ms and double-reads for stability, and diffs per-database configs against a baseline.
- The baseline diff is a deep, key-order-insensitive comparison (isDeepStrictEqual), so a rewrite that only reorders keys - an editor tidying the file, a normalizing writer - is not a change and reports nothing. An unchanged legend must not refresh anyone.
- A fresh project has no backlog/databases/ at all, so the watcher starts on the parent directory and moves across when the store's directory appears; the first write in such a project is covered instead of being missed until a restart.
- src/graph/legend-store.ts: saveLegendConfig now returns { map, changed } - changed reports whether the touched database's legend is semantically different (deep, order-insensitive) - and the tolerant parse is exported as parseLegendStoreText for the watcher's stable read.
- src/server/index.ts: startGraphLegendWatcher() wired next to the config watcher in start() - deliberately NOT in the lazily-initialized services, because the first client connection is what triggers that init and an edit landing in between would otherwise be missed.
- The PUT route broadcasts only when the write changed the legend (changed), and adopts the returned map as the watcher baseline (notePublishedStore) synchronously inside the request - before the filesystem event for that write can be delivered. A web-side save therefore produces exactly one refresh when something changed and none when it did not; removing an absent entry is a silent no-op.
- src/web/components/CypherResultGraph.tsx: a legend broadcast still re-fetches (the broadcast is a hint, not the payload) but the fetched config is compared with legendConfigsEqual - a new deep, order-insensitive helper in src/web/utils/graph-legend-config.ts - before adoption, so an identical config does not repaint the graph.
Tests added
- New src/test/graph-legend-watcher.test.ts (9 tests): out-of-band write broadcasts the changed database once; only the changed database, not its neighbours; a removal broadcasts like a write; an identical rewrite is silent; a key-reordering rewrite is silent; rapid writes coalesce into one broadcast; a project without backlog/databases/ still gets the first write's broadcast; notePublishedStore suppresses the API-route echo while later edits still report; stop() silences later writes.
- src/test/server-graph-legend-endpoint.test.ts +4: an out-of-band file write produces a graph-legend-updated frame on the WebSocket channel; the API route's own PUT produces exactly one legend frame (no watcher echo); re-saving an unchanged legend produces no second frame; removing an absent entry produces none at all.
- src/test/web-graph-legend-persistence.test.tsx +1: a broadcast whose fetch returns the config already on screen re-fetches but adopts nothing (localStorage write count unchanged). The suite interposes a Proxy over jsdom localStorage for the count - instance method shadowing is silently ignored there.
Verification run
- bunx tsc --noEmit: 0 errors. Biome check on touched files: clean.
- Legend regression sweep across graph-legend-watcher, server-graph-legend-endpoint, cli-graph-legend, mcp-graph-legend, web-graph-legend-persistence, api-graph-legend, graph-legend-config: 91 pass / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a filesystem watcher for backlog/databases/graph-legends.yaml so out-of-band writes - a CLI set (BACK-808), an MCP set (BACK-809), or a hand edit - hot-reload open Web UI legend panels instead of waiting for a manual reload (AC #1). The new util src/utils/graph-legend-watcher.ts watches the store's directory (its temp+rename write replaces the file's inode), settles and double-reads like the milestone and config watchers, and diffs per-database configs with a deep, key-order-insensitive comparison - a rewrite that only reorders keys is not a change; a fresh project without backlog/databases/ is covered by a parent-directory watch that moves across when the directory appears (AC #5). The server starts it alongside the config watcher in start() rather than in the lazily-initialized services, so no edit can slip through before the first client connects. An unchanged legend refreshes nobody at any of the three layers: the PUT route broadcasts only when saveLegendConfig reports the legend actually changed (re-saving the same config or removing an absent entry is a silent 204); the watcher's baseline diff treats an identical or key-reordered rewrite as no change; and the browser compares the fetched config with the one on screen (legendConfigsEqual) before adopting it (AC #2/#3/#4). Removals broadcast like writes, rapid successive writes coalesce into one broadcast per settled state, and a web-side edit produces exactly one refresh - the watcher's baseline is adopted synchronously inside the request, before the file event for that write can be delivered. Covered by 9 util tests, 6 server-level WebSocket tests and 1 browser test; the legend regression sweep is 91 pass / 0 fail, with tsc --noEmit and biome clean.
<!-- SECTION:FINAL_SUMMARY:END -->

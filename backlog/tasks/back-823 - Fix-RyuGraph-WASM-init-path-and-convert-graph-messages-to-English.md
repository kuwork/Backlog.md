---
id: BACK-823
title: Fix RyuGraph WASM init path and convert graph messages to English
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-28 02:57'
updated_date: '2026-10-28 06:43'
labels:
  - graph
dependencies: []
modified_files:
  - src/cli.ts
  - src/graph/store.ts
  - src/graph/paths.ts
  - src/graph/databases.ts
  - src/graph/snapshot.ts
  - src/graph/csv-import.ts
  - src/graph/browser.ts
  - src/mcp/tools/graph/graph-access.ts
  - src/mcp/tools/graph/handlers.ts
  - src/server/index.ts
  - src/test/graph-snapshot.test.ts
  - src/test/graph-csv-import.test.ts
  - src/test/graph-foundation.test.ts
  - src/test/cli-graph-legend.test.ts
  - src/test/mcp-graph.test.ts
  - src/test/server-cypher-query-endpoint.test.ts
priority: high
ordinal: 385001
actual_start: '2026-10-28 03:49'
actual_end: '2026-10-28 04:33'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog browser` starts but logs `[graph] RyuGraph (WASM) backend initialization failed, falling back to memory degraded mode (Cypher retrieval unavailable)`, and the graph cache dir contains only `backlog-graph-<hash>.kuzu.lock` and `.meta.json` - never a `.kuzu`. Cypher search (Web UI magnifier, `backlog graph query`, the graph MCP query tool) is therefore dead, and the memory backend is per-process, so the cold-start fast path never engages and the meta fingerprint cache is useless. Root cause: `RyuGraphStore.init()` calls `new ryu.Database(this.dbPath)` with the host absolute path (e.g. `/Users/<user>/Library/Caches/backlog.md/graph/backlog-graph-<hash>.kuzu`), but `ryugraph-wasm/sync` is a browser build whose Emscripten filesystem is MEMFS - only a few default dirs such as `/tmp`, `/home`, `/dev`, `/proc` exist - so creating the database path returns ENOENT and `openGraphStore` degrades to memory. The fix is to hand ryu a MEMFS-visible handle path (`/tmp/ryu-<hash>.kuzu`) while keeping the existing per-platform host cache path for the durable `.lock` and `.meta.json` sidecars. This must hold across all six published targets: darwin-arm64, darwin-x64, linux-arm64, linux-x64, windows-arm64, windows-x64.

The warning itself is hard-coded Chinese (`src/graph/store.ts:1041`). There is no i18n layer for CLI, MCP, or server output - `src/web/locales/` (en, ja, zh-CN, zh-TW) is consumed by the Web UI only - and 358 of the 367 `console.warn`/`console.error` calls in `src/` are English, so the message is rewritten in English. The same inconsistency runs through the whole graph surface, which is converted in this task too: the `graph` and `graph legend` CLI commands, the graph library (`store`, `csv-import`, `databases`, `snapshot`), the graph MCP tools, and the query/graph REST endpoints answer in Chinese across roughly 147 lines, while `src/web/components/GraphDatabases.tsx:110,136` renders the server's raw `error.message` inside a localised UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 RyuGraphStore.init() hands ryu a MEMFS-visible handle path (`/tmp/ryu-<hash>.kuzu`, where <hash> is a digest of the full host dbPath) instead of the host absolute path, so new ryu.Database(...) succeeds and store.backend stays ryu.
- [x] #2 The MEMFS path is built as a literal `"/tmp/ryu-" + <hex digest> + ".kuzu"`, never with path.join/resolve and never from the raw host basename (the basename differs by separator on Windows and is not unique across projects); a hex digest keeps it POSIX-safe on every platform.
- [x] #3 The host cache paths stay exactly as they are today, leaf dir `graph` included: win32 -> %LOCALAPPDATA%/backlog.md/graph, darwin -> ~/Library/Caches/backlog.md/graph, linux -> $XDG_CACHE_HOME or ~/.cache/backlog.md/graph; the .lock and .kuzu.meta.json sidecars still live there and no durable artifact is written into MEMFS.
- [x] #4 Uniqueness is preserved by hashing the full host dbPath: distinct projects, slots (port / tui), and user databases map to distinct MEMFS paths, so they never share one in-memory database.
- [x] #5 Comments in src/graph/paths.ts (and src/graph/databases.ts if applicable) that claim Kuzu creates a directory or a .kuzu lands on disk are corrected to state that the host path is only a handle name.
- [x] #6 The fallback diagnostic at src/graph/store.ts:1041 is emitted in English, keeps the offending path and the underlying error text, and distinguishes a path-unreachable failure (Cannot open file / ENOENT / IO exception) from an engine fault.
- [x] #7 Every user-facing message on the graph CLI surface is English: the `graph` and `graph legend` commands in src/cli.ts (console output, thrown errors, multi-line concatenations, and the `--help` option/argument descriptions).
- [x] #8 The graph library and MCP tools answer in English: src/graph/store.ts, src/graph/csv-import.ts, src/graph/databases.ts, src/graph/snapshot.ts, src/mcp/tools/graph/graph-access.ts, src/mcp/tools/graph/handlers.ts.
- [x] #9 src/server/index.ts returns English `{ error }` bodies for the graph and live-query endpoints (/api/graph/cypher, /api/graph/db-cypher, /api/graph/legend, /api/sqlite/query, /api/duckdb/query, /api/sqlite/export-csv), since the Web UI renders them verbatim inside a localised frame.
- [x] #10 Deliberate localisation is untouched: the locale-driven default status wording in src/core/state-machine.ts stays as is, and Chinese comments, test fixtures, and user data (legend names, task titles) are never translated.
- [x] #11 Test assertions that pin the old Chinese wording are updated (at least src/test/cli-graph-legend.test.ts, src/test/mcp-graph.test.ts, src/test/server-cypher-query-endpoint.test.ts) and the graph suites pass.
- [x] #12 bun test src/test/graph-snapshot.test.ts passes with backend === ryu everywhere (no memory fallback), and a normal cold start no longer prints the fallback warning.
- [x] #13 All six targets are covered: the MEMFS /tmp is virtual and identical, so the same literal works on darwin-arm64/x64, linux-arm64/x64, and windows-arm64/x64; the Windows handle path uses forward slashes for the WASM side.
- [x] #14 bunx tsc --noEmit, bun run check ., and the affected tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/graph/store.ts: add memfsDatabasePath(dbPath) = "/tmp/ryu-" + sha256(dbPath) hex slice + ".kuzu" (node:crypto). A full-path hash, not basename: unique per project + slot + database and POSIX-safe on Windows; never path.join/resolve.
2. RyuGraphStore.init(): construct new ryu.Database(memfsDatabasePath(this.dbPath)); keep this.dbPath (host path) for the lock/sidecar consumers and deterministic reopening. wipe/clear/createSchema/readSchemaVersion are connection-based, so they need no change.
3. Defensive /tmp: after loadRyu(), use ryu.getFS?.() to ensure the MEMFS /tmp exists (FS.analyzePath / mkdirTree) before constructing the Database. createDefaultDirectories already mkdirs /tmp, so this is a guard, never a host /tmp dependency.
4. Correct comments: src/graph/paths.ts header (drop "Kuzu creates a directory" and the .kuzu-lands-on-disk wording; state the host path is a handle name only) and the src/graph/databases.ts DatabaseSource.dbPath comment. The cache paths themselves are unchanged.
5. Tests: graph-snapshot keeps backend === "ryu"; add a regression that opens openGraphStore(<os.tmpdir()-based host path>, { backend: "ryu", schema: "none" }) and asserts backend === ryu, that no host file/dir appears at that path, and that a normal GraphService cold start still writes the host .lock/.meta.json. graph-foundation cache-dir test still passes (unchanged).
6. src/graph/store.ts:1041: rewrite the hard-coded Chinese warning in English. Keep it one line, name the host path and the raw error, and derive a reason label - path not visible to the WASM filesystem when the error matches Cannot open file / ENOENT / IOException, otherwise an engine fault - so a real regression is not mistaken for environmental noise.
7. src/cli.ts, graph section (~6861-7566): translate every user-facing Chinese string to English - `graph` and `graph legend` console output, thrown errors, multi-line concatenations, and the `.option()` / `.argument()` / command help descriptions. Keep message shape and exit codes identical; translate wording, not behaviour.
8. src/graph/{store,csv-import,databases,snapshot}.ts: same treatment for thrown errors and warnings (csv-import has the most, ~23 lines; snapshot has the two "snapshot is corrupt" messages).
9. src/mcp/tools/graph/{graph-access,handlers}.ts: same treatment for tool error/result text, so MCP clients get English.
10. src/server/index.ts: translate the `{ error }` bodies of /api/graph/cypher, /api/graph/db-cypher, /api/graph/legend, /api/sqlite/query, /api/duckdb/query and /api/sqlite/export-csv. The Web UI prints `error.message` verbatim (GraphDatabases.tsx:110,136) inside a localised frame.
11. Update the tests that pin the old wording: src/test/cli-graph-legend.test.ts, src/test/mcp-graph.test.ts, src/test/server-cypher-query-endpoint.test.ts (and any other graph suite the run surfaces). Leave fixtures and user data (legend names such as "认识", task titles) untouched.
12. Validate: bunx tsc --noEmit; biome check on changed files; bun test src/test/graph-snapshot.test.ts src/test/graph-foundation.test.ts plus the graph, mcp-graph, cli-graph-legend, server-cypher-query-endpoint and server-statuses suites. Grep the touched files for any remaining CJK in user-facing strings. Reason through all six targets: the MEMFS /tmp and the hex name are host-agnostic, so darwin/linux/windows x64+arm64 resolve identically.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The failure is platform-independent: the host path is unreachable for MEMFS on macOS, Windows, and Linux alike, so this affects all six npm targets (darwin-arm64/x64, linux-arm64/x64, windows-arm64/x64), even though it was reported on macOS 25.6.0/arm64 with Bun 1.3.14. Do NOT switch to ryugraph-wasm/nodejs/sync: that real-NODEFS build crashes under Bun with Aborted(Module.thisProgram has been replaced by thisProgram) (report section 5). The report section 4.4 already proved the point: replacing the Database path with /tmp/x.kuzu took graph-snapshot from 11 fail/2 pass to 13 pass/0 fail, so the path alone is the cause. The host .kuzu never existed, so there is no data to migrate - only a misleading comment and warning to clean up.

No cache-path change: graphCacheDir() stays exactly as it is today on all platforms (win32/darwin/linux branches, leaf dir `graph`, BACKLOG_GRAPH_CACHE_DIR override verbatim). An earlier request to rename the leaf to `.graph` was withdrawn once the user confirmed the directory was never named `kuzu` - the existing `graph` leaf is already correct, so this task only stops the WASM handle from being the host path.

MEMFS handle naming: a sha256 digest of the full host dbPath is used instead of the basename because a basename is not unique across projects (two user databases could both be articles.kuzu) and its separator differs on Windows; a hex digest is unique and POSIX-safe on every target. ryugraph-wasm/sync exposes getFS() (Module["FS"] = FS around line 8353) so /tmp can be ensured defensively, though createDefaultDirectories() already mkdirs /tmp/home/home/web_user.

Console language: there is no i18n layer for CLI/MCP/server output - src/web/locales/ (en, ja, zh-CN, zh-TW) is consumed by the Web UI only - and 358 of the 367 console.warn/console.error calls under src/ are English, so the graph surface's Chinese is an outlier rather than a convention. Measured user-facing CJK (comments excluded): src/cli.ts 78 lines (the graph command block, 6861-7566), src/graph/csv-import.ts 23, src/server/index.ts 19-22, src/mcp/tools/graph/graph-access.ts 9, src/graph/store.ts 8, src/graph/databases.ts 7, src/mcp/tools/graph/handlers.ts 3, src/graph/snapshot.ts 2. Roughly 147 lines across 8 files. Scope decision (user, 2026-10-28): fold the whole conversion into BACK-823 rather than a separate task, so the commit covers both the WASM path fix and the graph message language.

Excluded on purpose: src/core/state-machine.ts keeps its locale-driven default status wording (deliberate, `defaultStateMachineForLocale`); comments are never translated; src/sqlite/block.ts ("未知字段") and src/web/charts/from-query.ts ("未找到查询 id") are outside the graph surface and stay as they are. Test assertions that pin the old Chinese wording must be updated in the same change - at least cli-graph-legend, mcp-graph and server-cypher-query-endpoint.
Implementation (2026-10-28):
- src/graph/store.ts: added memfsDatabasePath() -> `/tmp/ryu-<sha256(host dbPath)[0:32]>.kuzu` and ensureMemfsTmp() (ryu.getFS() analyzePath/mkdirTree guard). RyuGraphStore.init() now opens that MEMFS handle while this.dbPath stays the host path for the lock and the sidecar. The degraded notice became `[graph] RyuGraph (WASM) backend init failed for <dbPath>, falling back to memory (Cypher unavailable) - <reason>: <message>`, with reason = "database path not visible to the WASM filesystem" when the error matches Cannot open file / ENOENT / IOException, else "engine error".
- src/graph/paths.ts: header rewritten - dbPath is a handle name and no .kuzu is ever written to the host; graphCacheDir() untouched (leaf still `graph`).
- English conversion: src/cli.ts graph + graph legend block (78 lines: console output, multi-line errors, --help option/argument descriptions and the legend text renderer), src/graph/{store,csv-import,databases,snapshot,browser}.ts, src/mcp/tools/graph/{graph-access,handlers}.ts, and the { error } bodies in src/server/index.ts for /api/graph/cypher, /api/graph/db-cypher, /api/graph/legend, /api/sqlite/query, /api/duckdb/query, /api/sqlite/export-csv. Message shape, exit codes, option names and placeholders are unchanged; CJK separators (｜ / 、) became " | " / ", ".
- Tests updated where they pinned the old wording: cli-graph-legend, mcp-graph, server-cypher-query-endpoint, graph-snapshot, graph-csv-import, graph-foundation. Added a graph-snapshot regression: a host-style path opens with backend ryu, no host .kuzu/.meta.json appears beside it, and two different host paths do not collapse into one MEMFS database (a shared handle would let the second store's wipe destroy the first one's table).
- Verified: graph suites + cypher-graph + cli-graph-legend + mcp-graph(+legend) + api/server graph-legend + server-cypher-query-endpoint = 286 pass / 0 fail; graph-snapshot now 14/14 (it was 11 fail / 2 pass before the path fix); bunx tsc --noEmit clean; biome check clean on the touched files (only the pre-existing `any` warnings in store.ts).
- Untouched by design: src/core/state-machine.ts locale defaults, src/sqlite/block.ts, src/web/charts/from-query.ts, all Chinese comments, and versioned docs.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kimi
created: 2026-10-28 03:28
---
Console output has no i18n (src/web/locales/ is Web-UI only; 358/367 console calls in src/ are English), so the hard-coded Chinese fallback warning in store.ts:1041 is converted to English as part of this task (AC #6). The other 8 Chinese console lines in src/cli.ts (7016, 7025, 7058, 7321, 7527, 7532, 7541, 7546) are out of scope.
---

author: @kimi
created: 2026-10-28 03:34
---
Superseded: scope widened. Measuring the graph surface found ~147 user-facing CJK lines across 8 files (cli.ts graph block 78, csv-import 23, server/index.ts 19-22, mcp graph-access 9, store 8, databases 7, mcp handlers 3, snapshot 2), and the Web UI prints server `error.message` verbatim (GraphDatabases.tsx:110,136). Per the user's call the whole conversion is folded into BACK-823 instead of a separate task, so title, Description, AC #7-#11 and plan steps 7-11 now cover it. state-machine.ts locale defaults, comments, sqlite/block.ts and web/charts/from-query.ts stay untouched.
---

author: @kimi
created: 2026-10-28 04:36
---
Implementation done and ready for review: MEMFS handle fix + full graph-surface English conversion. 286 graph/CLI/MCP/server assertions green, tsc + biome clean.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
RyuGraph WASM now opens its database through a MEMFS handle, so the backend no longer degrades to memory on macOS or any other host, and the whole graph surface answers in English.

Changes:
- store.ts: memfsDatabasePath() maps the host cache path to `/tmp/ryu-<sha256(path)[0:32]>.kuzu`; RyuGraphStore.init() opens that handle while the host path still backs the lock and the fingerprint sidecar. ensureMemfsTmp() guards /tmp via ryu.getFS(). The fallback notice is now English and names the failing path plus a reason label (WASM-invisible path vs engine fault). The remaining Chinese Cypher error strings became English.
- paths.ts: the header no longer claims Kuzu creates a directory on disk - the host path is a handle name only. graphCacheDir() is untouched (leaf dir stays `graph`).
- English conversion of the graph surface: the `graph` / `graph legend` CLI commands (console output, multi-line errors, --help option and argument descriptions, legend text renderer), graph library errors (csv-import, databases, snapshot, browser), the graph MCP tools, and the `{ error }` bodies of /api/graph/cypher, /api/graph/db-cypher, /api/graph/legend, /api/sqlite/query, /api/duckdb/query, /api/sqlite/export-csv, which the Web UI renders verbatim.
- Tests updated where they pinned the old wording, plus a new graph-snapshot regression: a host-style path opens with backend ryu, no .kuzu or .meta.json appears on the host, and two host paths do not collapse into one MEMFS database.

Verification:
- graph suites + cypher-graph + cli-graph-legend + mcp-graph(+legend) + api/server graph-legend + server-cypher-query-endpoint: 286 pass, 0 fail
- graph-snapshot: 14 pass (11 failed / 2 passed before the path fix)
- bunx tsc --noEmit: clean; biome check on touched files: clean (only pre-existing `any` warnings in store.ts)
- Known pre-existing, unrelated red: mcp-server.test.ts:326 expects an MCP tool list without memo_create/update/delete, which the server registers in src/mcp/tools/memos/index.ts (untouched here).
<!-- SECTION:FINAL_SUMMARY:END -->

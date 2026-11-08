---
id: BACK-843
title: 'Speed up browser startup, cache the UI bundle and add --no-cache'
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-08 10:50'
updated_date: '2026-11-08 14:27'
labels: []
dependencies: []
references:
  - src/cli.ts
  - src/utils/cache-policy.ts
  - src/utils/log.ts
  - src/utils/cache-dir.ts
  - src/core/task-loader.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/core/task-identity-index.ts
  - src/file-system/operations.ts
  - src/file-system/content-cache.ts
  - src/server/index.ts
  - src/server/web-bundle.ts
  - scripts/build-web.ts
  - src/graph/paths.ts
modified_files:
  - src/cli.ts
  - src/utils/cache-policy.ts
  - src/utils/log.ts
  - src/utils/cache-dir.ts
  - src/core/task-loader.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/core/task-identity-index.ts
  - src/file-system/operations.ts
  - src/file-system/content-cache.ts
  - src/server/index.ts
  - src/server/web-bundle.ts
  - src/graph/paths.ts
  - scripts/build-web.ts
  - src/test/cache-policy.test.ts
  - src/test/cache-dir.test.ts
  - src/test/filesystem-task-cache.test.ts
  - src/test/shared-branch-task-loader.test.ts
  - src/test/web-bundle.test.ts
  - src/test/content-cache.test.ts
  - package.json
  - README.md
  - CLI-INSTRUCTIONS.md
priority: medium
ordinal: 402004
actual_start: '2026-11-08 08:50'
actual_end: '2026-11-08 14:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The browser UI sat on a blank page for 85-175s before rendering, and the boot was silent while it waited. Measured, the time was four separate costs plus a fifth nobody had attributed: a blocking git fetch of remote refs (~70s), an uncached cross-branch scan (~10.7s of git tree/history/blob reads per ref), a local read+parse of every task file even when nothing changed (~2.7s), an eager graph-service cold start (~100s of WASM build) launched at bind time, and finally Bun's own lazy build of the imported HTML entry - ~24MB of JS that it compiles on the server's thread for 2-3 minutes on the first request, starving every pending continuation. The last one is why a warm-cache boot still took 175s with a browser attached and 1.5s without one. Progress lines only went to the browser over WebSocket, so the terminal showed nothing until a page connected, which made all of it look like a hang. This task covers the whole arc: commit-keyed branch caches, the stat fast path, the deferred fetch, the lazy graph, timestamped startup logging, the identity-index path fix, an on-disk cache for the built UI bundle, signature caches for documents/decisions/wiki pages, and a --no-cache flag that forces the cold path on demand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog browser --no-cache ignores the branch-cache and task-cache disk entries: the log shows the cold path (building index/tasks/parsed-tasks) instead of restored.
- [x] #2 The rebuild writes the caches back, so the run after --no-cache is a normal warm start again.
- [x] #3 Without the flag, startup behaviour and logs are unchanged.
- [x] #4 backlog browser --help documents the flag.
- [x] #5 First paint no longer waits for the remote-ref fetch: the initial corpus load defers it and a background refresh catches remote refs up afterwards, logging when it completes.
- [x] #6 An unchanged branch (same tip commit) is served from the on-disk cache with zero git reads, and an unchanged task file is served without being read, while a changed tip or touched file is re-read.
- [x] #7 The graph service no longer cold-starts at bind time; it starts on the first /api/graph request, so boot stays responsive.
- [x] #8 Startup progress (loading phases, per-ref cache restored/built lines, the three merge steps, phase timings) is printed with timestamps immediately at startup, before any browser connects.
- [x] #9 A warm start serves the UI bundle from disk: the log shows a bundle cache hit, the shell and its assets come back in well under a second, and nothing is built.
- [x] #10 With no cached bundle, the server binds and answers the shell request immediately with a self-refreshing progress page; the build runs in a child process so the corpus load, the terminal logs and the API stay responsive, and the finished bundle is served without a restart.
- [x] #11 Documents, decisions and wiki pages are served from a signature cache: unchanged files are not read, edited files are re-parsed, deleted files are pruned, and the snapshot is only rewritten when a scan changed something.
- [x] #12 backlog browser --no-cache ignores the bundle cache and the content caches too, rebuilds them, and the following normal start is warm again.
- [x] #13 One-shot CLI commands keep their plain output: progress lines are only enabled by the browser command and the Web server.
- [x] #14 bun run web:build rebuilds the bundle for the current sources, and the README explains the cache, the flag and the rebuild command.
- [x] #15 The live-state socket still connects once the shell is served from the bundle cache: an upgrade request that arrives on a shell route is handed back to the request handler instead of being answered with HTML.
- [x] #16 Every cache lives under one platform-correct root - `%LOCALAPPDATA%` on Windows, `~/Library/Caches` on macOS, `$XDG_CACHE_HOME` or `~/.cache` on Linux - and an explicit `$XDG_CACHE_HOME` overrides all three.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **P1** Defer what can be deferred: Core.getContentStore({skipInitialRemoteRefresh}) sets a one-shot initialRemoteRefreshDeferred flag that the first corpus load consumes, skipping the awaited remote-ref fetch (ID allocation still forces it); BacklogServer then runs refreshTasksForTaskRead() in the background and logs when it finishes. The graph service stops cold-starting inside start() and starts on the first /api/graph request instead, so a ~100s WASM build cannot starve the first page load.
2. **P2** Cache branch data by commit: BranchTaskLoader persists a per-commit index plus one task bundle per commit under `<cache>/backlog.md/branch-cache/<sha256(repoRoot)>/`, keyed by commit (content-addressed) so a local and a remote ref at the same tip share a single read. One write per commit, batched pruning (512 index files / 128 bundles).
3. **P3** Stat fast path for the parse cache: ParsedTaskFile carries size/mtimeMs/ctimeMs, so an unchanged file returns its cached parse without being read at all; a touched but byte-identical file only refreshes the signature.
4. **P4** Make the identity index cheap: replace the per-record path.relative with a per-index normalizer (createRecordPathNormalizer + relativeToRoot prefix stripping), and add getStats() so the merge summary can report ids/identities/ambiguous without copying tasks.
5. **P5** Make the boot observable: src/utils/log.ts exposes logLine/logError with HH:MM:SS.mmm; mirror the WebSocket-only loading states to the console; log per-ref cache restored/built with the commit hash, the three merge steps, and the phase timings. ensureServicesReady() is kicked off right after bind so the lines appear immediately rather than when a browser connects.
6. **P6** Add the escape hatch: src/utils/cache-policy.ts exposes BACKLOG_NO_CACHE through isCacheDisabled()/setCacheDisabled(); --no-cache sets it before Core/BacklogServer construction. Both cache layers skip disk reads but keep writing, so the run rebuilds and replaces exactly what it ignored.
7. **P7** Measure what is left before touching it: with the corpus cached the boot still took 79-175s with a browser open and 1.5s headless. Time the startup both ways, time a single GET / after services are ready, and time a standalone Bun.build of src/web/index.html - that isolates the cost to the HTML-entry build Bun runs lazily inside the server process, not to the corpus.
8. **P8** Add src/server/web-bundle.ts: a cache slot per fingerprint under `<cache>/backlog.md/web-bundle/<fingerprint>`, fingerprint = bundle format version + the dependency maps of package.json + the lockfile content + a content hash of every file under src/web. WebBundle resolves bundle-relative URLs with containment checks; WebBundleProvider picks the cached build, otherwise keeps serving the newest previous build and starts a rebuild.
9. **P9** Add scripts/build-web.ts: the same build scripts/build.ts does for the compiled binary (browser target, minified, tailwind + jszip plugins), with no-argument output resolving to the cache slot the server would use, so bun run web:build refreshes exactly that. Wire it into BacklogServer: spawn the build as a child process so the event loop stays free, serve the shell and the bundle assets from the cache, and fall back to the embedded HTML bundle in a compiled binary.
10. **P10** Cache the content collections: src/file-system/content-cache.ts stores parsed documents/decisions/wiki pages keyed by relative path with size/mtime/ctime, reuses a value without reading the file, prunes vanished files, and only rewrites the snapshot when a scan changed something. listDocuments/listDecisions/listWikiPages use it.
11. **P11** Keep CLI output clean: make progress lines opt-in through enableProgressLogs() and let only the browser command and the server opt in, so backlog task/decision list print only their records again.
12. **P12** Fix what the rework breaks: route-level shell handlers swallow the WebSocket upgrade (the client opens its socket on the origin root, and "Upgrade" is just a GET), and five modules each resolved the cache root on their own, two of them landing on ~/.cache on macOS and a third ignoring $XDG_CACHE_HOME outside Linux. Hand upgrade requests back to the request handler, and move the root resolution into one platform-aware src/utils/cache-dir.ts.
13. **P13** Verify: tsc, biome, the scoped suites (branch loader, parse cache, content store, bundle, content cache, cache dir) plus the document/decision/wiki suites, and warm/cold boots measured against a live server with the new log lines.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Where the time went

Reported symptom: [startup] services ready in 118792ms and 85673ms on two consecutive runs, with the browser on a blank page the whole time and nothing printed until a page connected. Measured on this repo (528 active + 304 completed task files, 12 refs, 3481 task records across branches) the boot paid four separate costs: a blocking fetch of remote refs (~70s, on the very first page load), an uncached cross-branch scan (~10.7s of git tree + history + blob reads per ref, repeated on every start), a read+parse of every local task file (~2.7s even when nothing changed), and an eager graph-service cold start (~100s of RyuGraph WASM build) launched at bind time, which monopolized the event loop.

### P1 Get first paint off the network and the graph

The remote fetch only protects task ID allocation, not display. Core.getContentStore takes skipInitialRemoteRefresh, keeps it in a one-shot initialRemoteRefreshDeferred, and loadTasksWithStableBranchSnapshot skips the awaited refreshRemoteRefsForTaskRead when it sees skipRemoteRefresh; BacklogServer then calls refreshTasksForTaskRead() in the background and logs "background remote ref refresh complete" when it lands. The graph service moved from an eager start at bind time to a lazy start on the first /api/graph request - the WASM build was the reason a page could stay blank even after the corpus was ready.

### P2 Commit-keyed caches for branch data

A branch tip resolves to a commit and a commit is immutable, so the cache key is the commit and not the branch name: a local and a remote ref at the same tip share one git read, while each ref keeps its own label for logs and its own source for identity resolution. Index and parsed tasks persist under `<cache>/backlog.md/branch-cache/<sha256(repoRoot)>/{commit-index,tasks}`, one bundle per commit.

The first version wrote one JSON file per task and hung cold boot for ~4 minutes: ~1.7k awaited mkdir + write + rename calls on Windows, each followed by a readdir prune. One bundle per commit plus a single batched prune turned that back into a handful of writes.

Two races had to be fixed. The in-memory promise must be registered synchronously before any await - awaiting resolveRepoCacheRoot() first made two refs at one tip walk git twice, which the deduplicates same-SHA refs test caught. And the cache-hit path must register the read generation synchronously, or a warm hit could land in a stale epoch after a backlog-root change. Empty indexes are cached and logged too; otherwise a docs-only branch re-ran git listFilesInTree on every start.

### P3 Stat fast path for the parse cache

ParsedTaskFile gained size/mtimeMs/ctimeMs. readParsedTaskFile stats first and returns the cached parse without reading when the signature matches; only a mismatch reads the file and compares sha256, and a touched-but-identical file just refreshes the signature so the next load takes the stat path again. The stat has to be statSync: the read-slot limiter treats the first await as slot acquisition, and an async stat broke the caps task file reads test.

### P4 The identity index was a hidden 800ms

A CPU profile put path.relative at 21.6% of the boot (~78us per call on this Windows Bun), and normalizeRecordPath called it up to twice per record for 3481 records. createRecordPathNormalizer hoists everything that depends only on the context (project prefix, backlog directories) out of the loop, and relativeToRoot strips the root prefix with a case-insensitive compare, falling back to relative only for paths outside the root. The merge dropped from 816ms to 70ms.

### P5 Make the boot observable

src/utils/log.ts prints HH:MM:SS.mmm [tag] message so every line is attributable without matching it against a clock. New tags: [startup] phase timings (services ready, content loaded, watchers ready, fingerprint baseline, graph), [loading] a console mirror of states that used to go only to the WebSocket - this is why the terminal was silent during the blank page, [cache] restored/building/built per ref with branch name, local|remote and short hash, [merge] the three steps (collected -> identity index -> selected). ensureServicesReady() is kicked off in a setTimeout(0) right after bind so the lines start flowing immediately instead of when a browser connects.

### P6 The --no-cache escape hatch

One env-backed switch, BACKLOG_NO_CACHE, in src/utils/cache-policy.ts. Env-based rather than threaded through constructors so a cache layer added later cannot keep reading disk just because nobody plumbed the option to it. Both layers skip reads only: loadCommitIndex/loadTaskBundle fall through to the building path, loadPersistedTaskCache returns before readFile, and the index write, bundle flush and debounced parse persist still run - so the rebuild replaces exactly what it ignored and the next start is warm again. cli.ts sets the flag only when --no-cache is passed, so an explicitly exported BACKLOG_NO_CACHE is never cleared by a plain run.

### P7 Where the remaining 175s went

The log showed `[merge] 3/3 selected` at 20:18:41 and `content loaded` at 20:21:34. Since `content loaded` covers tasks, documents, decisions and wikis, that gap read as the wiki/document readers being slow. Measured directly, they are not: `listWikiPages` 713ms (722 files), `listDocuments` 153ms (34), `listDecisions` 23ms (2). The same boot with `--no-open` logged `content loaded in 1199ms`.

The remaining cost is Bun's own end of the bargain. `src/server/index.ts` serves the SPA through `import indexHtml from "../web/index.html"`, an HTML bundle, and `Bun.serve` builds that bundle lazily on the first request. Measured against a live server: the first `GET /` took 180s, the second 0.2s. The same build run standalone (`Bun.build` of the HTML entry, minified, browser target) takes 123-159s and emits 4 files: 24MB JS, 427KB CSS, a favicon and the HTML. That build runs on the server's thread, so during it every pending continuation - the wiki scan, the phase logs - is starved. Hence 1.5s headless versus 79-175s with a browser attached, and hence the terminal going silent right after the merge line.

### P8-P9 Cache the bundle instead of rebuilding it

`src/server/web-bundle.ts` owns a cache slot per fingerprint under `<cache>/backlog.md/web-bundle/<fingerprint>`. The fingerprint is the bundle format version, the dependency maps of `package.json` (only the dependency maps: editing a script or a description must not throw away a two-minute build), the lockfile content and a content hash of every file under `src/web`. Content, not timestamps: a checkout or a touch must not cost a rebuild. The Bun version is deliberately left out - `bun run` executes through `node_modules/bun` while `bun src/cli.ts` uses the global binary, and including it split the cache between two identical source trees.

Each slot holds ~24MB, so after a build the provider keeps the current slot plus the newest other one (the fallback served while a rebuild runs) and deletes the rest. A cache hit is served as static files: the shell with `no-store` so the shell-refresh script keeps working, assets as `immutable` since their names are content-hashed. Anything that is not a bundle file falls through to the existing project-asset handler, so `backlog/assets` keeps working. In a compiled binary the whole provider is null and the embedded HTML bundle is used as before, because that build already happened at package time.

A miss spawns `scripts/build-web.ts` as a child process and flushes its output as `[web]` log lines. That is the point of the child: the CPU-heavy build no longer occupies the event loop, so the server binds, answers requests, keeps logging and finishes loading the corpus while it runs. Until the build lands, the shell request is answered with a small self-refreshing page, and if a previous build exists it keeps being served - a stale UI beats a blank tab.

### P10 Signature cache for the content collections

`src/file-system/content-cache.ts` is the task-parse cache applied to documents, decisions and wiki pages: a map of relative path to `{size, mtimeMs, ctimeMs, value}` in one JSON file per collection under `<cache>/backlog.md/content-cache/`. A listing still enumerates its files (that is how additions and deletions are seen) but stats instead of reading: a matching signature returns the stored parse, and only a changed file is read and re-parsed. Vanished files are pruned, and the snapshot is rewritten only when the scan read or dropped something, so a warm boot does not write 2MB of JSON every time.

### P11 Progress lines must not leak into CLI output

Adding `[cache] content wikis files: ...` to `listWikiPages` broke `backlog decision list`: the plain-text assertions compare stdout exactly, and the timestamped line was on it. `backlog task list` had the same problem from the task cache. Both are symptoms of `logLine` writing to stdout unconditionally, so it is now opt-in through `enableProgressLogs()`: the `browser` command turns it on at the start of its action, the server turns it on in `start()`, and one-shot commands print only their payload.

### P12 Two regressions the rework introduced

**The socket died right after boot.** Serving the shell from the bundle cache replaced `"/": spaIndexHtml` with a route handler, and every SPA route (`/`, `/tasks`, `/wiki/*`, ...) is matched before the `websocket` handler can run. The client opens its socket on the origin root (`new WebSocket(protocol // host)`), and an upgrade request is a GET - so it hit the shell route and got HTML back instead of a 101, which the browser reports as a connection that drops immediately and retries forever. `serveAppShell` now checks for `Upgrade: websocket` first and hands the request back to `handleRequest`, which is what actually calls `server.upgrade()`. Verified against a live server: the socket opens and receives the initial `corpus-state` digest.

**The cache root was resolved five times, differently.** `task-loader`, `operations`, `content-cache`, `web-bundle` and `graph/paths` each had their own `LOCALAPPDATA ?? XDG_CACHE_HOME ?? ~/.cache`. On macOS that lands in `~/.cache`, not `~/Library/Caches`, so the same project could be cached under two roots depending on which layer wrote it - and macOS never gets `%LOCALAPPDATA%`, so two of the five were simply in the wrong place. The graph copy was a third answer still: a platform switch that honoured `$XDG_CACHE_HOME` only on Linux, so on macOS and Windows it overrode the user's explicit setting. `src/utils/cache-dir.ts` is now the only answer: an explicit `$XDG_CACHE_HOME` wins everywhere (a user who sets it expects all caches to follow), then `%LOCALAPPDATA%` on Windows (falling back to `~/AppData/Local`), `~/Library/Caches` on macOS, `~/.cache` on Linux. All five call `backlogCacheDir(...)`, so they cannot drift apart again.

### Results: the corpus caches

| scenario | services ready | evidence |
|---|---|---|
| --no-cache (cold) | 10873ms (10496ms on a second run) | building index/tasks/parsed-tasks lines, 0 files from cache |
| warm | 1864ms / 2005ms / 2314ms | 4 restored index lines + restored tasks + restored parsed-tasks |
| identity merge | 816ms -> 70-84ms | 3/3 merge line |
| parsed tasks | 528 active + 304 completed from cache, 0 read | parsed-tasks log line |

### Results: the bundle and the content caches

| scenario | before | after |
|---|---|---|
| boot with a browser, bundle uncached | 79-175s to first paint | shell in 0.07s, real UI once the background build lands (~160s), no restart |
| boot with a browser, bundle cached | 79-175s | `services ready in 1537ms`, shell 0.32s |
| content loaded | 1199-1465ms headless | 710-772ms |
| wiki pages (722 files) | 713ms, 722 reads | 442ms, 722 stat, 0 reads |
| documents (34 files) | 153ms | 65ms |
| boot with `--no-open` | 2319ms | 1537ms |

The first request after a fresh build returns the 4-file bundle in 0.01s, and a missing chunk still 404s through the project-asset handler.

### Verification

`bunx tsc --noEmit` clean; `bunx biome check` clean on every touched file. `bun test`: shared-branch-task-loader 29 pass, filesystem-task-cache 12 pass, cache-policy 2 pass, content-store 16 pass, web-bundle 7 pass, content-cache 6 pass, cache-dir 7 pass, cli-doc-decision-board 12 pass (previously failing on the leaked log line), documentation 10, mcp-decisions 10, mcp-documents 11, server-documents-endpoint 4, server-wiki-tree-endpoint 2, wiki-links 44, wiki-titles 7, wiki-install 12, tui-documentation 1. Both boot modes were measured against a live server, and after the routing change the socket (opens and receives `corpus-state`), `/api/config` (200 JSON, not swallowed by the `/*` wildcard) and `/tasks` (200 HTML) were re-checked. src/test/server-port.test.ts fails on this Windows box with "Failed to start server ... in use" (Bun.serve EADDRINUSE, then process.exit(1)); confirmed pre-existing by stashing the changes and re-running the same suite.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Browser startup on this repo went from a blank page for 85-175s to ~1.5s warm. Five costs were removed or deferred. The remote-ref fetch now runs after first paint (a one-shot skipInitialRemoteRefresh, with a background refreshTasksForTaskRead catching up); the cross-branch scan is cached per commit on disk (branch-cache, content-addressed so a local and a remote ref at one tip share a read, one bundle per commit with batched pruning); unchanged task files are served from a stat signature without being read; the graph service starts on the first /api/graph request instead of at bind time; and the UI bundle is built once into a cache slot keyed by a content fingerprint of the UI sources and their dependencies, then served as static files, with rebuilds running in a child process while the server keeps serving the previous bundle or a self-refreshing progress page. A compiled binary still uses its embedded bundle. The identity-index merge dropped from 816ms to 70ms once per-record path.relative was replaced by a per-index normalizer, and documents/decisions/wiki pages got the same signature cache the task files had (722 pages: 442ms instead of 713ms, zero file reads). Boot is now audible: every line carries HH:MM:SS.mmm, the loading states that only went to the WebSocket are mirrored to the console, per-ref cache lines name the branch, local vs remote and short hash, and the merge reports its three steps; progress output is opt-in so one-shot CLI commands keep their plain text. The arc closes with --no-cache, one env-backed switch every cache layer consults: it skips disk reads but keeps writing, so the run rebuilds exactly what it ignored (1.5s warm vs 10.5s cold for the corpus alone) and doubles as a repair path for a suspect cache. Two regressions from the bundle rework were fixed before it shipped: the shell routes intercepted the WebSocket upgrade, and five modules resolved the cache root independently - two of them landing on `~/.cache` on macOS, one ignoring `$XDG_CACHE_HOME` outside Linux - now one platform-aware helper honouring `$XDG_CACHE_HOME` first, then `%LOCALAPPDATA%`, `~/Library/Caches` and `~/.cache`. Verified with tsc and biome clean, 192 targeted tests passing, and both boot modes measured on this repo.
<!-- SECTION:FINAL_SUMMARY:END -->

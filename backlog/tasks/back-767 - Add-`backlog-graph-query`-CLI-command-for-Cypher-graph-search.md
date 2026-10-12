---
id: BACK-767
title: Add `backlog graph query` CLI command for Cypher graph search
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 10:10'
updated_date: '2026-10-12 13:08'
labels: []
dependencies: []
ordinal: 328001
actual_start: '2026-10-12 10:10'
actual_end: '2026-10-12 13:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the existing read-only Cypher capability (GraphStore.runCypher, added in BACK-765 and made default-on via RyuGraph WASM in BACK-766) through a new CLI subcommand `backlog graph query "<cypher>"`. The command resolves the project root, opens the ryu graph store, builds the in-process graph, runs the read-only Cypher statement, and prints the result as a table (default) or raw JSON (`--json`).

**Backend constraint (discovered during implementation):** the only Bun-compatible ryu build (`ryugraph-wasm/sync`) stores its graph in Emscripten's in-memory MEMFS, so the graph never survives a process exit and is never shared with the Web UI. A fresh CLI process therefore always opens an EMPTY store and must perform a full build before it can query. The `reconcileGraphStoreOnce` helper therefore takes a `forceBuild` flag: the CLI passes it so it always rebuilds and never trusts a stale on-disk fingerprint that would point at data the current process cannot see. Reuse/incremental across CLI invocations are NOT achievable with this backend (tracked separately — a native Kuzu or the ryu `nodejs` build would be required for cross-process persistence).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog graph query "<cypher>"` opens the ryu graph store and runs the read-only Cypher, printing columns/rows/nodeKeys (table by default, raw JSON with `--json`).
- [x] #2 First run builds the graph; **every** run rebuilds a fresh in-process graph, because ryu's Bun build keeps the graph in memory and does not persist it between processes. (Cross-run reuse is intentionally not possible with this backend; documented under Known Limitations.)
- [x] #3 File changes are picked up on the next run via a full rebuild (the incremental `computeChangeSet`/`applyChangeSet` path is available for a persistent store but cannot be used against an empty MEMFS store).
- [x] #4 Write keywords are blocked by runCypher; the memory backend returns a clear unsupported message instead of crashing.
- [x] #5 `--json` prints the raw CypherQueryResult; the default prints a readable aligned table of columns and rows.
- [x] #6 Uses its own graph slot/lock so it never collides with the Web server; concurrent CLI runs each build an independent in-process graph and cannot corrupt each other.
- [x] #7 `bunx tsc --noEmit`, `bun run check .`, and the graph suites stay green (4 reconcile-once tests + 77 graph tests pass).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a one-shot reconcile helper `reconcileGraphStoreOnce` (reuse exported `scanWhitelistedDirs` / `loadMetaCache` / `computeFileHash` / `computeAggregateFingerprint` / `saveMetaCache` / `computeChangeSet` / `ensureRecordCache` / `applyChangeSet` / `RecordCache` / `buildGraphFromFiles`) that mirrors `GraphService.reconcile` but without watchers / timers / ready-gate. It accepts `forceBuild`: when true (CLI), it always does a full build and never trusts a stale fingerprint, because ryu MEMFS is empty on every process start.
2. Register the `graph` command with a `query <cypher>` subcommand in `src/cli.ts`: resolve project root; `graphPaths(projectRoot, DEFAULT_SLOT)`; `mkdirSync`; `openGraphStore(ryu)`; `tryAcquireGraphLock` (courtesy only — warns if refused, since MEMFS is per-process anyway); `reconcileGraphStoreOnce` with `forceBuild: true`; `runCypher`; print aligned table (default) or JSON (`--json`); `store.close()`.
3. `runCypher` already blocks write keywords (`CREATE`/`DROP`/`DELETE`/`INSERT`/`MERGE`/`SET`/`UPDATE`) and returns `{ columns, rows, nodeKeys, truncated }`; no extra work needed here.
4. Tests + gates: add/update `graph-reconcile-once.test.ts` (4 tests covering forceBuild rebuild, reuse-within-process, and Cypher query), keep `bunx tsc --noEmit` and `bun run check .` green, and confirm the 77 graph tests still pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### ryu WASM does not persist across processes under Bun (MEMFS)
The only Bun-compatible ryu build (`ryugraph-wasm/sync`) keeps its graph in Emscripten's in-memory virtual filesystem (MEMFS), not the real disk. Evidence: a build followed by close+reopen **in the same process** yields 1385 nodes; reopen of the same `dbPath` in a **separate** `bun` process yields 0 and `Table FileNode does not exist`; the `.kuzu` directory never appears on disk (only the `.meta.json` fingerprint cache is written). The `nodejs/sync` build uses real `fs` but `Aborted` under Bun (it spins up `worker_threads`), so it is unusable here. Consequence: every CLI invocation is a fresh process with an empty store, so the fingerprint "reuse" branch silently returned 0 rows — that was the original end-to-end bug.

### forceBuild: CLI always rebuilds
`reconcileGraphStoreOnce` gained a `forceBuild` flag. The CLI passes `forceBuild: true`, skipping both the "fingerprint match → reuse" and "previous cache → incremental" branches and always calling `buildGraphFromFiles`. Because MEMFS starts empty per process, the fingerprint and incremental paths are meaningless to the CLI and would only produce an empty query. The Web server keeps using `GraphService.reconcile`'s incremental path (long-lived process, in-memory cache).

### Node label is `FileNode`, not `File`
In Cypher the file node label is `FileNode` (not `File`). Relation types: `ParentOf` / `BelongsToMilestone` / `DependsOn` / `SourcedFrom` / `LinksTo` / `TaggedWith`; tag nodes are `Tag`. The early "Table does not exist" false alarm was caused by querying `(n:File)`; switching to `FileNode` works.

### Table / JSON output rendering
`printCypherResult` measures column widths with `text.length` and emits no ANSI escapes, so output stays aligned under pipes/redirection. `--json` writes the raw `CypherQueryResult { columns, rows, nodeKeys, truncated }` via `JSON.stringify`. Write keywords (`CREATE|DROP|DELETE|INSERT|MERGE|SET|UPDATE`) are blocked inside `runCypher`; the `memory` backend returns a clear unsupported message instead of crashing. Invalid Cypher surfaces the parser error and exits non-zero.

### Lock is courtesy only
`tryAcquireGraphLock` attempts a single-holder lock on the default slot; the CLI rebuilds only when it acquires it. In practice each process has its own MEMFS, so the lock does not affect correctness — it only avoids a warning when the Web server holds the same slot. Concurrent CLI runs build independent in-process graphs and cannot corrupt each other.

### Performance
Measured cost for this repo: ~5–7s per invocation (≈0.8s bun startup + ≈5.6s full build of ~1385 FileNodes). This is the honest cost of the per-process rebuild; a persistent backend (native Kuzu or a Bun-compatible ryu `nodejs` build) would remove it.

### Follow-up fix: ParentOf edge direction corrected to parent -> child (found while testing the CLI)
Exercising `backlog graph query` surfaced a data-model bug: `ParentOf` edges were stored **child -> parent** (e.g. `BACK-217.01 -> BACK-217`), contradicting the intended semantics — `parent -[:ParentOf]-> child` means "parent is parent of child" — and the comment at `relations.ts` ("ParentOf: parent -> child"). Root cause: `resolveRelations` built the edge as `addEdge("ParentOf", record, target.filePath)`, where `record` is the child (it holds `parentTaskId`) and `target` is the resolved parent, so the edge pointed child -> parent. Fixed by swapping the arguments to `addEdge("ParentOf", target, record.filePath)`, yielding `parent -> child`. Because `incremental.ts` reuses `resolveRelations`, both the full build and the incremental sync path are corrected at once. The other edge types (`DependsOn` / `BelongsToMilestone` / `SourcedFrom` / `LinksTo` / `TaggedWith`) already read "property-holder -> target" and were left unchanged — `ParentOf` is the only one whose name describes the non-holder node (the parent). Correct query patterns: children = `MATCH (p {id:X})-[:ParentOf]->(c)`, parent = `MATCH (c {id:X})<-[:ParentOf]-(p)`. Downstream: `task-subgraph.ts` traverses the edges undirected (both adjacency directions), so its traversal logic is unaffected — only its test comment/fixtures were aligned; `graph-foundation.test.ts` and `graph-sync.test.ts` direction assertions were flipped. Docs: `src/guidelines/cli-instructions/graph.md` and the `cli.ts` help example now reflect parent -> child, and — per user preference — drop custom column aliases (no `AS parent_id`) so the column name is the expression itself.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
BACK-767 is complete. `backlog graph query "<cypher>"` exposes the read-only Cypher graph search (added in BACK-765, default ryu backend from BACK-766) through the CLI: it resolves the project root, opens the ryu store, builds the in-process graph, runs the read-only Cypher statement, and prints results as an aligned table (default) or raw JSON (`--json`).

Delivered changes:
- `src/cli.ts`: new `graph` command with `query <cypher>` subcommand; `tryAcquireGraphLock` (single-holder, courtesy only); `printCypherResult` (ANSI-free, `text.length`-based column widths); integration with `openGraphStore` / `reconcileGraphStoreOnce(forceBuild: true)` / `runCypher` / `store.close()`; `--json` flag; temporary DEBUG logs removed.
- `src/graph/reconcile-once.ts`: new `reconcileGraphStoreOnce(projectRoot, store, paths, { forceBuild })` — mirrors `GraphService.reconcile` without watchers / timers / ready-gate; with `forceBuild: true` it always performs a full `buildGraphFromFiles` (required because ryu's Bun build keeps the graph in MEMFS and every CLI process starts empty).
- `src/test/graph-reconcile-once.test.ts`: 4 tests covering forceBuild rebuild, within-process reuse, file-change rebuild, and a Cypher query against the seeded graph.

Follow-up fix delivered during testing (see Implementation Notes): the `ParentOf` edge direction was inverted (stored child -> parent) in `src/graph/relations.ts`; it is now `parent -> child`. `src/test/graph-foundation.test.ts` and `src/test/graph-sync.test.ts` assertions were flipped, `src/web/utils/task-subgraph.test.ts` comment/fixtures aligned, and `src/guidelines/cli-instructions/graph.md` + the `cli.ts` help example updated (direction corrected; custom column aliases dropped).

Quality gates: `bunx tsc --noEmit` passes; `bun run check .` (biome) reports no errors (only pre-existing `any` warnings); graph suite 77 pass + 4 reconcile-once pass, and the direction-affected suites (`graph-foundation`, `graph-sync`, `task-subgraph`) pass after the flip. Live CLI verified: `count(n)` → 1385; `BACK-521 -[:ParentOf]-> c` returns its 14 subtasks; `BACK-521.2 <-[:ParentOf]- p` returns the parent `BACK-521`; `--json` and write-statement rejection work; invalid Cypher fails gracefully.

Known limitations: ryu WASM under Bun stores the graph in MEMFS and does not persist across processes, so every `backlog graph query` invocation rebuilds the graph from scratch (~5–7s for this repo, ~1385 FileNodes); it is not shared with the Web UI's in-memory graph. A native Kuzu binding or a Bun-compatible ryu `nodejs` build would enable real on-disk persistence and make the fingerprint / incremental reuse paths effective.
<!-- SECTION:FINAL_SUMMARY:END -->

## Known Limitations

- **No cross-process persistence.** ryu WASM under Bun uses in-memory MEMFS; the graph is rebuilt from scratch on every `backlog graph query` invocation. Measured cost for this repo: ~5–7s per invocation (≈0.8s bun startup + ≈5.6s build of ~1385 FileNodes). This is the honest answer to "do I have to rebuild every time?" — yes, with the current backend.
- **Not shared with the Web UI.** The Web UI keeps its own long-lived in-memory graph; the CLI's graph is a separate build. They do not communicate.
- A future native backend (Kuzu native binding, or ryu's `nodejs` build — the latter currently aborts under Bun due to `worker_threads`) would enable real on-disk persistence and make the fingerprint/incremental reuse paths effective.

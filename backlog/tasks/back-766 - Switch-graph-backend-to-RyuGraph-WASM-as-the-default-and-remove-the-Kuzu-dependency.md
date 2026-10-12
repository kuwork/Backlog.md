---
id: BACK-766
title: >-
  Switch graph backend to RyuGraph-WASM as the default and remove the Kuzu
  dependency
status: Done
assignee:
  - '@kuwork'
created_date: '2026-10-12 11:52'
updated_date: '2026-10-12 13:33'
labels: []
dependencies: []
modified_files:
  - DEVELOPMENT.md
  - bun.lock
  - package.json
  - scripts/dev-kuzu.cmd
  - scripts/dev-kuzu.ps1
  - scripts/dev-kuzu.sh
  - scripts/patch-ryugraph.cjs
  - src/graph/cold-start.ts
  - src/graph/fingerprint.ts
  - src/graph/service.ts
  - src/graph/store.ts
  - src/server/index.ts
  - src/test/graph-foundation.test.ts
  - src/test/graph-sync.test.ts
  - src/types/ryugraph-wasm.d.ts
  - src/web/lib/api.ts
actual_end: '2026-10-12 08:58'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The BACK-765 Cypher-search UI was complete, but the kuzu native NAPI binding segfaults under Bun/Windows (the crash log pointed at `kuzujs.node`), and Bun/kuzu could not be upgraded in this environment. This task replaces the native Kuzu engine with **RyuGraph's WebAssembly build (`ryugraph-wasm`, an MIT fork of Kuzu)**, so Cypher search runs under Bun/Windows - the WASM executes in Bun's WebAssembly runtime and sidesteps the NAPI crash.

Two follow-ups are folded into this same card:
1. **Default backend.** Users should not have to set `BACKLOG_GRAPH_BACKEND`; ryu becomes the default, degrading gracefully to memory. Making it the default surfaced - and this task fixed - a crash on INT64 result columns.
2. **Remove the Kuzu dependency.** Since ryu is the default and the only backend that actually works on this platform, the `kuzu` npm package, `KuzuGraphStore`, and the `"kuzu"` backend option were removed. The backend type is now `"ryu" | "memory"`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `RyuGraphStore` builds the schema and upserts nodes (a port of the Kuzu store)
- [x] #2 `runCypher` executes against ryu and returns the matched nodes' path/id keys
- [x] #3 write statements (CREATE/DROP/DELETE/...) are rejected as read-only
- [x] #4 the graph persists to disk and is reused on reopen (schema-version stamp honoured)
- [x] #5 the memory backend still rejects Cypher, with a message that points to ryu
- [x] #6 `openGraphStore` defaults to ryu with no env var and no explicit backend
- [x] #7 `BACKLOG_GRAPH_BACKEND=memory` still forces the degraded mode; a failed ryu init falls back to memory instead of crashing
- [x] #8 queries with an INT64 result column (`RETURN count(n)`, `RETURN n, count(*)`, ...) no longer throw `ToBigInt` under Bun, and return correct numbers plus highlight keys
- [x] #9 edges persist and are readable via `getAllEdges` / `countEdges` (no silent zero-edge import)
- [x] #10 the `kuzu` dependency and every `"kuzu"` code path are removed; the backend type converges to `"ryu" | "memory"`
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `bunx tsc --noEmit` passes
- [x] #2 `bun run check .` (biome) passes (only pre-existing `any` warnings, no errors)
- [x] #3 `bun install` updates the lockfile (`bun.lock` has no kuzu reference); `node_modules/kuzu` removed
- [x] #4 graph suites green: graph-foundation + graph-sync + web-graph-cypher-reveal, 60 pass
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add dependency `ryugraph-wasm@25.9.2`; patch the Bun/BigInt embind issue via an idempotent `scripts/patch-ryugraph.cjs` wired into `postinstall` (patch-package was unusable because the project uses `bun.lock`, not an npm lockfile).
2. New `RyuGraphStore` (ported from `KuzuGraphStore`): its API is ~1:1 with kuzu (`prepare`/`execute`, `query(sql, params)`, `CALL show_tables()` all work). The only real difference is result access - ryu's `QueryResult` exposes `getAllRows()` (a column-parallel array) instead of kuzu's `getAll()` (objects), so `rowsFromResult` zips the column names back and reuses `serializeCypherValue` / `collectCypherNodeKeys`.
3. Add ambient types `src/types/ryugraph-wasm.d.ts` (the package ships no `.d.ts`).
4. `resolveGraphBackend()` replaces `isKuzuRequested`/`isRyuRequested`: default `ryu`, only `memory` overrides. `openGraphStore` wraps `RyuGraphStore.init()` in try/catch and falls back to the memory singleton with a `console.warn`.
5. `rowsFromResult`: catch the `ToBigInt`/`BigInt` failure and fall back to `rowsFromResultString` (`toString()`'s `|`-delimited cells, INT64-safe) plus `parseCypherCell`.
6. `upsertEdges`: replace `COPY ... FROM CSV` with a shared `upsertEdgesViaRunner` using `UNWIND + MATCH + MERGE`.
7. Remove `KuzuGraphStore`, `loadKuzu`, `KuzuModule`, and every `"kuzu"` union branch; converge the backend type to `"ryu" | "memory"`.
8. Drop `kuzu` from `package.json`; delete `scripts/dev-kuzu.*`; rewrite the `DEVELOPMENT.md` graph-backend section.
9. Tests + quality gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Bun/embind INT64 patch
`int64 -> BigInt` is incompatible under Bun. The published wrapper passes plain numbers to `SystemConfig`'s int64 parameters, and `maxDBSize` is `undefined` under Bun, so `new Database` throws `ToBigInt`. The idempotent patch wraps `bufferPoolSize` / `maxNumThreads` / `checkpointThreshold` in `BigInt()` and replaces `maxDBSize` with the literal `4611686018427387904n`. Node does not need the patch (it accepts numbers) and the patch is semantically harmless there.

### INT64 result columns crash
Once ryu became the default, any query returning an INT64 column (`count` / `size` / `sum` / degree / arithmetic) threw `ToBigInt` from `getAllRows()`. That error comes from **Bun's own embind shim for wasm** (not from JS inside `node_modules`), so it cannot be fixed at the JS level. Fix: `rowsFromResult` catches it and falls back to `rowsFromResultString`, which parses `toString()`'s `|`-delimited cells (INT64-safe); `parseCypherCell` normalises node/relationship cells `{_LABEL:..., path:..., id:...}` to the `{_label,_id,_src,_dst}` shape the shared helpers expect, preserving highlight keys.
Parsing gotcha: the first regex put the value in the wrong capture group - it actually lives in `m[2]` (the third alternative `[^,}]*` is not a separate group); fixed.

### Edges silently dropped on import (reported by the user as "task graph / knowledge graph have no edges")
Root cause: `RyuGraphStore.upsertEdges` reused `COPY ${type} FROM 'csv' (HEADER=true)`, and under **RyuGraph's WASM build that statement silently imports zero edges** (no error), while nodes went through `CREATE` and were fine - so once ryu became the default, every edge disappeared.
Evidence: `COPY ParentOf FROM ...` with `from,to` / `path,path` headers or no HEADER all reported `countEdges=0`; `UNWIND $pairs AS pair MATCH (a:FileNode {path:pair.from}),(b:...) MERGE (a)-[:T]->(b)` gave `countEdges=1`, deduped within the batch, and skipped edges whose endpoint node was missing (`MATCH` does not bind).
Fix: a shared `upsertEdgesViaRunner(runner, edges)` used by both stores; the dead `writeEdgeCsv` / `csvField` helpers were removed. The real construction paths - `fullImport` (import.ts:31) and the incremental path (incremental.ts:146) - both go through this interface.

### Removing the Kuzu dependency
With ryu as the default and the only working backend, the kuzu native package was removed. `KuzuGraphStore` (and every `import("kuzu")`) was deleted; the backend types converged to `"ryu" | "memory"`; `resolveGraphBackend` now recognises only `memory`. `BACKLOG_GRAPH_BACKEND=kuzu` is no longer a valid option.
The remaining "kuzu" strings are historical/naming only: the `.kuzu` **cache file extension** (unrelated to the dependency; renaming it would invalidate existing caches, so it is kept), doc comments noting "ryu is a Kuzu fork", and the feature name "Kuzu task graph".
`bun install` reported "1 package removed" and updated the lockfile, but did not delete the `node_modules/kuzu` directory (a leftover 13MB `kuzujs.node`); that was removed manually.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
BACK-766 (with the former BACK-767 and BACK-768 merged in) is complete. Cypher search now works out of the box under Bun/Windows - just run `bun run cli browser`, no environment variable needed - and the magnifier dialog highlights matched nodes. `BACKLOG_GRAPH_BACKEND=memory` can still force the degraded mode. The kuzu native dependency has been removed; ryu (WASM) is the only Cypher backend.

Delivered changes:
- `src/graph/store.ts`: new `RyuGraphStore` + `loadRyu`; `resolveGraphBackend` (default ryu, memory override) replacing `isKuzuRequested`/`isRyuRequested`; `openGraphStore` default ryu + memory fallback; `rowsFromResult` INT64 `toString()` fallback + `parseCypherCell`; `upsertEdges` via `UNWIND+MATCH+MERGE` (`upsertEdgesViaRunner`); `KuzuGraphStore` / `loadKuzu` / `KuzuModule` removed; `GraphStore.backend` now `"ryu" | "memory"`.
- Backend type converged to `"ryu" | "memory"` in `src/graph/service.ts`, `fingerprint.ts`, `cold-start.ts`, and `src/web/lib/api.ts` (`GraphPayload.backend`).
- `src/types/ryugraph-wasm.d.ts`: ambient declarations.
- `scripts/patch-ryugraph.cjs` + `package.json` `postinstall`: idempotent Bun/BigInt patch.
- `package.json`: added `ryugraph-wasm@25.9.2`, removed `kuzu`; `bun.lock` updated.
- Deleted `scripts/dev-kuzu.{sh,ps1,cmd}`; rewrote the `DEVELOPMENT.md` graph-backend section for ryu.
- Tests: `graph-foundation.test.ts` added RyuGraphStore cases (schema/upsert/Cypher highlight/write rejection/persistence), an INT64 fallback case, and an edge-persistence regression case; `graph-sync.test.ts` `/api/graph` backend assertion updated to `ryu`.

Quality gates: `tsc` passes; biome passes (only pre-existing `any` warnings); graph suites 60 pass. After `bun install`, `bun.lock` has no kuzu reference and `node_modules/kuzu` is gone.

Known limitations: the ryu patch is coupled to version `25.9.2` - bumping ryu's major version requires re-verifying the target block in `scripts/patch-ryugraph.cjs`; build-time inlining of `.wasm` into the six `bun build --compile` binaries is not yet verified end-to-end (source-level only). Benefit: the six-platform bundle no longer needs a kuzu native sidecar - ryu's single arch-independent `.wasm` covers all platforms.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-769
title: >-
  Add multi-database support to the graph CLI: named databases, write path, CSV
  import
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 13:58'
updated_date: '2026-10-13 05:37'
labels:
  - cli
  - graph
milestone: m-13
dependencies:
  - BACK-767
  - BACK-768
modified_files:
  - src/graph/snapshot.ts
  - src/graph/store.ts
  - src/graph/databases.ts
  - src/cli.ts
  - src/test/graph-snapshot.test.ts
  - src/test/graph-reconcile-once.test.ts
ordinal: 329001
actual_start: '2026-10-12 14:17'
actual_end: '2026-10-12 15:32'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the `backlog graph` CLI from a single derived graph into a multi-database tool.

Today `graph query` / `graph schema` only see the markdown-derived corpus graph, which is rebuilt in-process on every run because ryu's WASM build keeps the graph in Emscripten MEMFS and never writes to real disk (confirmed in BACK-767). This task adds **named user databases** that a user can create, describe, write to with CREATE/MERGE/SET/DELETE, and populate from CSV, plus a **persistence layer** so those databases survive across CLI runs.

Confirmed design decisions:
- Persistence via a JSON snapshot (schema DDL + nodes + edges) dumped after each write and hydrated on open.
- The `default` (derived) database stays **read-only** - it is a cache of the markdown truth and `forceBuild` would overwrite user writes.
- CSV import auto-creates the target table with type inference.
- Scope is **CLI only**; no Web UI or TUI work in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog graph query <db> "<cypher>"` accepts a database argument: `default` selects the existing derived graph, a user database name selects that database; the legacy one-argument form is still treated as `default`.
- [x] #2 `backlog graph schema <db>` and `backlog graph show-schema <db>` both print the schema of the given database.
- [x] #3 `backlog graph list` and `backlog graph describe <db>` show every database with its description, kind and table/node/edge counts.
- [x] #4 `backlog graph create <db> "<description>"` registers a user database; `backlog graph drop <db>` removes it together with its snapshot.
- [x] #5 `backlog graph insert <db> "<cypher>"` runs write Cypher (CREATE/MERGE/SET/DELETE) against a user database and persists the result.
- [x] #6 Writing to `default` is rejected with a clear message that points at `create`.
- [x] #7 Snapshots round-trip: a database written in one process is fully readable in the next, including tables, properties, primary keys and edges.
- [x] #8 Per-database single-holder locks keep concurrent CLI runs on different databases from blocking each other.
- [x] #9 `bunx tsc --noEmit`, `bun run check .` and the graph suites stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **P1 - read-only multi-database plumbing.** Add `src/graph/databases.ts` (registry read/write, `GraphDatabase` type, `userDatabasePaths(projectRoot, name)`); add a `<db>` positional to `graph query` (with a legacy one-argument form still treated as `default` when the argument looks like Cypher); add the `show-schema` alias; add `graph list` / `graph describe`. No persistence changes.
2. **P2 - user databases and the write path.** `graph create <db> "<description>"` / `graph drop <db>`; registry writes; per-database single-holder lock; `graph insert <db> "<cypher>"` via a new write path that drops the mutation-keyword block while still blocking dangerous statements, with a `kind === "derived"` rejection for `default`; `src/graph/snapshot.ts` dump/hydrate with atomic rename, hydrating **nodes before edges**.
3. **P3 - CSV import.** `src/graph/csv-import.ts`: read the file with node fs (never ryu `COPY FROM`), honour `--header`, `--map a=b,...` and `--node`, infer column types (INT64 / DOUBLE / BOOLEAN / STRING), auto-create the table when missing, insert in batches with parameterised `UNWIND ... CREATE`.
4. **P4 (optional).** Relationship CSV import, incremental hydrate, Web UI read-only browsing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Hard constraint: ryu WASM never writes to real disk
`ryugraph-wasm/sync` (the only Bun-compatible build) stores the graph in Emscripten's **MEMFS** - an in-process virtual filesystem. Evidence gathered during BACK-767: same process build -> close -> reopen gives 1385 nodes, a separate `bun` process reopening the same `dbPath` gives 0, the `.kuzu` directory never appears on disk (only the `.meta.json` fingerprint sidecar does), and `ryugraph-wasm/nodejs/sync` (which uses real fs) aborts under Bun via `worker_threads`. Therefore every CLI process starts from an empty store, and any user database must carry its own persistence layer or lose all data on the next invocation.

### Persistence: JSON snapshot + hydrate
A user database owns a snapshot under `<backlog>/databases/<name>.graph.json` (the backlog directory is resolved with `resolveBacklogDirectory`, so `backlog/`, `.backlog/` and a config-declared custom name all work):
```json
{ "version": 1, "database": "mydb",
  "nodeTables": [ { "name": "Person", "properties": [ { "name": "name", "type": "STRING", "primaryKey": true } ] } ],
  "relTables":  [ { "name": "KNOWS", "from": "Person", "to": "Person", "fromKey": "name", "toKey": "name" } ],
  "nodes": { "Person": [ { "name": "Alice", "age": 30 } ] },
  "edges": { "KNOWS":  [ { "from": "Alice", "to": "Bob" } ] } }
```
Hydration order is **DDL -> all nodes -> edges**. Edges must be last because a `MATCH` that does not bind silently drops the edge, and BACK-766 hit exactly that ("task graph / knowledge graph have no edges"). Every node row is projected onto the table's declared properties before insertion - see the bug notes below for why that is not cosmetic.

### User data lives with the project, not in the cache
`default` is a rebuildable **cache** of the markdown truth, so it stays in the OS cache directory next to its fingerprint sidecar. User databases are **user data**: they live under `<backlog>/databases/` so they are versionable, portable and backed up with the repository (`registry.json`, `<name>.graph.json`, `<name>.lock`). `backlog/databases/` is not in the graph scanner's whitelist (tasks / drafts / milestones / completed / wiki / docs / decisions), so a snapshot can never be ingested as corpus markdown.

### Schema DDL can be reconstructed from introspection
`show_tables()` gives name + `NODE`/`REL`; `table_info('<node>')` gives property name/type/primary-key; `show_connection('<rel>')` gives source/destination tables and their primary keys. Together they are enough to regenerate the DDL, so users never re-declare a schema to get it persisted. This reuses the introspection already built for `backlog graph schema`.

### CSV import must not use COPY FROM
BACK-766 proved that `COPY <table> FROM 'csv'` under the RyuGraph WASM build **silently imports zero rows** (no error). CSV loading therefore has to read the file with node fs and insert via batched parameterised `UNWIND $rows AS row CREATE (:T {...})`.

### Write guard moved from keyword-only to kind-aware
`runCypher` still blocks `CREATE|DROP|DELETE|INSERT|MERGE|SET|UPDATE`. A new `runWrite(statement, params?)` lifts that block for user databases while still refusing `DROP DATABASE|ATTACH|DETACH|INSTALL|LOAD EXTENSION`. The authoritative guard is the database `kind`: the CLI refuses `insert` against `default` **before opening the store**, because `forceBuild` rebuilds that graph from the markdown corpus and would overwrite any write.

### Store schema mode
`openGraphStore(path, { schema: "none" })` opens a file without creating or wiping tables, which is what a user database needs (`init()` otherwise stamps SCHEMA_VERSION and drops every table it does not recognise). `"corpus"` remains the default for `default`.

### Locking, and the two windows a writer must guard
The single-holder lock (`openSync(lockPath, "wx")`) is per database (`<name>.lock`, and the derived slot lock for `default`), so `default` and user databases never contend. `default` and a user database never share a lock, and neither does the Web UI: it claims the `port-<port>` slot, so `backlog browser` and `backlog graph query default` use different database files and different locks (verified live: with the Web UI serving on port 6431, `graph query default` still returned 1387 FileNodes).

Because a user database is a whole-file read-modify-write (hydrate -> statement -> dump), a writer has two windows to protect:

1. **The lock.** It is **mandatory for a write**: `insert` aborts when it cannot take the lock. A read may proceed without it - the snapshot is replaced atomically, so a lock-less reader sees a consistent older version.
2. **The file itself.** A lock cannot rule out a hand edit, another tool, or a restored backup. `registry.json` therefore records the snapshot's content hash as the CLI last wrote it (`snapshotFingerprint`), and a write compares: registry-recorded vs loaded, and loaded vs still-on-disk. Either mismatch aborts the write with both hashes shown; `--force` overrides deliberately. The registry record is refreshed by `recordSnapshot()` after every successful dump.

### Implementation status
P1 and P2 are delivered. P3 (CSV import) is still open - see AC #7; P4/P5 (relationship CSV, incremental hydrate, `default` snapshot reuse, Web UI browsing) are optional and untouched.

Delivered:
- `src/graph/databases.ts` - registry (`registry.json`, atomic rename), `GraphDatabase` resolution, name validation, `create` / `drop` / `recordSnapshot`, `listDatabases`.
- `src/graph/snapshot.ts` - `dumpDatabase` (introspection + per-table `MATCH`), `hydrateDatabase` (DDL -> nodes -> edges, with per-row projection), `saveSnapshot` / `loadSnapshot` / `loadSnapshotWithFingerprint` / `snapshotFingerprint`, `snapshotStats`.
- `src/graph/store.ts` - `OpenGraphStoreOptions.schema`, `GraphStore.runWrite`, `runCypher(statement, { maxRows })` + `DEFAULT_CYPHER_ROW_CAP`, schema-aware `countNodes`, exported `cypherCell`.
- `src/cli.ts` - `withGraphDatabase(dbName, fn, { write, requireUser, force })`; subcommands `query <db> [cypher]`, `schema <db>` + `show-schema` alias, `list`, `describe <db>`, `create <db> <description>`, `drop <db>`, `insert <db> <cypher> [--force]`; `BACKLOG_GRAPH_DEBUG=1` traces backend / snapshot / per-step node counts on stderr.
- `src/guidelines/cli-instructions/graph.md` - new `#### Databases` section; every example names its database.

### Bug fixes found by verification
1. **Snapshot dump inherited the 500-row display cap (data loss).** `dumpDatabase` called `store.runCypher()`, which truncates at `MAX_ROWS = 500` for display - so every table larger than 500 rows silently lost rows on the way to the snapshot: `UNWIND range(1,1200)` produced a 500-row snapshot that read back as 500. Edges were capped the same way, per relationship table. Fixed with a `maxRows` option (`DEFAULT_CYPHER_ROW_CAP = 500` by default, `Number.POSITIVE_INFINITY` from `dumpDatabase`). Regression test: "dump does not inherit the interactive 500-row cap".
2. **Concurrent writes lost updates.** Two simultaneous `insert`s both hydrated the same snapshot, each wrote a node, and the second dump overwrote the first: of `A` and `B` only `B` survived, and the losing process had only printed a warning. Fixed by making the lock mandatory for writes. Re-verified: one succeeds, one is refused, both rows survive.
3. **Hydration silently loaded zero rows from a heterogeneous snapshot.** ryu converts a `$rows` parameter into a LIST<STRUCT> and treats a **heterogeneous list as empty** - no error. A snapshot whose rows did not all share one shape (e.g. a hand-added row without the `_label` key the dump writes) therefore hydrated to an empty database: `after hydrate: countNodes=0`, and every query returned nothing. Fixed by projecting each row onto the table's declared properties before insertion, which also normalises the shape; a row missing a declared property now fails loudly with the table, property and row in the message. Regression tests: "rows of differing shape still load" and "a row that lost a declared property fails loudly".
4. **`countNodes()` hardcoded `MATCH (n:FileNode)`**, so it threw `Binder exception: Table FileNode does not exist` on any user database (it bit the first diagnostic probe). Now schema-aware: it counts `FileNode` when that table exists - preserving the corpus semantics, where `Tag` is a virtual classification node and `Meta` is bookkeeping - and otherwise counts every node table.
5. **Tests could pass vacuously.** `graph-snapshot.test.ts` and `graph-reconcile-once.test.ts` used `if (store.backend !== "ryu") return;`, so a silent fallback to the memory backend would have made every Cypher assertion disappear while the suite stayed green. They now assert `expect(store.backend).toBe("ryu")`. This is how bug 3 was hiding: previously "passing" hydration tests were not exercising what they claimed.

### Known limitations
The snapshot is a full dump/hydrate, O(database size) - fine up to roughly 1e5 rows; beyond that a persistent backend is required (native Kuzu, or a Bun-compatible ryu `nodejs` build). Each `insert` is one statement plus one snapshot write, so a multi-statement load is not atomic. The write guard covers other CLI processes (the lock) and out-of-band file changes (the registry fingerprint), but a change landing in the moments between the final check and the atomic rename is not detected. Scope is CLI only; Web UI/TUI access is deliberately out of scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
P1 and P2 are complete. The graph CLI now works against a named database - default plus any number of user databases created with backlog graph create - with a read-only Cypher path (query), schema introspection (schema / show-schema), inventory (list, describe), a write path (insert), removal (drop), and durable JSON snapshots under <backlog>/databases/ that survive across processes. default stays read-only, and writes are guarded by a mandatory per-database lock plus a registry-recorded snapshot fingerprint.

Five defects were found and fixed while verifying it: the snapshot dump inherited the 500-row display cap (silent row loss); concurrent writes lost updates; hydration silently loaded zero rows from a heterogeneous snapshot (ryu treats a mixed-shape $rows list as empty); countNodes hardcoded MATCH (n:FileNode) and threw on user databases; and the tests could pass vacuously because they skipped when the backend fell back to memory.

Scope change: AC #7 (CSV import) and the former P4 moved to their own tasks (BACK-770, BACK-771), and the derived-graph snapshot reuse became BACK-772, so this card carries only the multi-database core.

Gates: tsc clean; biome clean; 11 snapshot/reconcile tests plus the graph suites pass; every user-database flow was verified end to end across processes.
<!-- SECTION:FINAL_SUMMARY:END -->

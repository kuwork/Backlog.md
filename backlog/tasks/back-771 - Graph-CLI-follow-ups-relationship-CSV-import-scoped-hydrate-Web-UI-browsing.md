---
id: BACK-771
title: 'Graph CLI follow-ups: relationship CSV import, scoped hydrate, Web UI browsing'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 15:25'
updated_date: '2026-10-13 05:38'
labels:
  - cli
  - graph
milestone: m-13
dependencies:
  - BACK-769
  - BACK-770
modified_files:
  - src/graph/csv-import.ts
  - src/graph/snapshot.ts
  - src/graph/browser.ts
  - src/graph/store.ts
  - src/cli.ts
  - src/server/index.ts
  - src/web/App.tsx
  - src/web/components/GraphDatabases.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/lib/api.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/graph-csv-import.test.ts
  - src/test/graph-snapshot.test.ts
  - src/test/graph-browser.test.ts
  - src/guidelines/cli-instructions/graph.md
ordinal: 331001
actual_start: '2026-10-13 00:43'
actual_end: '2026-10-13 01:29'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three independent follow-ups deliberately kept out of BACK-769 (multi-database core). Each is shippable on its own; none is required for that core to be useful.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Relationship CSV import: import <db> <csv> --rel KNOWS --from <col> --to <col> creates edges by matching both endpoint keys, reusing the node importer's CSV reader.
- [x] #2 Scoped hydrate: a cold open loads only the tables a query references, falling back to a full hydrate whenever that cannot be determined.
- [x] #3 Web UI read-only browsing of user databases (list plus a Cypher box scoped to a database); the front end needs a generic renderer because it currently assumes the FileNode corpus schema.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an edge mode to csv-import.ts (MATCH both endpoints, then CREATE the relationship).
2. Store per-table fingerprints and extract referenced labels for scoped hydrate, always fail-safe to a full hydrate.
3. Add a server API to list user databases and query one, plus a generic result renderer; keep it read-only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### #1 Relationship CSV import
`importCsvRelations()` reuses the node importer's reader verbatim (`readCsvFile`), so header parsing, `--map`, `--no-header` and the malformed-file guards all behave the same for edges as for nodes. Two columns name the endpoints; everything else about the file is ignored, because a relationship table carries no properties in the snapshot.

- **Endpoints are matched, not created.** `MATCH (a:F {key: row.from}), (b:T {key: row.to}) MERGE (a)-[:R]->(b)`. A row whose node does not exist binds nothing and produces no edge - silently, as far as ryu is concerned - so the CLI counts those rows and reports `跳过 N 行`. The same count covers a row whose edge the pair already has: `MERGE` never stacks a duplicate, so re-importing a file is idempotent (verified: a second import of the same file adds 0 edges).
- **Where the endpoints come from.** An existing relationship table already declares them (`show_connection`), and that declaration wins - so once the table exists, `--from-node` / `--to-node` are unnecessary. When the table has to be created, they are required (`--node` is the shorthand for "both ends are this table"), and a missing endpoint node table is an error that names the import command to run first.
- **A numeric endpoint key is cast.** The endpoint key is bound with `CAST(row.x AS <type>)`, because passing a JS number to an INT64 parameter throws under Bun (BACK-770 hit the same wall) and matching an INT64 key as text would bind nothing. Covered by a test with an `INT64 PRIMARY KEY` table.

### #1 follow-on bug: an INT64 key lost every edge on reload
The edge replay in `hydrateDatabase` matched `{key: row.from}` with no cast. The dump writes an INT64 key as a number, the snapshot stores it as text (the dump stringifies typed values), and binding that text to an INT64 column threw `Invalid argument type in ToBigInt operation` - or, before the cast was added anywhere, matched nothing. Fixed by casting both endpoint keys on hydrate the same way node properties are cast. Regression test: "an INT64 primary key re-links its edges after a round-trip".

### #2 Scoped hydrate
`referencedTables(statement, snapshot)` returns the tables a statement touches, or `null` when it cannot tell. `null` means "hydrate everything", and that is the default for every caller that does not pass a statement: a partial hydrate that guessed wrong leaves a query running against a table that was never created, which reads as **no rows** rather than as an error - the worst possible failure mode for a read-only tool.

- A label is only recognised after `(` and a relationship name only after `[`, so a property map (`{name: 'Alice'}`) is never mistaken for a table. `CALL table_info('X')` / `show_connection('X')` are honoured as well.
- `null` for: `show_tables()` or any `db.` call, an unlabelled `MATCH (n)`, a statement naming nothing, and - importantly - any name the snapshot does not carry (the statement may be ahead of the data, or the scan may have misread it).
- A referenced relationship pulls in both of its endpoint tables; a relationship whose endpoint was not loaded is skipped rather than replayed into a void.
- Only `graph query` passes a statement. `schema` / `describe` enumerate every table, and `insert` / `import` are whole-database read-modify-write, so all of them hydrate fully.

**Measured benefit is modest**: on a database of 5050 rows in two tables, a query touching only the 50-row table took 3.08s against 3.71s for a full hydrate - the ~1.7s process start and the JSON parse dominate, and only the skipped table's inserts (roughly 0.12 ms per row) are saved. It grows with the size of the tables a query does *not* touch, and costs nothing when it cannot apply. `BACKLOG_GRAPH_DEBUG=1` prints the chosen scope.

### #3 Web UI read-only browsing
A **Databases** page: a list of every database with its row counts, and a Cypher box scoped to the selected one. Two new endpoints back it - `GET /api/graph/databases` and `POST /api/graph/db-cypher` - and the result table is generic (it renders whatever columns the query returns), because the page cannot assume the FileNode schema the graph view is built around.

- `default` is routed to the existing graph service, which owns the corpus rebuild and the lock; `UserDatabaseBrowser` refuses it if a caller ever bypasses that route. Only user databases go through the browser.
- **Serving a user database in a resident process is where the interesting bug was.** A CLI call is a one-shot process, so it can replay the snapshot every time; the server must not, or every keystroke would pay a full hydrate. So it hydrates once and then compares the snapshot's fingerprint on each query, replaying only when the file changed (the CLI replaces it atomically, so a concurrent read sees the older, still-consistent version). Replay cost is paid once, then a query is instant.
- **Reopening the same database path in one process used to serve stale data, silently.** ryu keeps its file in WASM memory and `close()` does not release it, so the second `openGraphStore(path)` saw the *previous* hydrate's rows; the re-hydrate then inserted **nothing at all**, because one duplicate primary key poisons a whole batched `CREATE`. Nothing errored - the page just showed the old counts. Fixed in `RyuGraphStore.init()`: a user database (`schema: "none"`) now starts empty, because its durable copy is the snapshot sidecar, not this file. Regression tests cover both the store ("reopening the same user-database path starts empty") and the browser (a changed snapshot is replayed). This is the second time a silent-zero-row failure came from the same ryu behaviour - see the heterogeneous-`$rows` bug in BACK-769.
- The page is read-only by construction: it has no write path, and `db-cypher` only accepts a read-only statement through the same store the CLI reads with.
<!-- SECTION:NOTES:END -->

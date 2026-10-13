---
id: BACK-770
title: Add backlog graph import for CSV import into a user database
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 15:23'
updated_date: '2026-10-13 05:38'
labels:
  - cli
  - graph
milestone: m-13
dependencies:
  - BACK-769
modified_files:
  - src/graph/csv-import.ts
  - src/graph/snapshot.ts
  - src/cli.ts
  - src/test/graph-csv-import.test.ts
  - src/test/graph-snapshot.test.ts
  - src/guidelines/cli-instructions/graph.md
ordinal: 330001
actual_start: '2026-10-12 23:56'
actual_end: '2026-10-13 00:32'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Load rows from a CSV file into a user database. ryu COPY FROM silently imports zero rows under the WASM build (BACK-766), so the file must be read with node fs and inserted with batched parameterised UNWIND; the target table is auto-created with inferred types when absent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 import <db> <csv> [--node T] [--header] [--map a=b,...] loads rows into a user database and persists the snapshot.
- [x] #2 Rows go in via batched parameterised UNWIND; ryu COPY FROM is never used.
- [x] #3 A missing target table is auto-created with inferred column types (INT64 / DOUBLE / BOOLEAN / STRING).
- [x] #4 A malformed file fails with a clear message and leaves the database unchanged.
- [x] #5 tsc, biome and the graph suites stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/graph/csv-import.ts: node fs read, header handling, --map, type inference.
2. Insert in batches, reusing the BACK-769 write path and snapshot persistence.
3. Register the import subcommand; document it in graph.md.
4. Tests: round-trip, header/map variant, malformed file.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Reading is split from writing on purpose
`readCsvFile()` does all validation - parse, header, `--map`, column names, type inference - before a store is opened. The CLI calls it first and only then calls `withGraphDatabase(..., { write: true })`, so a malformed file cannot even reach the hydrate step. That is what makes AC #4 structurally true rather than merely likely: the snapshot is only ever dumped after `fn` resolves, so any throw leaves the file on disk exactly as it was.

### Parameter binding: text in, CAST in Cypher
Under Bun's embind a JS number handed to an INT64 or DOUBLE parameter throws `TypeError: Invalid argument type in ToBigInt operation` (verified: `{i: 5n, d: 2.5, b: true}` failed, and so did a plain `{d: 1}`). BigInt works for INT64, but a uniform rule is simpler and safer: every cell is passed as text and cast at the destination (`CAST(row.age AS INT64)`), with STRING columns passed as-is. The same rule now applies on hydrate (`src/graph/snapshot.ts`), where a snapshot value is stringified before it is handed to a typed column.

Values are validated in JS, never by ryu: `CAST('abc' AS INT64)` is **silent** - it yields NULL rather than an error - so each cell is checked against its column type first (`INT64` integer, `DOUBLE` numeric, `BOOLEAN` one of true/false/1/0/yes/no/y/n/t/f) and a bad cell names its line and column.

### MERGE, not CREATE: one duplicate key used to lose a whole batch
The first implementation used `UNWIND $rows AS row CREATE (:T {...})`. Measured: a batch of two rows in which one key already existed inserted **nothing at all** - not the new row, not an error. One duplicate silently discarded every other row in its batch. The statement is now `MERGE (n:T {key: row.key}) SET n.col = ...`, so a key the database already has is updated and a new one is inserted. A table with no primary key has nothing to merge on and keeps `CREATE`. The CLI reports 新增 / 覆盖 / 文件内重复 counts so the outcome is visible either way.

### The first column is the primary key
A node table needs a key for MERGE to mean anything, and for a re-import to be idempotent, so the first CSV column is declared `PRIMARY KEY` when the table is auto-created (every type is accepted, including DOUBLE and BOOLEAN). Existing tables are matched against their declared schema, and a CSV column the table does not have is an error - silent dropping of a column would be data loss.

### Bug fixes found by verification
1. **The dump was lossy for any value containing a comma or newline.** `dumpDatabase` used `RETURN n`; ryu cannot hand a whole node across the WASM boundary when one of its properties is INT64, so `getAllRows()` threw and the caller fell back to parsing ryu's `|`-delimited text - which cut a value at its first comma ("Ann, A" came back as "Ann") and mangled anything containing a newline. Fixed by returning the declared properties one by one (`RETURN n.\`a\`, n.\`b\``), which stays on the structured path. Regression test: "a value containing a comma survives dump -> save -> load -> hydrate".
2. **NULL could not round-trip.** Because `RETURN n` omits a property ryu holds as NULL, an empty CSV cell produced a snapshot row with no such key - and hydrate's per-row projection treated a missing key as corruption and refused to load the database ("快照损坏：people 的一行缺少字段 score"). NULL is now a legal absence: `projectRow` fills a missing declared property with NULL and instead rejects a key the table never declared, which keeps the hand-edit guard loud (a renamed field still fails). Separately, the dump writes NULL rather than "" for a typed column (an INT64 column has no empty value of its own), because handing "" to a typed column on hydrate is exactly what used to break the reopen.
3. **A NULL primary key segfaulted the WASM backend.** A snapshot row produced by the bug above hydrated into `CREATE (:T {key: NULL})`, which crashed Bun outright (`panic: Segmentation fault`) before the lossy dump was fixed. `bindableRow` now refuses an empty primary key with the row and table named, so a corrupt snapshot is reported instead of taking the process down.
4. **A newline in the merge key split one row into two.** `MERGE (n:T {k: "a\nb"})` created two nodes ("a" and "b") with no error - in a parameter and in a literal, and only for the key column (`SET` columns keep newlines intact, and plain `CREATE` keeps them in the key too). Such a value is now refused with its line and column. Rare in practice - a key with an embedded newline - and the alternative is silent data loss.

### Known limitations
An empty cell in a STRING column and a NULL in one both read back as empty: ryu reports NULL as an empty cell and cannot distinguish the two on the way out. Import is an upsert on the primary key, not a transaction - a failure mid-file leaves the rows already written (the snapshot is dumped only after the whole file is inserted, so a failure leaves the database as it was). Type inference is per column over the whole file, so a column whose values are mostly numeric with one stray word becomes STRING.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog graph import <db> <csv> loads a CSV file into a user database: the file is read with node fs, the target table is created with inferred column types when it does not exist, and rows go in with batched parameterised UNWIND (ryu COPY FROM is never used - it imports zero rows under the WASM build). --node names the table, --map renames headers, --header / --no-header control whether the first line is a header. The first column is the primary key, so re-importing updates the rows it already has; a malformed file is rejected with its line number before the database is opened, leaving it unchanged.

Four defects surfaced while verifying it, three of them pre-existing and all of them silent: the snapshot dump cut any value at its first comma (and mangled newlines) because an INT64 property forced the lossy text-parsing fallback; NULL could not round-trip, so an empty cell made the next open refuse to load; a NULL primary key segfaulted the WASM backend; and MERGE split a row whose key contained a newline into two. Each is fixed with a regression test, and the same fix makes plain values (commas, quotes, newlines) survive a dump/hydrate cycle for the first time.

Gates: tsc clean; biome clean; 14 new csv-import tests plus the six graph suites (96 tests) pass; the whole flow was verified end to end across processes on a scratch project, including 1200 rows in ~2.4s.
<!-- SECTION:FINAL_SUMMARY:END -->

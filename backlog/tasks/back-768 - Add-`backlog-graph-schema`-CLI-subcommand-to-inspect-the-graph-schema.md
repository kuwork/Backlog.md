---
id: BACK-768
title: Add `backlog graph schema` CLI subcommand to inspect the graph schema
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 13:20'
updated_date: '2026-10-13 05:37'
labels:
  - cli
milestone: m-13
dependencies:
  - BACK-767
modified_files:
  - src/cli.ts
  - src/guidelines/cli-instructions/graph.md
ordinal: 328001
actual_start: '2026-10-12 13:20'
actual_end: '2026-10-12 13:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a `schema` subcommand to the existing `backlog graph` CLI command (BACK-767 added `graph query`) that prints the structure of the derived task/knowledge graph: every node table with its properties (name, type, primary key) and every relationship table with its source/target endpoints. This lets users discover labels and relationships without guessing, and mirrors ryu's read-only introspection procedures. It reuses the same read-only ryu/WASM backend and one-shot reconcile helper as `graph query`, and is documented in the CLI instruction guide.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `backlog graph schema` prints every node table with its properties (name, type, primary key) and every relationship table with its source and destination endpoints.
- [x] #2 `--json` prints the schema as a machine-readable object: `{ nodes: [...], relationships: [...] }`.
- [x] #3 The schema is read via ryu read-only introspection (`show_tables` / `table_info` / `show_connection`); no write keywords are used and the graph is never mutated.
- [x] #4 Behaviour matches `graph query`: same in-process rebuild / slot / lock path (~5-7s per call).
- [x] #5 `src/guidelines/cli-instructions/graph.md` documents the subcommand near the front and `backlog graph --help` lists it.
- [x] #6 `bunx tsc --noEmit`, `bun run check .`, and the graph suites stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract a shared `withGraphStore(run)` helper in `src/cli.ts` (resolve project root; `graphPaths(cwd, DEFAULT_SLOT)`; `mkdirSync`; `openGraphStore(ryu)`; backend guard; courtesy `tryAcquireGraphLock`; `reconcileGraphStoreOnce(..., { forceBuild: true })`; run callback; `finally` close store + release lock) and refactor the existing `graph query` action onto it, removing the duplicated boilerplate.
2. Add `loadGraphSchema(store)`: call `show_tables()` to enumerate tables, then `table_info('<node>')` for each NODE table and `show_connection('<rel>')` for each REL table. Use `RETURN *` and look columns up by name so no backticked identifiers are needed in the query strings.
3. Add `printGraphSchema(schema)` for the human-readable sections and register `graph schema [--json]`; add `backlog graph schema` to the `graph` command help examples.
4. Document the subcommand in `src/guidelines/cli-instructions/graph.md` as the first `### CLI Usage` subsection (`#### Inspecting the graph schema`), and mention the two subcommands in the intro and Key Rules.
5. Gates: `bunx tsc --noEmit`, `bun run check .`, the graph test suites, and a live CLI run of `graph schema` / `graph schema --json`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### ryu schema introspection procedures (only these work)
- `CALL show_tables() RETURN name, type` -> columns `id`, `name`, `type`, `database name`, `comment`; `type` is `NODE` or `REL`.
- `CALL table_info('<nodeTable>') RETURN *` -> columns `property id`, `name`, `type`, `default expression`, `primary key`. NODE tables only; on a REL table it returns no rows.
- `CALL show_connection('<relTable>') RETURN *` -> columns `source table name`, `destination table name`, `source table primary key`, `destination table primary key`. REL tables only (calling it on a node table errors).
- `CALL db.labels()` does **not** exist in ryu (`Parser exception: Invalid input <CALL db.>`).

### Column-name handling
Introspection columns contain spaces (`primary key`, `source table name`, ...). Rather than backtick them inside the query string, every introspection call uses `RETURN *` and reads values via a `cypherCell(result, row, columnName)` lookup on `result.columns`. This keeps the generated query strings quote-free and robust.

### Read-only guard
`runCypher` blocks `CREATE|DROP|DELETE|INSERT|MERGE|SET|UPDATE` but deliberately allows `CALL`, so these introspection procedures pass through unchanged.

### Shared store lifecycle
`schema` and `query` now share `withGraphStore`, which centralises the open -> backend guard -> lock -> `forceBuild` rebuild -> close/release sequence. `graph query` behaviour is unchanged; the refactor only removes duplicated bootstrapping.

### Persistence
The same ryu/WASM MEMFS limitation documented for BACK-767 applies: the graph is rebuilt in-process on every invocation (~5-7s for ~1385 FileNodes) and is not shared with the Web UI.

### Output shape
`schema` (default) prints `Node tables (NODE)` with per-table property lines (`name  type  (primary key)`) and `Relationship tables (REL)` as Cypher patterns, one per relationship table: `From -[:RelName]-> To` (e.g. `FileNode -[:ParentOf]-> FileNode`, `FileNode -[:TaggedWith]-> Tag`). `--json` prints `{ "nodes": [{ name, properties: [{ name, type, primaryKey }] }], "relationships": [{ name, from, to }] }`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered `backlog graph schema` (`src/cli.ts`), a read-only subcommand that prints the graph schema with an optional `--json` mode. It uses ryu's `show_tables` / `table_info` / `show_connection` procedures and reuses the one-shot reconcile path, so it behaves exactly like `graph query` (in-process rebuild, own slot/lock, ~5-7s). `graph query` was refactored onto a shared `withGraphStore` helper with no behaviour change.

Verified against the live graph: 9 tables reported (NODE: FileNode, Meta, Tag; REL: ParentOf, BelongsToMilestone, DependsOn, SourcedFrom, LinksTo, TaggedWith), both plain and `--json` output correct, and `graph query` still returns the expected rows.

Documented in `src/guidelines/cli-instructions/graph.md` as the first `### CLI Usage` subsection (`#### Inspecting the graph schema`), plus intro and Key Rules updates and a `graph schema` help example.

Gates: `bunx tsc --noEmit` clean; `bun run check` clean; graph suites 69 pass.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-789
title: Add graph_import_csv MCP tool
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 05:50'
updated_date: '2026-10-13 07:56'
labels:
  - mcp
milestone: m-14
dependencies:
  - BACK-784
modified_files:
  - src/mcp/tools/graph/handlers.ts
  - src/mcp/tools/graph/index.ts
  - src/mcp/tools/graph/schemas.ts
  - src/test/mcp-graph.test.ts
ordinal: 348001
actual_start: '2026-10-13 07:49'
actual_end: '2026-10-13 07:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the `graph_import_csv` MCP tool (write operation): import rows from a CSV file into a user database. Reuse `readCsvFile` / `importCsvTable` (nodes) and `importCsvRelations` (edges) from `src/graph/csv-import.ts`. Mark `destructiveHint: true`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Node CSV import with `--node` / `--header` / `--map` column mapping.
- [x] #2 Relationship CSV import with `--rel` / `--from` / `--to` endpoint matching.
- [x] #3 Type inference and clear errors on malformed input.
- [x] #4 The tool is annotated `destructiveHint: true`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
1. Add `graphImportCsvSchema` (`db`, `csv` required; optional `node`/`rel`/`from`/`to`/`header`/`map`) to `schemas.ts`.
2. `GraphHandlers.importCsv` dispatches to `importCsvTable` (nodes) or `importCsvRelations` (edges) based on the provided flags, reusing `readCsvFile`.
3. Register `graph_import_csv` with `destructiveHint: true`.
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
### Approach
Registers `graph_import_csv` as the second write tool, mirroring the CLI's `backlog graph import`. The caller passes `db` + `csv` (plus optional `node`, `map`, `header`); adding `rel` together with `from`/`to` switches from a node import to an edge import. The file is read and fully validated with `readCsvFile()` *before* `withUserDatabaseWrite()` opens the store, so a malformed file (ragged rows, a value the column's type cannot hold, an unterminated quote) leaves the database untouched. Node imports run through `importCsvTable` (a missing table is created from inferred types; re-importing updates rows by primary key), relationship imports through `importCsvRelations` (endpoint keys are matched, never created; a row that yields no edge is counted as skipped). On the MCP side the input is validated against `graphImportCsvSchema`; `map` is declared without a JSON `type` because the shared validator has no object type, and is normalised in the handler (rejecting anything that is not a `{ header: property }` object of strings). CSV errors surface as `VALIDATION_ERROR`; write-phase failures as `OPERATION_FAILED`; an unknown database as `RESOURCE_NOT_FOUND` (from the shared access layer). The read-only `default` database is refused by `withUserDatabaseWrite`. A relative `csv` is resolved against the project root rather than the MCP process's cwd.

### Files touched
- `src/mcp/tools/graph/schemas.ts` — added `graphImportCsvSchema` (`db`, `csv` required; optional `node`, `map`, `header`, `rel`, `from`, `to`, `fromNode`, `toNode`; `additionalProperties: false`).
- `src/mcp/tools/graph/handlers.ts` — added `GraphImportCsvArgs`, a `readCsvInput` helper (wraps `readCsvFile` errors as `VALIDATION_ERROR`) and the `importCsv` method (argument checks, relative-path resolution, node/edge dispatch through the shared write layer, `map` normalisation).
- `src/mcp/tools/graph/index.ts` — registered `graph_import_csv` with `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false`.
- `src/test/mcp-graph.test.ts` — added 5 tests: registration; node import (table created, inferred types); relationship import (edges between existing nodes); malformed-CSV clear error; refusal against the read-only `default` database.

### Verification
- `bunx tsc --noEmit` — clean.
- `bunx @biomejs/biome check --write src/mcp/tools/graph/ src/test/mcp-graph.test.ts` — clean (1 import-order fix).
- `bun test --timeout 30000 src/test/mcp-graph.test.ts` — 23/23 pass.
<!-- SECTION:NOTES:END -->

## Final Summary
<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the `graph_import_csv` MCP tool — the write path for loading CSV data into a user database. It mirrors the CLI's `backlog graph import`: pass `db` + `csv` to import rows as nodes (a missing table is created with inferred column types), or add `rel`/`from`/`to` to import the CSV as edges between existing nodes. The whole file is validated before the database is opened, so malformed input fails with a precise line/column message and leaves the database unchanged. Node imports are idempotent by primary key (re-importing updates rather than duplicates), and relationship imports match — never create — endpoint keys, reporting how many rows produced no edge. Registered with `destructiveHint: true`; the read-only `default` database is refused. Five new tests cover node imports, relationship imports, malformed input, the read-only refusal, and registration; the full `mcp-graph` suite passes (23/23) and tsc/biome are clean.
<!-- SECTION:FINAL_SUMMARY:END -->

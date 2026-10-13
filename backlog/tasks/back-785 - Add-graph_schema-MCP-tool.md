---
id: BACK-785
title: Add graph_schema MCP tool
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 05:50'
updated_date: '2026-10-13 14:42'
labels:
  - mcp
milestone: m-14
dependencies:
  - BACK-784
modified_files:
  - src/mcp/tools/graph/graph-access.ts
  - src/mcp/tools/graph/handlers.ts
  - src/mcp/tools/graph/index.ts
  - src/mcp/tools/graph/schemas.ts
  - src/test/mcp-graph.test.ts
ordinal: 344001
actual_start: '2026-10-13 06:31'
actual_end: '2026-10-13 06:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the `graph_schema` MCP tool: print the schema of a chosen database — every node table with its properties (name, type, primary key) and every relationship table with its source/target endpoints. Reuse the introspection that the CLI `graph schema` subcommand already performs (ryu `show_tables` / `table_info`), but execute it through the long-lived `GraphService` rather than a one-shot CLI process. `readOnlyHint: true`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `graph_schema` returns node tables + properties and relationship tables + endpoints for the `default` graph.
- [x] #2 `graph_schema` returns the schema of a named user database.
- [x] #3 Queries for a non-existent database return a clear error.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
1. Add `graphSchemaSchema` to `schemas.ts` (`db` required).
2. Add a `schema` method to `GraphHandlers` that reuses the introspection used by the CLI `graph schema` (extract it into a shared helper to avoid duplicating the ryu calls).
3. Register `graph_schema` in `index.ts` with `readOnlyHint: true`.
4. Add a test asserting schema shape for `default` and a clear error for an unknown db.
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
### Approach deviation (vs. plan)
The plan and Description said to introspect through the long-lived `GraphService`. Per the
BACK-784 foundation decision, this tool instead reuses the shared one-shot access layer
`src/mcp/tools/graph/graph-access.ts` (`schemaDatabase(rootDir, db)`), which opens the store,
prepares it (reconcile the derived corpus graph, or hydrate a user DB from its snapshot), runs
`readSnapshotSchema`, then closes. This mirrors exactly what `backlog graph schema` does per
invocation and avoids a second persistent open of the ryu database inside the MCP process.

### Files touched
- `src/mcp/tools/graph/schemas.ts` — added `graphSchemaSchema` (`db` required, `additionalProperties: false`).
- `src/mcp/tools/graph/handlers.ts` — added `schemaGraph(args)` to `GraphHandlers` and the `GraphSchemaArgs` type; it calls `schemaDatabase` and returns `JSON.stringify(schema)` as a text result.
- `src/mcp/tools/graph/index.ts` — registered `graph_schema` via `createSimpleValidatedTool` with `readOnlyHint: true, destructiveHint: false`.
- `src/mcp/tools/graph/graph-access.ts` — added `schemaDatabase`; also wrapped `resolveDatabase` errors thrown by `openDatabaseReadonly` / `withUserDatabaseWrite` into `BacklogToolError` (code `RESOURCE_NOT_FOUND`) so an unknown database surfaces the clear "不存在" message through the MCP tool wrapper instead of the generic "An unexpected error occurred". Fixed the return type to `Awaited<ReturnType<typeof readSnapshotSchema>>` (the planned `GraphSchema` name does not exist in `snapshot.ts`; the real shape is an inline `{ nodeTables, relTables }`).
- `src/test/mcp-graph.test.ts` — added 4 tests: `graph_schema` registration, default schema shape (node tables + properties + rel tables), a named user-database schema, and a clear error for an unknown db.

### Verification
- `bunx tsc --noEmit` — clean.
- `bunx @biomejs/biome check --write src/mcp/tools/graph/ src/test/mcp-graph.test.ts` — clean (1 import-order auto-fix).
- `bun run test src/test/mcp-graph.test.ts` — 8/8 pass (incl. the 4 new schema tests).
<!-- SECTION:NOTES:END -->

## Final Summary
<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the `graph_schema` MCP tool, built on the BACK-784 one-shot access layer. It introspects any
database's schema — `default` (derived corpus) or a user database — returning every node table with
its properties (name/type/primary key) and every relationship table with its source/target endpoints,
via the shared `readSnapshotSchema`. Registered with `readOnlyHint: true`. Unknown databases now
return a clear "不存在" error (wrapped as `BacklogToolError`) rather than a generic failure. Four new
tests cover registration, default + user-DB schema shape, and the unknown-DB error; the full
`mcp-graph` suite passes (8/8) and tsc/biome are clean.
<!-- SECTION:FINAL_SUMMARY:END -->

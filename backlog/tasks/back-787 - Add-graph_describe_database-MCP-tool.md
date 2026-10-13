---
id: BACK-787
title: Add graph_describe_database MCP tool
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 05:50'
updated_date: '2026-10-13 07:21'
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
ordinal: 346001
actual_start: '2026-10-13 07:18'
actual_end: '2026-10-13 07:21'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the `graph_describe_database` MCP tool: return per-database details — description, timestamps, and per-table row/edge counts — for a single named database. Reuse the single-database form of `describeDatabases()`. `readOnlyHint: true`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Returns description, timestamps, and table counts for the requested database.
- [x] #2 Queries for a non-existent database return a clear error.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
1. Add `graphDescribeDatabaseSchema` (`db` required) to `schemas.ts`.
2. `GraphHandlers.describeDatabase` calls `describeDatabases(db)` and maps details into MCP content.
3. Register `graph_describe_database` with `readOnlyHint: true`.
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
### Approach
Reuses `describeDatabases()` from `src/graph/browser.ts` (the same helper `graph_list_databases` uses) and selects the single requested database by name. This keeps a single source of truth for database metadata rather than introducing a second per-database description path.

### Files touched
- `src/mcp/tools/graph/schemas.ts` — added `graphDescribeDatabaseSchema` (`db` required, `additionalProperties: false`).
- `src/mcp/tools/graph/handlers.ts` — added `GraphDescribeDatabaseArgs` and the `describeDatabase` method, which calls `describeDatabases()`, finds the named database, and returns its details as JSON text; an unknown name throws a `BacklogToolError` (`RESOURCE_NOT_FOUND`) whose message lists the available databases and contains "不存在".
- `src/mcp/tools/graph/index.ts` — registered `graph_describe_database` with `readOnlyHint: true, destructiveHint: false`.
- `src/test/mcp-graph.test.ts` — added 3 tests: registration, describing `default` (kind/description/nodes/edges), and the unknown-db clear error.

### Verification
- `bunx tsc --noEmit` — clean.
- `bunx @biomejs/biome check --write src/mcp/tools/graph/ src/test/mcp-graph.test.ts` — clean (1 import-order auto-fix).
- `bun run test src/test/mcp-graph.test.ts` — 13/13 pass (incl. the 3 new describe tests).
<!-- SECTION:NOTES:END -->

## Final Summary
<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the `graph_describe_database` MCP tool, built on the shared one-shot access layer and reusing `describeDatabases()` from `src/graph/browser.ts`. It returns a single named database's details — kind, description, creation/updated timestamps, and node/edge counts — as JSON. Unknown databases return a clear "不存在" error listing what is available. Registered with `readOnlyHint: true`. Three new tests cover registration, `default` metadata, and the unknown-db error; the full `mcp-graph` suite passes (13/13) and tsc/biome are clean.
<!-- SECTION:FINAL_SUMMARY:END -->

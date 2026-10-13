---
id: BACK-788
title: Add graph_create_database MCP tool
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 05:50'
updated_date: '2026-10-13 07:47'
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
ordinal: 347001
actual_start: '2026-10-13 07:25'
actual_end: '2026-10-13 07:47'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the `graph_create_database` MCP tool (write operation): create a user database from a name and description. Reuse `createUserDatabase` from `src/graph/databases.ts`. Mark `destructiveHint: true` and require an explicit confirmation/acknowledgement from the caller.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Creates the user-database file and registers it in the databases registry.
- [x] #2 Duplicate or illegal names return a clear error without side effects.
- [x] #3 The tool is annotated `destructiveHint: true`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
1. Add `graphCreateDatabaseSchema` (`name` required, `description` required) to `schemas.ts`.
2. `GraphHandlers.createDatabase` calls `createUserDatabase`, mapping errors (duplicate/illegal name) to clear MCP errors.
3. Register `graph_create_database` with `destructiveHint: true` and a confirmation note in the description.
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
### Approach
Registers `graph_create_database` as the first write tool in the graph toolset. It delegates to `createDatabase()` from `src/graph/databases.ts` (the plan referred to it as `createUserDatabase`; the actual export is `createDatabase`), which writes the user-database file and appends the registry entry. Because the call mutates on-disk state, the handler validates the required args and requires `acknowledged === true` *before* any write — without it the tool throws a `VALIDATION_ERROR` and touches nothing. Errors raised by `createDatabase` (duplicate or illegal name) are wrapped in `BacklogToolError` with code `RESOURCE_CONFLICT`, so the clear message ("已存在" for duplicates) reaches the agent instead of being swallowed by the generic error wrapper. Validation-first ordering guarantees no partial state is written when either check fails.

### Files touched
- `src/mcp/tools/graph/schemas.ts` — added `graphCreateDatabaseSchema` (`name`, `description`, `acknowledged` all required; `additionalProperties: false`).
- `src/mcp/tools/graph/handlers.ts` — imported `createDatabase`, added the `GraphCreateDatabaseArgs` type and the `createDatabase` method (validate args + acknowledgement, delegate, map failures to `BacklogToolError`).
- `src/mcp/tools/graph/index.ts` — registered `graph_create_database` with `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false`.
- `src/test/mcp-graph.test.ts` — added 5 tests: registration; create-when-acknowledged; refuse-without-ack; duplicate-name ("已存在"); illegal-name error.

### Verification
- `bunx tsc --noEmit` — clean.
- `bun run check .` (biome) — clean.
- `bun test --timeout 30000 src/test/mcp-graph.test.ts` — 18/18 pass.
<!-- SECTION:NOTES:END -->

## Final Summary
<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the `graph_create_database` MCP tool — the first write operation in the graph toolset. It creates a user database plus its registry entry via `createDatabase()` from `src/graph/databases.ts`, annotated `destructiveHint: true` with an explicit `acknowledged: true` confirmation gate so an agent cannot create databases by accident. Duplicate or illegal names surface as clear `RESOURCE_CONFLICT` errors ("已存在" etc.) with no side effects, since validation runs before any write. Five new tests cover registration, the acknowledgement gate, successful creation, and both error paths; the full `mcp-graph` suite passes (18/18) and tsc/biome are clean.
<!-- SECTION:FINAL_SUMMARY:END -->

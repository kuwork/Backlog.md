---
id: BACK-786
title: Add graph_list_databases MCP tool
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 05:50'
updated_date: '2026-10-13 07:12'
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
ordinal: 345001
actual_start: '2026-10-13 06:50'
actual_end: '2026-10-13 07:12'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the `graph_list_databases` MCP tool: list available databases — the `default` derived graph plus every user database — with metadata such as name, kind, and size. Reuse the existing `describeDatabases()` helper. `readOnlyHint: true`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Returns `default` plus all user databases with their metadata (name, kind, size).
- [x] #2 `readOnlyHint: true`.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
1. Add `graphListDatabasesSchema` (no required args) to `schemas.ts`.
2. `GraphHandlers.listDatabases` calls `describeDatabases()` and maps the result into MCP content.
3. Register `graph_list_databases` with `readOnlyHint: true`.
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
### Approach
Reuses the existing `describeDatabases()` helper from `src/graph/browser.ts`, which lists every database via `listDatabases()` and attaches snapshot row/edge counts (`snapshotStats`) for user databases; the derived `default` graph returns `null` counts (its data lives in the graph service's memory, not a snapshot file).

### Files touched
- `src/mcp/tools/graph/schemas.ts` — added `graphListDatabasesSchema` (empty object schema, no required args, `additionalProperties: false`).
- `src/mcp/tools/graph/handlers.ts` — imported `describeDatabases`, added `GraphListDatabasesArgs` (`Record<string, never>`) and the `listDatabases` method, which returns the database summaries as JSON text.
- `src/mcp/tools/graph/index.ts` — registered `graph_list_databases` with `createSimpleValidatedTool` and `readOnlyHint: true, destructiveHint: false`.
- `src/test/mcp-graph.test.ts` — added 2 tests: registration in the tool list, and listing `default` + a created user database with correct `kind`/numeric `nodes`/`edges` metadata.

### Verification
- `bunx tsc --noEmit` — clean.
- `bunx @biomejs/biome check --write src/mcp/tools/graph/ src/test/mcp-graph.test.ts` — clean (no fixes applied).
- `bun run test src/test/mcp-graph.test.ts` — 10/10 pass (incl. the 2 new list tests).
<!-- SECTION:NOTES:END -->

## Final Summary
<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the `graph_list_databases` MCP tool, built on the shared one-shot access layer. It lists every available database — the read-only `default` derived markdown graph plus all user databases — returning each one's name, kind, and node/edge counts (reusing `describeDatabases()` from `src/graph/browser.ts`). Registered with `readOnlyHint: true`. Two new tests cover registration and the `default` + user-database shape; the full `mcp-graph` suite passes (10/10) and tsc/biome are clean.
<!-- SECTION:FINAL_SUMMARY:END -->

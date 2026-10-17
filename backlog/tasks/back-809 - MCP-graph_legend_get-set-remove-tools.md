---
id: BACK-809
title: 'MCP: graph_legend_get/set/remove tools'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-17 12:29'
updated_date: '2026-10-17 15:09'
labels:
  - docs
milestone: m-16
dependencies:
  - BACK-806
documentation:
  - backlog/docs/PRDS/cypher/doc-29 - Graph-Legend-配置持久化：项目级存储与启动恢复.md
modified_files:
  - src/mcp/tools/graph/handlers.ts
  - src/mcp/tools/graph/index.ts
  - src/mcp/tools/graph/schemas.ts
  - src/guidelines/mcp/graph.md
  - src/test/mcp-graph-legend.test.ts
ordinal: 371001
actual_start: '2026-10-17 12:28'
actual_end: '2026-10-17 13:08'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PRD: doc-29. Expose the graph legend config (backlog/databases/graph-legends.yaml) to MCP agents as three tools in the existing graph tool family, reusing the legend-store module from BACK-806 - no second storage path. MCP agents currently have no legend tool: they must shell out to the CLI or hand-edit the YAML, so the MCP usage guide legend section documents a workaround instead of the toolset.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 graph_legend_get returns the stored legend config for a database as JSON, or a clear no-config result (configured: false) when none exists - not an error
- [x] #2 graph_legend_set stores a config object for a database; a non-object payload is rejected with a clear error and leaves the store untouched
- [x] #3 graph_legend_remove deletes the entry of a database and is idempotent
- [x] #4 All three tools read/write the same backlog/databases/graph-legends.yaml through legend-store.ts - no second storage path; an MCP set is visible to the Web UI legend panel after a reload and to the CLI, and vice versa
- [x] #5 The MCP usage guide (src/guidelines/mcp/graph.md) documents the tools - arguments, annotations, and the config structure reference
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add graphLegendGet/Set/Remove schemas and handlers in src/mcp/tools/graph/ reusing loadLegendConfig/saveLegendConfig from src/graph/legend-store.ts; validate the set payload is a plain mapping before writing; register the three tools in index.ts with annotations (get read-only, set/remove writes).
2. Tests in src/test/mcp-graph-legend.test.ts mirroring the mcp-graph.test.ts harness: tool registration, get hit/miss, set + get round-trip through the YAML store, non-object payload refusal, remove + idempotency, same-file interop with the store reader.
3. Rewrite the legend section of src/guidelines/mcp/graph.md around the actual tools (tool table rows, argument examples, annotations note) and update its Key Rules bullet.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
What was done
- Added graphLegendGet/Set/Remove schemas in src/mcp/tools/graph/schemas.ts (db required on all three; config typed as an object on set) and the handlers as GraphTools methods in src/mcp/tools/graph/handlers.ts, reusing loadLegendConfig/saveLegendConfig from src/graph/legend-store.ts - the same module BACK-806's server route and the CLI use, so there is no second storage path (AC #4).
- graph_legend_get returns {database, configured, config}: a missing entry is configured: false rather than an error, so an MCP agent can ask whether a legend exists without catching exceptions (AC #1).
- graph_legend_set validates the payload with a local isPlainLegendRecord helper before writing (arrays and scalars refused with a tool error), so a non-object payload leaves the store untouched (AC #2). JSON payloads are accepted because YAML is a superset of JSON - the same tolerance the CLI set path has.
- graph_legend_remove deletes the entry via saveLegendConfig(rootDir, db, null) and reports {database, removed: true} even when nothing was stored - idempotent by design (AC #3).
- Registered all three in src/mcp/tools/graph/index.ts through createSimpleValidatedTool with annotations: graph_legend_get read-only; graph_legend_set/remove write hints (remove also idempotent).
- Rewrote the legend section of src/guidelines/mcp/graph.md around the actual tools (tool table rows, JSON request/response examples, annotations note, config structure reference); the previous manage-via-CLI workaround text was removed (AC #5).
Tests added
- New src/test/mcp-graph-legend.test.ts (10 tests): registration of all three tools, get hit/miss, set+get round-trip through the YAML store, JSON-superset acceptance, non-mapping refusal with the store untouched, remove + idempotency, interop with loadLegendConfig.
- Regression: src/test/mcp-graph.test.ts (23 tests) still green.
Verification run
- bunx tsc --noEmit: 0 errors. Biome check on touched files: clean.
Follow-up finding (recorded for the next task): backlog/databases/ is not watched by the server (unlike backlog/memos/ and backlog/milestones/), and the graph-legend-updated broadcast fires only from the server's own PUT/DELETE /api/graph/legend route. An MCP set, CLI set, or hand edit of graph-legends.yaml therefore reaches the Web UI only on page reload; a local-file watcher that broadcasts the same message is the missing piece.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added three MCP tools to the graph tool family exposing the shared legend store (backlog/databases/graph-legends.yaml from BACK-806) to MCP agents - no second storage path. graph_legend_get(db) returns {database, configured, config}; a missing entry yields configured: false, not an error (AC #1). graph_legend_set(db, config) validates the payload is a plain mapping (isPlainLegendRecord) before calling saveLegendConfig; a non-object payload is refused with a clear error and leaves the store untouched (AC #2). graph_legend_remove(db) deletes the entry via saveLegendConfig(rootDir, db, null) and is idempotent (AC #3). All three reuse loadLegendConfig/saveLegendConfig from src/graph/legend-store.ts, so an MCP set is visible to the Web UI legend panel and the CLI and vice versa (AC #4). Registered in src/mcp/tools/graph/index.ts with annotations (get read-only; set/remove writes). Covered by src/test/mcp-graph-legend.test.ts (10 tests: registration, get hit/miss, set+get round-trip through the YAML store, JSON payload accepted as a YAML superset, non-mapping refusal with the store untouched, remove + idempotency, interop with the store reader). tsc --noEmit, biome check, and the mcp-graph regression suite are green. src/guidelines/mcp/graph.md legend section rewritten around the actual tools (tool table rows, JSON request/response examples, annotations note, config structure reference); the previous workaround text was removed (AC #5).
<!-- SECTION:FINAL_SUMMARY:END -->

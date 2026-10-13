---
id: BACK-784
title: Add Graph MCP tooling foundation and graph_query tool
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 05:50'
updated_date: '2026-10-13 06:29'
labels:
  - mcp
milestone: m-14
dependencies: []
modified_files:
  - src/mcp/server.ts
  - src/mcp/tools/graph/graph-access.ts
  - src/mcp/tools/graph/handlers.ts
  - src/mcp/tools/graph/index.ts
  - src/mcp/tools/graph/schemas.ts
  - src/test/mcp-graph.test.ts
  - bunfig.toml
  - package.json
ordinal: 343001
actual_start: '2026-10-13 06:11'
actual_end: '2026-10-13 06:29'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stand up the Graph MCP tool domain so AI agents can query the Backlog.md knowledge graph through the MCP server, mirroring the CLI `graph` subcommands delivered in m-13. Create `src/mcp/tools/graph/{index.ts, handlers.ts, schemas.ts}` and register it from `src/mcp/server.ts` via `registerGraphTools`. `GraphHandlers` wires into the long-lived `GraphService` (the same instance the Web UI uses for `runCypher`), so queries run against an already-built, incrementally-synced graph — never the CLI's one-shot corpus rebuild.

This task ships the first tool, `graph_query`: given a `db` ("default" or a user-database name) and an optional Cypher statement, it returns node/edge result rows with `readOnlyHint: true`. Follow the existing `src/mcp/tools/milestones` three-file pattern and the `createSimpleValidatedTool` wrapper.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `src/mcp/tools/graph/{index,handlers,schemas}.ts` exist and `server.ts` registers `registerGraphTools`; `graph_query` is visible in the MCP tool list.
- [x] #2 `graph_query` runs a read-only Cypher statement against the `default` derived graph and returns node/edge rows.
- [x] #3 `graph_query` resolves a named user database and queries it.
- [x] #4 Read-only enforcement: write keywords (CREATE/MERGE/SET/DELETE/DROP) are rejected with a clear error, never executed.
- [x] #5 Inputs are validated by a Zod schema (`db` required, `statement` optional).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
1. Scaffold `src/mcp/tools/graph/{index.ts, handlers.ts, schemas.ts}` mirroring `src/mcp/tools/milestones`.
2. `GraphHandlers` holds the `McpServer`, resolves `projectRoot`, and lazily reuses the singleton `GraphService` from `src/graph/service.ts`.
3. Implement `graph_query`: call `GraphService.runCypher({ db, cypher })`, map the returned columns/rows into MCP content with `readOnlyHint: true`.
4. In `src/mcp/server.ts`, add the `import` and call `registerGraphTools(server)` alongside the other `registerXxxTools` calls.
5. Add unit tests: tool registration visibility, `default` query returns rows, write keyword rejected.
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
### Approach (deviation from the original plan, recorded for review)
The plan said `GraphHandlers` should "lazily reuse the singleton GraphService". I instead built the MCP graph tools on the **CLI's one-shot model** (`open → prepare → query → close` per call) via a new `src/mcp/tools/graph/graph-access.ts`. Reasons:
- The CLI's `withGraphDatabase` already does exactly this and is the reference implementation for m-13; mirroring it keeps the MCP and CLI paths behaviour-identical.
- A long-lived `GraphService` inside the MCP process would rebuild the whole corpus on startup (even when only user-DB tools are used) and risk a *second* open of the same ryu database while a write tool runs in the same process. The one-shot helpers avoid all cross-call store/lock contention.
- `default` is still reached through the same derived graph: `reconcileGraphStoreOnce(rootDir, store, graphPaths(rootDir, DEFAULT_SLOT), { reuseSnapshot: true })` reuses the snapshot the Web UI's `GraphService` wrote, so results stay consistent with the UI.

### Files
- `src/mcp/tools/graph/graph-access.ts` — `openDatabaseReadonly` (reconcile derived / hydrate user), `queryDatabase`, `withUserDatabaseWrite` (hydrate → fn → `dumpDatabase`+`saveSnapshot`+`recordSnapshot`), `isWriteStatement` guard. Adapted from `src/cli.ts` `withGraphDatabase` minus the CLI-only `process.exitCode`/`requireProjectRoot` bits.
- `src/mcp/tools/graph/{index,handlers,schemas}.ts` — three-file tool module mirroring `milestones`; `graph_query` is `readOnlyHint: true`, `destructiveHint: false`.
- `src/mcp/server.ts` — `registerGraphTools(server)` wired into **both** registration sites (`upgradeToProject` and `createMcpServer`) so it works in fallback-upgrade and normal modes.

### Verification
- `bunx tsc --noEmit` clean.
- `bun run test src/test/mcp-graph.test.ts` — 4/4 pass (registration, default query, write-keyword rejection, labels overview).

### Test config note
Graph tests load the ryu WASM backend and rebuild the derived corpus, so they exceed bun's default hook timeout. I raised `[test] timeout` to `30000` in `bunfig.toml` and set the `test` script to `bun test --timeout 30000` in `package.json`. (bun's `bunfig.toml` `[test] timeout` was not honoured by this bun version, so the script flag is the effective lever.)
<!-- SECTION:NOTES:END -->

## Final Summary
<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the Graph MCP tool domain and its first tool, `graph_query`. Created the `src/mcp/tools/graph` three-file module (`index`/`handlers`/`schemas`) plus a shared `graph-access.ts` that mirrors the CLI's one-shot `open → reconcile/hydrate → query → close` flow. `graph_query` accepts `db` (required) and an optional `statement`; it rejects write keywords (CREATE/MERGE/SET/DELETE/DROP/INSERT/UPDATE) with a clear `VALIDATION_ERROR`, returns the Cypher result set as text, and is annotated `readOnlyHint: true`. The tool is registered in `src/mcp/server.ts` at both the upgrade and normal init sites. Covered by `src/test/mcp-graph.test.ts` (4 tests, all passing); `tsc` and `biome` are clean.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-790
title: Add MCP graph usage guide mirroring the CLI graph guide
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 08:10'
updated_date: '2026-10-13 08:46'
labels:
  - mcp
milestone: m-14
dependencies:
  - BACK-789
modified_files:
  - src/guidelines/mcp/graph.md
  - src/guidelines/mcp/index.ts
  - src/guidelines/cli-instructions/index.ts
  - src/mcp/workflow-guides.ts
  - src/guidelines/mcp/overview.md
  - src/test/cli.test.ts
  - src/test/mcp-server.test.ts
ordinal: 349001
actual_start: '2026-10-13 08:18'
actual_end: '2026-10-13 08:46'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The MCP guide set (src/guidelines/mcp/) documents every tool family except graph, so an agent using the six graph MCP tools (graph_query / graph_schema / graph_list_databases / graph_describe_database / graph_create_database / graph_import_csv) has no guide to read. The CLI already ships a graph guide at src/guidelines/cli-instructions/graph.md; add the MCP counterpart, modeled on it, and wire it into the shared guide registry so it surfaces via 'backlog instructions graph' and get_backlog_instructions. The CLI guide is currently orphaned (not imported by cli-instructions/index.ts, so 'backlog instructions graph' fails with Unknown instruction guide); adding the shared graph key wires it back in as well.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A new src/guidelines/mcp/graph.md documents all six graph MCP tools, modeled on src/guidelines/cli-instructions/graph.md.
- [x] #2 The graph guide is wired into the shared registry: WORKFLOW_GUIDE_KEYS includes graph, a backlog://workflow/graph entry exists, and both MCP_GRAPH_GUIDE and CLI_GRAPH_GUIDE are exported and mapped.
- [x] #3 backlog instructions graph prints the guide (no longer Unknown instruction guide) and backlog instructions --list includes graph.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/guidelines/mcp/graph.md: an MCP-oriented guide for the six graph tools, modeled on src/guidelines/cli-instructions/graph.md and structured like src/guidelines/mcp/documents.md (tool table, JSON arguments, read-only vs destructive annotations, default vs user database, CSV import).
2. Export MCP_GRAPH_GUIDE from src/guidelines/mcp/index.ts and CLI_GRAPH_GUIDE from src/guidelines/cli-instructions/index.ts (the latter wires the previously orphaned graph.md).
3. Register the shared key in src/mcp/workflow-guides.ts: add "graph" to WORKFLOW_GUIDE_KEYS, add the backlog://workflow/graph WORKFLOW_GUIDES entry, and map graph -> CLI_GRAPH_GUIDE in CLI_INSTRUCTION_TEXT_BY_KEY. This single key makes the guide reachable from both MCP (get_backlog_instructions / backlog://workflow/graph) and the CLI (backlog instructions graph).
4. Register the guide in the MCP overview listing (src/guidelines/mcp/overview.md).
5. Update the enumerating tests: src/test/mcp-server.test.ts (instruction enum + the three resource-URI lists) and src/test/cli.test.ts (instructions --list, the instructions help line, and a new assertion that `backlog instructions graph` prints the guide).
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
Wiring follows the documents guide pattern. The guide key is shared, so adding "graph" to WORKFLOW_GUIDE_KEYS is enough to surface it in the MCP instruction enum, the MCP resource list (backlog://workflow/graph), the CLI guide index, and `backlog instructions graph`. CLI_INSTRUCTION_TEXT_BY_KEY is a Record<WorkflowGuideKey, string>, so the CLI_GRAPH_GUIDE mapping is type-enforced the moment the key is added.

Side effect: the CLI graph guide (src/guidelines/cli-instructions/graph.md) was orphaned - it existed but was never imported by cli-instructions/index.ts, so `backlog instructions graph` failed with "Unknown instruction guide: graph". Exporting CLI_GRAPH_GUIDE and adding the shared key wires it back in.

Files touched: src/guidelines/mcp/graph.md (new), src/guidelines/mcp/index.ts, src/guidelines/cli-instructions/index.ts, src/mcp/workflow-guides.ts, src/guidelines/mcp/overview.md, src/test/mcp-server.test.ts, src/test/cli.test.ts.

A stale assertion in src/test/mcp-server.test.ts predated this task: the full tool list in "createMcpServer wires stdio-ready instance" was never updated when BACK-784..789 registered the six graph tools, so the suite had been red since BACK-784. Corrected here (the graph tools are added in registration order).
<!-- SECTION:NOTES:END -->

## Final Summary
<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added an MCP graph guide and wired it into the shared workflow-guide registry, mirroring the existing documents guide.

Changes:
- New src/guidelines/mcp/graph.md covering the six graph tools (graph_query / graph_schema / graph_list_databases / graph_describe_database / graph_create_database / graph_import_csv): tool table, JSON arguments, read-only vs destructive annotations, default vs user database, Cypher query patterns, and CSV import as nodes/edges.
- Exported MCP_GRAPH_GUIDE and CLI_GRAPH_GUIDE; added "graph" to WORKFLOW_GUIDE_KEYS, added the backlog://workflow/graph WORKFLOW_GUIDES entry, and mapped graph -> CLI_GRAPH_GUIDE. The key is shared, so this also un-orphans the pre-existing CLI guide at src/guidelines/cli-instructions/graph.md, making `backlog instructions graph` work again.
- Registered the guide in the MCP overview listing (src/guidelines/mcp/overview.md).
- Fixed the stale tool-list assertion in src/test/mcp-server.test.ts (missing the six graph tools since BACK-784) and updated the enumerating tests in src/test/cli.test.ts.

Verification:
- bunx tsc --noEmit clean; biome check clean on the touched files.
- src/test/mcp-server.test.ts: 12 pass / 0 fail.
- src/test/cli.test.ts: the two graph-affected tests pass in isolation ("lists available instruction guides", "prints selected instruction guides" with the new graph assertions).
- Direct CLI: `backlog instructions --list` includes graph; `backlog instructions graph` prints the guide (previously "Unknown instruction guide: graph").

Known pre-existing issue (not from this task): running the whole "backlog instructions command" describe block together trips a test-isolation problem - the task-prefix test leaks its config into the next test - producing 2 failures. The same 2 failures reproduce on a clean tree with this task's changes stashed, so they are environmental, not caused here.
<!-- SECTION:FINAL_SUMMARY:END -->

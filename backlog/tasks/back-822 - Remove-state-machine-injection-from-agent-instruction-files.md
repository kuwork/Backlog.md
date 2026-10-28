---
id: BACK-822
title: Remove state machine injection from agent instruction files
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-28 02:45'
labels:
  - cli
dependencies: []
modified_files:
  - src/agent-instructions.ts
  - src/core/init.ts
  - src/cli.ts
  - src/server/index.ts
  - src/index.ts
  - src/test/agent-instructions.test.ts
  - src/test/server-statuses-endpoint.test.ts
  - src/guidelines/cli-agent-nudge.md
  - AGENTS.md
ordinal: 384001
actual_start: '2026-10-28 01:50'
actual_end: '2026-10-28 02:35'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The project state machine already lives in config.yml as the single source of truth, and the CLI agent nudge already tells agents to read it on demand via `backlog instructions overview`. `backlog init` (and two other entry points) were nevertheless copying the rendered machine into AGENTS.md/CLAUDE.md/GEMINI.md as a `state-machine` marker block, which duplicated config data and required a server-side refresh to avoid drift. This change stops all three entry points from writing the block, removes the now-dead injection helpers, and makes `backlog init` / `backlog agents --update-instructions` strip any legacy block left by older versions. It also brings the agent guide list in AGENTS.md (and its source cli-agent-nudge.md) up to date with overview.md by adding the `decisions`, `graph`, and `memos` guides that were missing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No code path writes a `state-machine` marker block to agent instruction files: init, agents --update-instructions, and the server statuses endpoint are all removed.
- [x] #2 Dead helpers removed: applyStateMachineSection, hasStateMachineGuidelines, refreshStateMachineInAgentInstructions, and the addAgentInstructions stateMachineSection parameter.
- [x] #3 Existing agent instruction files, including this repos AGENTS.md, no longer contain a state-machine block.
- [x] #4 The agent guide list in AGENTS.md and cli-agent-nudge.md matches overview.md (adds decisions, graph, memos).
- [x] #5 renderProjectStateMachine is retained (MCP resource still renders the machine on demand) and its tests pass.
- [x] #6 bunx tsc --noEmit, bun run check ., and the affected tests all pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/agent-instructions.ts: drop the stateMachineSection parameter from addAgentInstructions and the three applyStateMachineSection calls; instead strip any legacy `state-machine` block via stripGuidelineSection; delete applyStateMachineSection, hasStateMachineGuidelines, and refreshStateMachineInAgentInstructions.
2. src/core/init.ts: remove the renderProjectStateMachine import and the 5th argument.
3. src/cli.ts: remove the import and the 5th argument from agents --update-instructions.
4. src/server/index.ts: remove the renderProjectStateMachine import, the refreshInjectedStateMachine method and its call, and the refreshStateMachineInAgentInstructions import.
5. src/index.ts: drop the refreshStateMachineInAgentInstructions export.
6. Tests: remove the injected-state-machine describe block and the unused import from agent-instructions.test.ts; remove the stale server-statuses-endpoint refresh test; drop unused imports.
7. Docs: add decisions/graph/memos to cli-agent-nudge.md and strip the legacy state-machine block from this repos AGENTS.md; resync the AGENTS.md guide list with the source.
8. Validate: tsc, biome check --write, bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope confirmed with the user: full removal across all three entry points plus dead-code cleanup and stripping legacy blocks in already-initialized repos, rather than only patching init. The MCP path (renderProjectStateMachine) is intentionally kept because `backlog instructions` and the MCP resource render the machine on demand; only the file-write mirror is gone. AGENTS.md on disk was older than its source cli-agent-nudge.md (missing graph and memos too), so the guide list was fully resynced. A pre-existing, unrelated test failure remains in mcp-server.test.ts:326 (the expected MCP tools list omits memo_create/update/delete that the server registers in src/mcp/tools/memos/index.ts); it is not touched by this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Agent instruction files no longer carry a duplicated copy of the project state machine. All three write paths (init, agents --update-instructions, server statuses save) were removed along with the dead injection helpers, and init/agents-update now strip legacy blocks from already-initialized repos. The agent guide list in AGENTS.md and its source cli-agent-nudge.md now matches overview.md (decisions, graph, memos added). tsc, biome, and the affected tests pass. The pre-existing mcp-server.test.ts:326 failure is unrelated.
<!-- SECTION:FINAL_SUMMARY:END -->

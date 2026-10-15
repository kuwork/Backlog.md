---
id: BACK-799
title: >-
  Refine agent guidelines: SQL query block guidance, finalization completeness,
  and state machine relocation
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-15 14:14'
updated_date: '2026-10-15 16:02'
labels: []
dependencies: []
modified_files:
  - src/guidelines/cli-agent-nudge.md
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/cli-instructions/task-finalization.md
  - src/guidelines/mcp/documents.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/task-creation.md
  - src/guidelines/mcp/task-execution.md
  - src/guidelines/mcp/task-finalization.md
  - src/commands/instructions.ts
  - src/mcp/tools/workflow/index.ts
  - src/mcp/resources/workflow/index.ts
  - src/test/state-machine-guidance.test.ts
  - src/test/mcp-server.test.ts
  - README.md
  - README.en.md
ordinal: 361001
actual_start: '2026-10-15 13:19'
actual_end: '2026-10-15 14:43'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
As features shipped, the shipped agent guidelines (both the CLI instructions and the MCP set) drifted out of sync with actual capabilities, so agents following them either miss existing features or wade through content they do not need:

- The cli-agent-nudge guide index lacks the graph and memos entries, so agents never learn those guides exist
- The documents guide never teaches agents to write sqlite-query / duckdb-query live query blocks (syntax, data sources, fail-closed path and read-only rules, copy_to output, DuckDB type rendering), so the SQL capability is effectively undiscoverable
- task-finalization requires neither recording modified files nor reconciling the implementation plan, so closed tasks diverge from what was actually delivered
- The full state machine detail (format reference, transition / ai / evidence rules, the live rendered machine) sits in the overview, forcing agents that only create tasks to read execution-time material

Goal: match each guide's responsibility and information density to its stage of use (nudge, overview, creation / execution / finalization / documents), and keep the CLI and MCP sets consistent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The nudge and overview guide indexes cover every guide including graph, memos, and documents
- [x] #2 The documents guides (CLI+MCP) document the SQL query block syntax, safety rules, and a copy_to write-out example
- [x] #3 task-finalization requires recording modified files and reconciling the implementation plan
- [x] #4 State machine detail renders only in task-execution; the overview keeps a pointer and creation only needs defaultStatus
- [x] #5 Related tests (state-machine-guidance / mcp-server / agent-instructions / cli-agents) are green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Align the guide indexes: add graph / memos entries to cli-agent-nudge and the overview's Detailed Guides, and sync the documents entry description
2. Add a Live SQL Query Blocks section to the documents guides (CLI+MCP): sqlite-query as the main example, duckdb-query for CSV/XLSX, plus a copy_to write-out example; add SQL block and rich-link pointers to the intro
3. Add a brief wiki / graph / live data collection paragraph to the overview intro
4. Add a modified-files recording step and DoD checklist item to task-finalization (CLI+MCP); add the missing implementation-plan reconciliation step to the CLI version, aligning it with MCP
5. Move the state machine section from the overview into task-execution (four files across CLI+MCP), leave a pointer in the overview, add a defaultStatus note to task-creation, and rewrite execution's old overview references
6. Update code comments (instructions.ts, MCP workflow tool/resource) and tests (state-machine-guidance, mcp-server)
7. Verify: tsc, Biome, the related test files, and end-to-end rendering via the instructions command
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Key decisions:
- Moving the state machine required no renderer changes: composeGuideText substitutes {{STATE_MACHINE}} for every guide (src/commands/instructions.ts, the MCP workflow tool/resource), so the placeholder took effect as soon as it moved into task-execution
- The overview's Start Every Request Here section stayed put: it is the session bootstrap for all operations, not creation-specific; task-creation already has its own Search First step
- SQL examples in the documents guides are split by engine on purpose: plain SQL uses sqlite-query, CSV/Excel always uses duckdb-query, and source matches the file the SQL reads (demonstrating source as the security anchor)
- The CLI documents guide warns that blocks contain backticks and must not go through --content/--append-content (use the complex-content workflow: create, then write the file); the MCP guide needs no such warning (JSON arguments have no shell escaping layer)

Validation results:
- bunx tsc --noEmit passes; bun run check reports no new issues
- 58 tests green across state-machine-guidance / mcp-server / agent-instructions / cli-agents
- End to end: bun run cli instructions task-execution renders the live machine; instructions overview shows only the pointer
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kimi
created: 2026-10-15 14:49
---
记录一次越边移动：本任务从 To Do 直接移到 Done，未沿状态机声明的边（合规路径为 To Do → Planning → Plan Review → In Progress → In Review → Done）。由用户明确指示并验收，保持现状；机器本身无需修改。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the agent-guideline prompt refinement:

Changes:
- Added the missing graph/memos entries to the nudge; the overview intro now summarizes wiki / graph / live data collection
- The documents guides (CLI+MCP) gained a Live SQL Query Blocks section with a copy_to write-out example, plus SQL block and rich-link pointers in the intro
- task-finalization now requires recording modified files; the CLI version gained the plan-reconciliation step
- The state machine section moved from the overview into task-execution (CLI+MCP); the overview keeps a pointer and creation only needs defaultStatus

Verification:
- bunx tsc --noEmit passes
- 58 tests green across state-machine-guidance / mcp-server / agent-instructions / cli-agents
- bun run cli instructions task-execution renders the live machine end to end; the overview no longer renders it
<!-- SECTION:FINAL_SUMMARY:END -->

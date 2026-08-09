---
id: BACK-551
title: Support unassigned task filtering in CLI and MCP
status: Done
assignee:
  - '@kimi'
created_date: '2026-04-25 12:14'
updated_date: '2026-08-09 06:53'
labels:
  - cli
  - mcp
dependencies: []
actual_end: '2026-08-09 06:22'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide a way to list tasks that have no assignee, in both the CLI (backlog task list) and the MCP task_list tool. The filter must distinguish truly unassigned tasks from a real assignee value, be implemented once in the shared task-filtering path, and be documented in help text, MCP schema, and instruction guides.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.47.1..v1.48.0 --grep BACK-427 and git show 35220fd as implementation reference.
- [x] #2 CLI task list gains --unassigned to list tasks with no non-blank assignee, mutually exclusive with --assignee (clear exit-1 error), working with --plain, interactive view, and alongside other filters.
- [x] #3 MCP task_list exposes an unassigned boolean filter without overloading a real assignee value; combining it with assignee is rejected with a validation error; the Draft status path applies the filter too.
- [x] #4 Core TaskListFilter.unassigned is implemented once in applyTaskFilters shared by plain-list and search paths; a task counts as unassigned when it has no non-blank assignee entry.
- [x] #5 Help text, MCP schema description, and tests (cli.test.ts, mcp-tasks.test.ts) cover the new filter; instruction guides mention it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add unassigned?: boolean to TaskListFilter in src/types/index.ts
2. Implement the filter once in Core.applyTaskFilters in src/core/backlog.ts so both the plain-list and search paths of queryTasks share it (covers CLI plain, CLI interactive, MCP); a task counts as unassigned when it has no non-blank assignee entry
3. CLI (src/cli.ts): add --unassigned flag to task list, mutually exclusive with --assignee (clear exit-1 error), update help schema and interactive filter view
4. MCP (src/mcp/tools/tasks/): add unassigned boolean to taskListSchema with description, validate assignee+unassigned conflict in TaskHandlers.listTasks, support draft status path, clarify task_list tool description
5. Tests: src/test/cli.test.ts (--unassigned filtering + conflict error), src/test/mcp-tasks.test.ts (unassigned filtering incl. drafts + conflict rejection); update instruction guides (src/guidelines/cli-instructions/task-creation.md, src/guidelines/mcp/overview.md)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented unassigned task filtering. TaskListFilter.unassigned (src/types/index.ts) flows through Core.applyTaskFilters (src/core/backlog.ts), shared by plain, interactive, and search paths; a task counts as unassigned when no non-blank assignee entry exists. CLI: --unassigned flag on task list, mutually exclusive with --assignee (exit 1 with clear error), wired into baseFilters, active-filter display, and interactive loader. MCP: task_list accepts unassigned boolean (schema + description), rejects combining with assignee via BacklogToolError VALIDATION_ERROR, applies filter in both normal and Draft paths; tool description updated. Guidelines updated: cli-instructions/task-creation.md, cli-instructions/task-execution.md, mcp/overview.md (both task_list mentions), mcp/task-creation.md, agent-guidelines.md (CLI ops table). Tests: 2 cli + 2 mcp unassigned tests added, all pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added unassigned task filtering to CLI and MCP. TaskListFilter.unassigned is implemented once in Core.applyTaskFilters (shared by plain-list, interactive, and search paths); a task counts as unassigned when it has no non-blank assignee entry. CLI task list gained --unassigned, mutually exclusive with --assignee (exit 1 with --unassigned cannot be combined with --assignee), working with --plain, interactive view, and other filters. MCP task_list accepts unassigned: true (boolean schema with description), rejects combining it with assignee (VALIDATION_ERROR), and applies the filter in the Draft status path too; tool description now enumerates filters. Guidelines updated: cli-instructions/task-creation.md, cli-instructions/task-execution.md, mcp/overview.md (both task_list mentions), mcp/task-creation.md, and agent-guidelines.md (CLI operations table). Added 4 tests (2 cli, 2 mcp); verified tsc clean, biome clean, 115 pass/2 fail with both failures reproduced pre-existing on the base branch (doc-update path test, limit-regroup test).
<!-- SECTION:FINAL_SUMMARY:END -->

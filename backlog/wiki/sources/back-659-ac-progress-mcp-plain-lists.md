---
title: BACK-659 Show acceptance criteria progress in MCP and plain task lists
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - mcp
  - acceptance-criteria
  - upstream-migration
source_path: backlog/tasks/back-659 - Show-acceptance-criteria-progress-in-MCP-and-plain-task-lists.md
---

# BACK-659 Show acceptance criteria progress in MCP and plain task lists

`task list --json` already published per-task acceptance criteria progress and the TUI and web UI rendered it, but two list surfaces still hid it: the MCP `task_list` summary lines and `task list --plain`. Both build rows inline instead of through a shared formatter, so the same progress had to be added at each call site.

## Summary

- New shared helper `formatAcceptanceCriteriaSummarySuffix(task)` in `src/ui/acceptance-criteria-progress.ts` returns ` (ac: checked/total)` when the task has criteria, empty string otherwise; counts come from `task.acceptanceCriteriaItems`, the same source the JSON formatter reads
- Deliberately no status gate: a list reports progress for any task that has criteria, unlike the TUI progress bar which only renders while a task is In Progress
- MCP: suffix appended in `formatTaskSummaryLine` (`src/mcp/tools/tasks/handlers.ts`) after the status text; CLI plain list: both inline row builders in `runTaskList` wired (`--sort priority` branch and status-grouped branch), suffix following the status indicator where one prints
- Out of scope and untouched: the JSON path (already publishes the counts), `formatTaskPlainText`, task detail output, and plain search results (own `[PRIORITY]` + score shape)
- No shipped guide documents the plain list row layout, so the row shape is not part of any documented contract and guides needed no edit
- Tests: new `src/test/cli-task-list.test.ts` (this fork never had it) plus an MCP case — checked, unchecked, and absent criteria; all three red first against unmodified code; real-repo smoke showed 339 rows with the suffix and no `(ac: 0/0)`

## Acceptance Criteria

- MCP `task_list` summary lines carry checked/total progress for every task that has criteria
- `task list --plain` carries the same progress in both row builders; tasks without criteria render exactly as before
- The suffix is status-independent (unlike the TUI progress bar)
- `task list --json` output is unchanged
- Automated tests cover both surfaces with checked, unchecked, and absent criteria

## Related Concepts

- [[concepts/mcp-server]] — MCP `task_list` summary line gained the suffix
- [[concepts/cli-tui]] — plain list surface closed the last gap with JSON/TUI/web
- [[concepts/upstream-migration]] — ports upstream BACK-642 (5d727d61b)

## Related Sources

- [[sources/back-625-ac-progress-json-output]] — the JSON publication this task aligns the remaining surfaces with
- [[sources/back-569-acceptance-criteria-progress-ui]] — the TUI progress bar whose status gate was deliberately not copied

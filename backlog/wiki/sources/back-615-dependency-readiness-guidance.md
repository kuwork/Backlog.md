---
title: BACK-615 Add dependency readiness guidance to TUI and browser
created_date: '2026-09-07 05:57'
updated_date: '2026-09-07 05:57'
labels:
  - source
  - cli
  - tui
  - web-ui
  - mcp
source_path: backlog/tasks/back-615 - Add-dependency-readiness-guidance-to-TUI-and-browser.md
---

# BACK-615 Add dependency readiness guidance to TUI and browser

Answers "what can I pick up now" without silently restoring the abandoned derived-sequence model: a shared readiness verdict (fail-closed — any unfinished or unresolvable dependency blocks) surfaced on five paths. Started as a takeover of contributor PR #814 (David Cottrell), heavily adapted for correctness and performance, then hardened across three Codex review rounds.

## Summary

- `src/utils/readiness.ts` (new, pure-function core): `createReadinessGraph` / `getTaskReadiness` / `formatReadinessBlockers` / `loadReadinessGraph`; blockingDependencies = resolved-but-unfinished, missingDependencies = unresolvable, both fail closed; duplicate canonical identities resolve first-wins-then-fail-closed (ambiguous identity rule); completed-corpus *location* is completion evidence regardless of the status string; `statuses: []` config falls back to DEFAULT_STATUSES inside createReadinessGraph
- CLI: `task list --ready` on plain/json/interactive paths; the interactive loader returns the unfiltered corpus as readinessTasks so verdicts don't depend on display filters; `applyTaskFilters` takes `ready?: ReadinessGraph` (graph required, built once per filter pass — not per candidate)
- TUI: Readiness line in the detail pane (✓ Ready to start / ● Blocked by <ID>, single-width glyphs — the hourglass is East Asian Wide and blessed miscounts it) rendered only for tasks with dependencies; `listCompletedTasks()` loaded in parallel (112ms vs 6.6s for `loadTasks({includeCompleted:true})`); C/A shortcuts maintain the graph
- Web: readiness badge in TaskDetailsModal Dependencies card; unresolved dependency IDs resolved via GET /api/task/:id (which reads completed tasks) so browser/CLI/TUI agree without shipping the completed corpus; badge follows the optimistic inline status
- MCP: `task_list` gains `ready: true` argument (schema + guidelines), no new tools
- Removed upstream's `TaskListFilter.ready` (Core.applyTaskFilters never handled it — a silently no-op filter field) and the fullGraphTasks plumbing; dependency identity keyed on canonicalTaskId, not raw lowercase string equality
- Follow-ups deferred to BACK-601: draft-on-draft deps in browser, readiness filter dropping on board tab, cross-branch terminal deps

## Acceptance Criteria

- Ready/blocked semantics defined for partial graphs, cycles, missing dependencies, and cross-status dependencies
- TUI and browser present consistent, non-mutating readiness guidance
- Existing ordinal order remains authoritative
- Cycles and ambiguous dependency data represented honestly and fail safely
- Users can identify which dependencies block a task

## Related Concepts

- [[concepts/task-lifecycle]] — readiness verdicts keyed on terminal-status and completed-corpus location
- [[concepts/cli-tui]] — TUI detail-pane Readiness line and shortcut graph maintenance
- [[concepts/mcp-workflow]] — task_list ready argument carried by the existing tool and schema
- [[concepts/core-architecture]] — ContentStore-warm loadReadinessGraph via queryTasks

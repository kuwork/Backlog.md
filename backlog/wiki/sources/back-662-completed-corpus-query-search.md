---
title: BACK-662 Add completed-corpus option to queryTasks and SearchService
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - core
  - cli
  - mcp
  - web-ui
  - completed-corpus
source_path: backlog/tasks/back-662 - Add-completed-corpus-option-to-queryTasks-and-SearchService.md
---

# BACK-662 Add completed-corpus option to queryTasks and SearchService

`queryTasks` and the SearchService corpus excluded `backlog/completed/` tasks, so CLI search, MCP list/search, and web search all missed completed work while single-task reads reached it. This task adds an opt-in `includeCompleted` flag that widens the task source corpus only — filtering, ranking, formatting, and limits run through the exact same pipeline, and default behaviour is unchanged everywhere.

## Summary

- `SearchOptions.includeCompleted` (types) → `ContentStore.getTasks(filter, options)` sources from `taskIdentityIndex.getTasks(true)` when set (the index already tags `source: "completed"`), with a manual merge fallback; `TaskQueryOptions.includeCompleted` threads through Core's cross-branch and local paths with canonical-id dedupe, active wins
- `SearchService`: `TaskSearchEntity` gains `isCompleted`; `applySnapshot` indexes `ContentSnapshot.taskCorpus` completed entries alongside active tasks; `search()`/`collectWithoutQuery` skip completed entities unless opted in, before the limit check so default output stays byte-identical
- Consumers: CLI `task list --completed` and `search --completed`; MCP `list_tasks`/`search_tasks` boolean `completed` parameter with schema-description updates; `/api/search?completed=true` passthrough
- Behaviour change: MCP `task_search` previously ALWAYS widened the corpus with completed tasks; it now reads active-only unless `completed: true` is passed, aligning with every other surface
- Contract: `TaskSummaryJson` gains a nullable `source` field (`null` on active-only reads, `"completed"` on widened rows) so consumers can route or render completed results differently
- Scope extension (user directive): the web search dialog gained a completed-corpus toggle sending `completed=true`, completed rows carry a Completed badge, and clicking one opens the task modal via a `preloadedTask` navigation payload; badge polish reused localized priority/decision-status labels instead of raw enum values
- Guidelines updated with filtered-scenario examples only (verify-guide-examples passes); live probe: default 349 tasks vs 653 with the flag, completed rows tagged; revert-verified red at both SearchService and CLI layers

## Acceptance Criteria

- `queryTasks` and SearchService accept an opt-in option (default off) merging completed tasks; default calls return exactly the active-only corpus
- CLI `--completed` and MCP `completed` parameters include completed tasks; schema descriptions document them
- Completed tasks are distinguishable in merged results (`source: "completed"`)
- `/api/search` accepts `completed=true`; the web board composition is unchanged and the search dialog sends the parameter only when the toggle is on
- Guide examples land on filtered scenarios, never a bare list-all

## Related Concepts

- [[concepts/search-sequences]] — SearchService corpus and ranking the flag widens
- [[concepts/json-output]] — `TaskSummaryJson` gained the nullable `source` field
- [[concepts/mcp-server]] — MCP contract gained the `completed` parameter
- [[concepts/task-lifecycle]] — completed archive as a queryable corpus

## Related Sources

- [[sources/back-663-completed-popup-read-only]] — renders the completed records this task surfaces
- [[sources/back-664-dependency-input-completed-predecessors]] — reuses the `/api/search?completed=true` flag for dependency suggestions
- [[sources/back-567-cross-branch-task-identity]] — identity-index corpus machinery the merge builds on

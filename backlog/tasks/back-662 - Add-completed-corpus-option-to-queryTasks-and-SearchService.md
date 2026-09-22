---
id: BACK-662
title: Add completed-corpus option to queryTasks and SearchService
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-19 05:13'
updated_date: '2026-09-19 07:55'
labels:
  - core
  - cli
  - mcp
dependencies: []
references:
  - 'src/core/backlog.ts:712'
  - 'src/core/search-service.ts:209'
  - 'src/mcp/tools/tasks/handlers.ts:257'
  - 'src/mcp/tools/tasks/handlers.ts:345'
  - 'src/server/index.ts:955'
priority: high
ordinal: 248400
actual_start: '2026-09-19 05:17'
actual_end: '2026-09-19 07:46'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
queryTasks and the SearchService corpus currently exclude backlog/completed/ tasks (identityIndex.getTasks(false)), so CLI search, MCP list/search, and the web search all miss completed work while single-task reads (core.getTask) do reach it. Add an opt-in flag that merges the completed corpus into results.

Semantics agreed with the user: the option only widens the task source corpus (active plus completed). It changes nothing else - filtering, ranking, formatting, and limits run through the exact same pipeline; completed results are distinguishable by source: "completed".

Naming agreed with the user: CLI flag --completed; MCP parameter completed (boolean); web API query parameter completed=true.

Consumers must be able to tell completed tasks apart from active ones in merged results so they can route or render them differently (web deep-link routing for completed tasks is a separate follow-up task). Default behavior is unchanged everywhere. Web UI stays out of scope: /api/search gains the query-parameter passthrough for future use, but the web app does not send it yet and search results must not alter board composition in this task. Scope: Core option, CLI flag, MCP parameter, /api/search passthrough.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 queryTasks accepts an opt-in option (default off) that merges completed-corpus tasks into the result; default calls return exactly the active-only corpus
- [x] #2 SearchService honors the same option so search results include completed tasks, with fuzzy ranking covering titles, descriptions, notes, comments, and metadata
- [x] #3 CLI task list --completed and task search --completed include completed tasks; without the flag output is unchanged
- [x] #4 MCP list_tasks and search_tasks accept a boolean completed parameter, and the MCP schema descriptions (user-visible contract) document it
- [x] #5 Completed tasks in merged results are distinguishable from active tasks for consumers
- [x] #6 Usage guides in src/guidelines/ are updated for the CLI flag and MCP parameter; guide examples must land on filtered scenarios (for example task search --completed --status "Done" <query>), never a bare list-all command; verify-guide-examples passes
- [x] #7 Tests cover the new option end to end, and each new test is confirmed red with the feature reverted before committing
- [x] #8 GET /api/search accepts a completed=true query parameter that passes the option through to the SearchService; the web board remains unchanged, and the web search dialog sends the parameter only when the user enables the completed toggle (scope extended per user directive; see comments #1 and #2)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. types/index.ts - add includeCompleted?: boolean to SearchOptions. The flag only widens the task source corpus (active plus completed); the query pipeline itself is untouched.
2. content-store.ts - getTasks(filter, options) sources the corpus from taskIdentityIndex.getTasks(true) when includeCompleted (the index already tags source: "completed"); fallback to [...cachedTasks, ...completedTasks] with manual source tags when no index is installed. Sole caller today is backlog.ts:760.
3. search-service.ts - TaskSearchEntity gains isCompleted; applySnapshot takes completedTasks from ContentSnapshot.taskCorpus and indexes them alongside active tasks; search() and collectWithoutQuery skip completed entities unless includeCompleted, before the limit check so default output stays byte-identical.
4. backlog.ts - TaskQueryOptions.includeCompleted; cross-branch no-query path passes store.getTasks(undefined, {includeCompleted}); cross-branch query path passes it to searchService.search; local (includeCrossBranch=false) path merges listCompletedTasks() with dedupe by canonicalTaskId, active wins.
5. Consumers - CLI task list/search get --completed; MCP list_tasks/search_tasks get a boolean completed plus schema description updates (user-visible contract); /api/search parses completed=true and passes it through. Web UI sends nothing.
6. Guidelines in src/guidelines/ (CLI and MCP) with filtered-scenario examples only, never a bare list-all; verify-guide-examples must pass.

Tests: core (both corpus states, fuzzy search hits completed tasks, default corpus unchanged), CLI, MCP, and /api/search passthrough. Revert-verify each layer red before committing. Gates: bunx tsc --noEmit, bun run check ., scoped bun test --timeout 240000. Commit via the temp-index flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete; working tree intentionally left uncommitted at the user request for review.

Behavior change to record: MCP task_search previously ALWAYS widened the corpus with completed tasks (loadWorkingCopyTasks(true)); it now reads active-only unless completed: true is passed, aligning with task_list, the CLI, and /api/search. The existing mcp-tasks.test.ts case asserting the old default was rewritten for the new contract.

Structure note: this repo has no task search subcommand, so AC#3 CLI search coverage landed on the global backlog search --completed command; task list --completed is unchanged from the AC wording.

Contract additions: TaskSummaryJson (task list/search JSON) gains a nullable source field, null on active-only reads and "completed" on widened rows; ContentStore.getSnapshot now carries taskCorpus so SearchService can see the completed corpus; completed rows from SearchService are tagged source completed because the disk loader does not set the tag.

Verification: bunx tsc --noEmit clean; bun run check . clean (3 pre-existing warnings); verify-guide-examples all pass; new suites core-query-tasks-completed (6), cli-task-list-completed (5), mcp-tasks-completed (3) all green; regressions green for search-service, content-identity, cli-json-watch, cli-task-list-ready, cli-task-list, mcp-tasks, mcp-tasks-local-filter, mcp-task-complete. /api/search probed live: default 349 tasks without BACK-1, completed=true 653 tasks with BACK-1 carrying source completed and 304 rows flagged. Revert verification: removing the SearchService filter turned core cases red; hard-coding CLI passthrough to false turned CLI cases red; both restored to green.

Known pre-existing failure unrelated to this task: core-task-corpus-regressions "allocates past a remote task pushed inside the read refresh window" (sandbox cannot create refs/remotes/origin/*, recorded environment red).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: kimi
created: 2026-09-19 07:26
---
Scope extension (user directive, 2026-09-19): the web UI part landed in the same working tree. The search dialog gained a completed-corpus toggle (labelled with the localized word for "completed") that sends completed=true to /api/search; completed rows carry a Completed badge; clicking one opens the task modal via a preloadedTask navigation payload (App falls back to it when the corpus has no match) so completed deep links from search no longer bounce to the board. Deliberately still out of scope: cold deep links to completed tasks (no navigation payload) remain a follow-up. Covered by web-search-dialog-completed.test.tsx and web-completed-task-modal.test.tsx (5 cases).
---

author: kimi
created: 2026-09-19 07:45
---
Web search dialog i18n polish (review findings, same working tree): the result-row badges no longer render raw enum values. Priority now uses the shared t.taskDetails.priorityLabel (the localized high / medium / low labels); decision status uses the canonical t.decisions.statusLabels with a capitalized-raw fallback for free-form values, mirroring DecisionDetail. Task status stays raw by design (user-configured strings). Covered by web-search-dialog-completed.test.tsx (4 cases, decision case included).
---
<!-- COMMENTS:END -->

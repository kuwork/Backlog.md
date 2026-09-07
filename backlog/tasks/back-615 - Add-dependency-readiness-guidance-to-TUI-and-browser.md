---
id: BACK-615
title: Add dependency readiness guidance to TUI and browser
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-13 16:06'
updated_date: '2026-09-07 05:57'
labels: []
dependencies: []
modified_files:
  - src/utils/readiness.ts
  - src/utils/task-search.ts
  - src/cli.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/unified-view.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/mcp/tools/tasks/schemas.ts
  - src/guidelines/mcp/overview.md
  - src/web/components/TaskDetailsModal.tsx
  - src/test/readiness.test.tsx
  - src/test/cli-task-list-ready.test.ts
  - src/test/tui-ready-filter-pty.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/unified-view-filters.test.ts
  - src/test/unified-view-loading.test.ts
  - scripts/run-tui-interactive-tests.sh
  - .github/workflows/ci.yml
actual_start: '2026-09-07 03:14'
actual_end: '2026-09-07 03:48'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Address the reported need to see what can be worked next without silently restoring the abandoned derived-sequence model or changing ordinal ordering by default.

Usage scenarios:
- Answer "what can I pick up now": backlog task list --ready (combines with --status/--assignee/--json). The verdict is fail-closed: any unfinished or unresolvable dependency excludes the task.
- TUI: the task list detail pane shows a Readiness line (✓ Ready to start / ● Blocked by <ID>), rendered only for tasks that have dependencies.
- Web: a readiness badge inside the task modal's Dependencies card; dependencies completed and filed into backlog/completed are recognized identically to CLI/TUI.
- MCP/AI agents: the existing task_list tool gains a ready: true argument; no new tools.
Guide: --ready usage is documented in src/guidelines/cli-instructions/overview.md (backlog instructions overview).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Plan review defines ready and blocked semantics for partial graphs, cycles, missing dependencies, and dependencies in other statuses
- [x] #2 The TUI and browser present consistent, non-mutating readiness and blocked guidance
- [x] #3 Existing ordinal order remains authoritative unless Alex explicitly approves an ordering change
- [x] #4 Cycles and ambiguous dependency data are represented honestly and fail safely
- [x] #5 Users can identify which dependencies block a task
- [x] #6 Automated tests and rendered QA cover ready, blocked, cross-status, missing, and cyclic examples
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract the upstream 646d9bb (BACK-546) reference diff and compare it file by file against the fork's current state
2. Add src/utils/readiness.ts (pure-function core; adapt the task-id.ts import to the fork's utils/task-path.ts)
3. CLI: task list --ready option + loadReadinessGraph filtering (plain/json/interactive)
4. TUI: task-viewer-with-search.ts loads listCompletedTasks in parallel + Readiness line in the detail pane (single-width glyphs); unified-view readyFilter passthrough; task-search.ts applyTaskFilters ready filtering
5. Web: readiness badge in the TaskDetailsModal Dependencies card (archived dependencies resolved via the API, aligned with CLI/TUI)
6. MCP: task_list ready argument + schema + guidelines/mcp/overview.md doc line
7. Port the tests (readiness/cli-task-list/mcp-tasks/unified-view/pty), adapted to the fork's structure
8. Verify: bunx tsc --noEmit, bun run check ., bun test, bun run build + rendered QA
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Takeover of contributor PR #814 (cottrell). Original implementation by David Cottrell (@cottrell) is preserved as the first commit on this branch with his git authorship; the adaptation commits are the maintainer's.

Survived from his branch mostly intact: the shared getTaskReadiness helper and its semantics, the --ready flag on task list (help schema, option, plain/json/interactive paths), the MCP task_list ready argument and JSON schema (no new MCP tools), the readiness line in the TUI detail pane, the readiness badge in the browser task-details modal, and the CLI/MCP/unified-view test cases.

Adapted during the takeover:
- Performance. His branch called core.loadTasks({includeCompleted:true}) unconditionally in viewTaskEnhanced and in the unified-view task loader. Measured on this repo (121 active, 455 completed tasks): that call takes 6.6s versus 1.7s for the normal active load, so every TUI launch and every task view would have paid several extra seconds. Replaced with filesystem.listCompletedTasks() (112ms, issued in parallel with the milestone metadata the viewer already loads) and, for CLI/MCP, a shared loadReadinessGraph() that reuses the warm ContentStore via queryTasks plus the completed tasks.
- Reverted the fullGraphTasks plumbing through unified-view.ts entirely; only the ready filter still flows from the CLI flag into the interactive viewer.
- Removed TaskListFilter.ready. Core.applyTaskFilters never handled it, so it was a filter field that silently did nothing.
- Dependency identity. His lookup used raw lowercase string equality, which misses the zero-padded and prefixed variants the rest of the product treats as the same task. Now keyed on canonicalTaskId.
- Partial graphs. His helper folded unresolvable dependency IDs into blockingDependencies, so the UI claimed a task was blocked by unfinished work when the ID simply could not be resolved. blockingDependencies now means resolved-but-unfinished, missingDependencies means unresolvable, both fail closed, and a shared formatReadinessBlockers renders them distinctly on every surface.
- Copy and placement. Readiness only renders when a task actually has dependencies, instead of adding a line to every task that restates its status; his 'Terminal status (Done)' row is gone for the same reason. In the browser the standalone banner moved into the Dependencies card, next to the dependencies it explains.
- TUI rendering bug found in rendered QA: the hourglass glyph is East Asian Wide, blessed miscounts its width, and the detail pane left stale cells behind when re-rendering a shorter line. Replaced with the single-width bullet the TUI already uses for blocked status.
- Browser/CLI divergence found in rendered QA: the web task corpus excludes backlog/completed, so a dependency that had been completed and filed showed 'Unknown dependency TASK-1' in the browser while the CLI and TUI said 'Ready to start'. The modal now resolves only its unresolved dependency IDs through the existing GET /api/tasks/:id endpoint, which already reads completed tasks, so all four surfaces agree without shipping the completed corpus to the client.

Verification: bunx tsc --noEmit, bun run check ., bun run build, and the readiness/cli-task-list/mcp-tasks/unified-view-filters suites all pass. Rendered QA on a disposable project with met, unmet, and completed-and-filed dependencies: TUI detail pane shows 'Readiness: ● Blocked by TASK-2', 'Readiness: ✓ Ready to start', and nothing at all for a task without dependencies; task list --ready returns the same three ready tasks in plain, json and interactive modes; the browser modal shows the matching amber and green badges in the Dependencies card in both light and dark themes.

Known follow-up, deliberately out of scope per the split of PR #814: the interactive view gives no on-screen indication that --ready is active, the same as the existing --limit flag. That belongs with the deferred Web 'Ready only' toggle and TUI shortcut work.

Final verification on the built binary (dist/backlog) against a disposable project with a met dependency, an unmet dependency, and a dependency completed into backlog/completed:
- Full suite: bun run test -> 1985 pass, 0 fail, 1990 tests across 217 files, exit 0. bunx tsc --noEmit, bun run check ., and bun run build all clean.
- The full suite caught two regressions that the scoped tests missed, both now fixed and re-verified: an infinite React render loop in the task-details modal (the readiness effect depended on arrays recreated every render and reset state with a fresh empty array), and the shipped MCP workflow overview, which mcp-server.test.ts requires to document every task_list schema filter.
- Also fixed during review: the board quick-look popup calls generateDetailContent without a task graph and would have reported every dependency as unknown. Readiness inputs are now an explicit optional context, so that popup makes no readiness claim at all. Verified by rendered board QA.
- CLI: task list --ready returns TASK-2, TASK-4, TASK-6 and excludes blocked TASK-3, in plain, json and interactive modes, including with --status 'To Do'. TASK-4 depends on a task living in backlog/completed and is still correctly reported ready.
- MCP: driven over stdio against the shipped binary, task_list with ready true returns the same three tasks and without it returns all four. No new MCP tools; the existing tool and schema carry the filter.
- TUI: detail pane shows 'Readiness: ● Blocked by TASK-2' and 'Readiness: ✓ Ready to start', nothing for a task without dependencies, and no stale render cells when navigating between them.
- Browser: the Dependencies card shows the matching amber and green badges in light and dark themes with no console errors.

Merged origin/main (BACK-593 web task-ID linking) into the branch. The merge was clean, but the full suite then failed one rendered assertion: main made the task-details modal router-dependent, so the readiness modal test now wraps it in MemoryRouter and TaskIdIndexProvider like the other modal tests. Re-verified on the merged tree: bun run test 2008 pass, 0 fail across 219 files; tsc, biome and build clean; TUI detail pane, browser modal (ready and blocked, no console errors), and task list --ready all re-checked on the rebuilt binary.

Review round 2 (Codex on PR #873, ten P2s: seven accepted and fixed here, three deferred to BACK-601).

1. Interactive --ready combined with --assignee, --unassigned or --parent resolved readiness against the prefiltered display list, so a dependency owned by someone else read as an unknown dependency and a blocked task could pass the filter. The interactive loader now returns the unfiltered corpus as readinessTasks, unified-view threads it to the viewer, and the viewer resolves readiness against it while still displaying only the filtered list. The one-shot plain and json paths were already correct because they used loadReadinessGraph.
2. Duplicate canonical identities in the graph were resolved first-wins, so the verdict depended on insertion order. An identity claimed by more than one record now resolves as unresolved and fails closed, per the manifesto's rule on ambiguous identity.
3. statuses: [] in config left no terminal status, so every dependency looked unfinished and everything was blocked. The CLI and server paths defaulted to DEFAULT_STATUSES but the interactive loader passed the empty array straight through. The default now resolves once inside createReadinessGraph, which covers every surface.
4. A record in backlog/completed whose status is not the currently configured terminal one (renamed statuses, or history from Core.completeTask) classified as unfinished and blocked its dependents permanently. Location in the completed corpus is now the completion evidence: completed records are passed separately and satisfy a dependency whatever their status string says.
5. The browser modal derived readiness from the persisted task.status and ignored the optimistic inline status state, so a task set to a terminal status inline still showed its blocked or ready badge until a refresh. It now depends on the edited status.
6. Completing a task with the TUI C shortcut removed it from the display list but left the startup completed snapshot stale, so dependents immediately flipped to 'Unknown dependency'. The shortcut now moves the record from the active side of the readiness graph to the completed side.
7. The id-to-task index was rebuilt for every evaluated candidate, which is quadratic on large ready-filters. It is built once per filter pass and passed through as a ReadinessGraph value. applyTaskFilters now takes ready?: ReadinessGraph instead of ready/statuses/readinessTasks, so readiness filtering cannot be requested without the graph it needs.

Deferred to BACK-601 (created off main, low priority, labels tui+web): draft-on-draft dependencies unresolvable in the browser, the readiness filter silently dropping when tabbing to the board, and cross-branch terminal dependencies missing from the graph under checkActiveBranches.

New coverage: duplicate-identity fail-closed in both insertion orders, renamed-terminal completed record, a task whose own record is completed, statuses: [] falling back to the default, readiness verdicts independent of the filters that narrowed the display list, a 2000-task scale guard that the quadratic version failed, CLI --ready with --assignee and --unassigned where the dependencies are hidden by the filter, and unified-view plumbing of the unfiltered corpus.

Rendered re-verification on the rebuilt binary: task list --ready --assignee @me returns only the task whose dependency is completed; the detail pane of the assignee-filtered list reports 'Blocked by TASK-2' for a dependency that is not in the list; completing that dependency with C leaves the dependent reading '✓ Ready to start' with the record confirmed in backlog/completed; and the browser badge switches off and back on immediately when the status is changed inline, with no console errors.

Verification after the review fixes: bun run test -> 2015 pass, 0 fail across 219 files, exit 0; bunx tsc --noEmit and bun run check . clean; bun run build clean. Follow-up task BACK-601 created on a branch off main so it lands independently of this PR.

Integrated a merge commit that had been pushed to the remote branch (a merge of main into the pre-fix branch state) instead of force-pushing over it. The result is content-identical to the review fixes: readiness.ts, task-search.ts, task-viewer-with-search.ts, unified-view.ts and TaskDetailsModal.tsx are byte-identical to the fix commit, and cli.ts differs only by main's decision-list and defaultAssignee changes. Re-verified: bun run test 2031 pass, 0 fail across 219 files; tsc, biome and build clean.

Review round 3 (Codex on PR #873): three accepted, one deferred. All three are fixed, but two of the accepted findings do not reproduce as described, and that is worth recording.

1. filtersActive omitted options.readyFilter, so the first render was not routed through applyFilters(). Fixed by listing readyFilter with the other narrowing filters. However the claimed symptom, that interactive 'task list --ready' never filters, is NOT reproducible: unified-view's subscribeUpdates calls emitTaskListUpdate() synchronously on subscription, and that callback ends in applyFilters(), so the list is always filtered before anything is painted. Verified directly by reverting the one-line fix and rendering in a PTY: 'task list --ready' still showed Tasks (2) with the blocked task excluded and no unfiltered flash. Today unified-view is the only caller that passes readyFilter, so the defect was latent. The fix is still right: a narrowing filter should gate the initial render on its own rather than depend on an incidental initial emit from the caller.
2. The A archive shortcut left the archived task in readinessSnapshot. Fixed by dropping the record from the snapshot for both lifecycle actions and re-adding only a completed one as completion evidence, so an archived dependency reads as unresolvable rather than as still-blocking. The claimed stale verdict also does not reproduce through the shortcut: archiving rewrites dependents' frontmatter to drop the reference, so in a rendered check the dependent simply lost its Dependencies and Readiness lines. The fix matters when the in-memory record has not caught up.
3. Genuine user-visible bug, reproduced and now covered by a test. A completed task opened by direct link, whose historical status is no longer the configured terminal status, was absent from the completed side of the graph, so the modal offered it as '✓ Ready to start'. The open task's own completed-corpus membership is now treated as completion evidence, the same location-is-evidence rule already used for dependencies. Reverting the fix makes the new assertion fail with the badge present in the rendered HTML.

Testing: added src/test/tui-ready-filter-pty.test.ts, an expect-driven PTY test asserting the interactive --ready render never lists the blocked task, following the project's existing RUN_INTERACTIVE_TUI_TESTS convention, and wired it into the CI step that runs interactive TUI tests against the compiled binary. Note that it passes with and without fix 1 for the reason above, so it guards the end-to-end behavior rather than proving that one line. The routed-completed-task case is covered by an assertion in readiness.test.tsx that does fail without its fix.

Deferred item 4 appended to BACK-601: getTaskStatistics counts blockers with exact-ID matching and a hard-coded 'Done'.

Merged origin/main again (BACK-580 and BACK-602 identity work) with no conflicts; the round-3 fixes are intact. Final verification on the merged tree: bun run test 2055 pass, 0 fail across 222 files, exit 0; scripts/run-tui-interactive-tests.sh 5 pass, 0 fail including the new readiness PTY test; bunx tsc --noEmit, bun run check ., and bun run build clean.

Implementation complete (strategy ② reference rewrite). Added src/utils/readiness.ts as a pure-function core (createReadinessGraph/getTaskReadiness/formatReadinessBlockers/loadReadinessGraph), with identity resolution via the fork`s task-path.ts taskIdsEqual; CLI task list --ready (plain/json/interactive, with the interactive path evaluating against the unfiltered corpus); TUI detail-pane Readiness line (single-width ●/✓ glyphs, listCompletedTasks loaded in parallel); web TaskDetailsModal Dependencies-card badge (completed dependencies resolved via GET /api/task/:id, follows the optimistic inline status); MCP task_list ready argument. Adaptation decisions: the assumption that the fork lacks task-id.ts turned out to be false (the fork already has the equivalent canonicalTaskId); the MCP schema goes through the fork`s static schemas.ts; web tests follow the fork`s MemoryRouter convention. Verification: tsc/check/build all clean, full bun test 2156 pass/0 fail; rendered CLI smoke over met/unmet/completed-and-filed/dangling fixtures reports all four cases correctly.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Port upstream BACK-546 dependency readiness guidance per migration item B8 (doc-9, strategy ② reference rewrite). Adds src/utils/readiness.ts (readiness graph core: blocking vs missing deps, both fail closed; canonical identity; completed-corpus location-as-evidence; statuses:[] fallback) and surfaces it on all five paths: CLI task list --ready (plain/json/interactive resolving against the unfiltered corpus), TUI detail-pane Readiness line with parallel listCompletedTasks loading and C/A shortcut graph maintenance, unified-view readyFilter passthrough with applyTaskFilters ready?: ReadinessGraph, browser TaskDetailsModal badge in the Dependencies card (off-corpus deps resolved via GET /api/task/:id, follows optimistic inline status), and MCP task_list ready argument (schema + guidelines overview). Adaptations to the fork: identity via task-path.ts taskIdsEqual, static MCP schemas.ts, MemoryRouter-based web modal tests, PTY test wired into run-tui-interactive-tests.sh/CI. Verified: tsc, biome, full bun test (2156 pass/0 fail), build; rendered CLI smoke on the built binary with met/unmet/completed-and-filed/dangling fixtures returns exactly the two ready tasks and excludes blocked and unknown-dependency tasks.
<!-- SECTION:FINAL_SUMMARY:END -->

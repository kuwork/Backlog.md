---
id: BACK-755
title: Include completed subtasks in parent task views
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-06 17:40'
updated_date: '2026-10-07 05:27'
labels:
  - bug
  - subtasks
dependencies: []
modified_files:
  - src/utils/task-corpus.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/completed-subtasks-hierarchy.test.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/hooks/useTaskHierarchyCorpus.ts
  - src/web/components/TaskHierarchySection.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/test/server-hierarchy-endpoint.test.ts
ordinal: 319000
actual_start: '2026-10-06 17:59'
actual_end: '2026-10-06 18:46'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Parent-child links live only on the child record (parent_task_id frontmatter); a parent discovers its children by reverse-scanning a task corpus at read time.

Every read path currently scans only backlog/tasks/, so once a subtask reaches a terminal status and is moved to backlog/completed/, it silently disappears from its parent. Repro: `bun run cli task view 217 --plain` lists BACK-217.02/.03/.04 but not BACK-217.01, even though that record still carries parent_task_id pointing at BACK-217.

Dependencies already solved the same problem: dependency readiness resolves through the completed corpus (loadReadinessGraph loads listCompletedTasks). Subtask derivation never received that corpus, so completed children stay invisible.

Fix by widening the corpus used for subtask derivation at the single chokepoint every surface routes through (Core.getTaskWithSubtasks), reusing the completed records already loaded in the TUI instead of rescanning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A parent whose subtask was completed and moved to backlog/completed lists that child in `backlog task view <parent> --plain`
- [x] #2 The same child appears through the JSON task view, the MCP task_view surface, and the TUI detail view, so no surface disagrees about the hierarchy
- [x] #3 When an active and a completed record claim the same canonical id, the active record wins and the subtask list contains no duplicate entries
- [x] #4 Subtask ordering remains sorted by task id, and corpora without completed children behave exactly as before
- [x] #5 The web UI task detail shows a completed child (and a completed parent) without widening the board or task list corpus
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Widen the default pool in Core.getTaskWithSubtasks (src/core/backlog.ts:916) to active + completed, merging with the same rule queryTasks already uses (canonical id dedupe, active record wins).
2. Update the CLI `task view` call sites (src/cli.ts:3957 and src/cli.ts:4156) so the corpus handed to getTaskWithSubtasks and the allTasks copy used for rendering include completed records.
3. In src/ui/task-viewer-with-search.ts reuse the completedTasks already loaded at 215-219 in the enrichTask pool and the getTaskWithSubtasks refresh at 801, so no extra disk scan is paid.
4. Keep attachSubtaskSummaries pure - no signature change; only the pool it receives changes.
5. Add a regression test asserting a child living in backlog/completed shows up in its parent subtask list through task view --plain.
6. Run bunx tsc --noEmit, bunx biome check on touched files, and the subtask-related tests.

7. Expose the completed corpus to the web UI as an opt-in: /api/tasks gains `completed=true` (src/server/index.ts handleListTasks passes includeCompleted through to queryTasks), and apiClient.fetchTasks takes `completed`, mirroring /api/search. The board and the task list stay active-only.
8. Add src/web/hooks/useTaskHierarchyCorpus.ts: a task detail loads only the relatives its own corpus lacks - one `parent` request for the children, plus a single task read when the parent itself is out of view - rather than the whole completed corpus.
9. In TaskHierarchySection merge those relatives into the display corpus deduped by canonical id, caller corpus first, and cache them per task id so a remount paints the last known hierarchy while the refresh runs. Pass the clicked record through onTaskClick: a completed record outside the caller corpus cannot be resolved by id from it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Second layer found while fixing the corpus: taskIdsEqual is prefix-strict, so a stale reference never matches even when it is in the pool. `taskIdsEqual("task-217", "BACK-217")` returns false, and canonicalTaskId keeps the prefix (TASK-217 vs BACK-217).

This repository configures task_prefix: "back", yet 65 backlog files still carry `parent_task_id: task-XX` and 36 carry dependency entries written as `task-XX`. BACK-217.01 is one of them (parent_task_id: task-217), while BACK-217.02/.03/.04 use BACK-217 - which is exactly why only the completed child vanished. The same staleness makes `Dependencies: task-213` on BACK-217 resolve as a missing dependency although BACK-213 is Done in the completed corpus.

Widening the corpus is therefore necessary but not sufficient for those records; the stale reference itself has to be normalized. That decision is deliberately out of scope for this change - it touches ~100 data files (a migration) or the shared identity semantics (a product-wide relaxation), neither of which belongs inside a hierarchy bug fix.

Verification: `bunx tsc --noEmit` reports no errors under src/ (the remaining output comes from the vendored myran/ mikesigs/ copies, which already fail on this tree). `bunx biome check` is clean on all five touched files. `bun test src/test/completed-subtasks-hierarchy.test.ts` is 3 pass / 0 fail, and reverting the Core change makes two of them fail (Subtasks (1): instead of Subtasks (2):), so the regression is pinned.

Not covered here: `src/test/parent-id-normalization.test.ts` hangs in this environment even with all changes stashed (git stash baseline), so it is unrelated to this fix. DoD item "bun run check ." was verified scoped to the touched files because the repo-wide run reports pre-existing failures in untracked vendor directories.

Web UI follow-up, two symptoms reported after the completed child became visible:

1. Duplicate subtasks on the first open of a task, gone on reopen.
2. Drilling into a child and back showed the active children first, with the completed one appearing a moment later.

Both come from composing the hierarchy in the browser, where the completed lookup and the task list race. The `parent` request answers with every child (active ones included), and the hook filtered those out by comparing against the corpus it was handed - on a cold view that corpus had not arrived yet, so the active children were kept as completed relatives and then rendered a second time once the task list landed. The second symptom is the same load restarting from empty on every remount.

Fixes: the merged corpus is now deduped by canonical id with the callers corpus taking precedence, so a record that arrives twice can only render once; and resolved relatives are kept in a module-level map keyed by task id, so a remount paints the last known hierarchy immediately while the refresh still runs behind it. The lookup itself still returns only records the corpus lacks.

Verification refreshed after the web UI pass: `bunx tsc --noEmit` still reports nothing under src/, and `bunx biome check` is clean on all eleven touched files (five from the core/CLI pass, six from the web pass). `bun test src/test/completed-subtasks-hierarchy.test.ts` is 3 pass / 0 fail and `bun test src/test/server-hierarchy-endpoint.test.ts` is 2 pass / 0 fail. The browser was exercised against this repository on http://localhost:8795: BACK-217 lists all four children including the completed BACK-217.01, and that child opens from the hierarchy section.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed subtasks are back in every parent view. Core.getTaskWithSubtasks now derives subtasks from active + completed records through the shared mergeCompletedIntoActive helper (canonical id dedupe, active record wins) that queryTasks already used, so the CLI plain and JSON views, MCP and the TUI agree; the TUI reuses the completed records it already loads for dependency readiness and pays no extra scan. In the web UI the detail view resolves only the relatives missing from its own corpus, via an opt-in `completed=true` list request, dedupes them against the caller corpus and caches them per task id so navigating into a child and back does not flash.

Regression coverage: src/test/completed-subtasks-hierarchy.test.ts (3 pass: core level, CLI plain, CLI JSON) and src/test/server-hierarchy-endpoint.test.ts (2 pass: a child in backlog/completed reachable through the list endpoint, default corpus unchanged). Reverting the Core change turns two of the three red.

Out of scope, recorded in the notes: ~100 backlog files still reference the old `task-` prefix in parent_task_id and dependency entries, which no corpus widening can repair - that is a data migration or a change to the shared identity semantics.
<!-- SECTION:FINAL_SUMMARY:END -->

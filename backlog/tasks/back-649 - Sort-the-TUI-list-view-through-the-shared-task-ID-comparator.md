---
id: BACK-649
title: Sort the TUI list view through the shared task ID comparator
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-01 17:16'
updated_date: '2026-09-17 20:53'
labels:
  - tui
dependencies: []
references:
  - src/core/task-identity-index.ts
  - src/utils/task-sorting.ts
  - src/ui/board.ts
  - src/test/subtask-ordering-consistency.test.ts
  - src/test/task-identity-index.test.ts
modified_files:
  - src/core/task-identity-index.ts
  - src/ui/board.ts
  - src/test/subtask-ordering-consistency.test.ts
  - src/test/task-identity-index.test.ts
actual_start: '2026-09-17 20:50'
actual_end: '2026-09-17 20:53'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
With more than nine subtasks under one parent, the board orders them numerically (1.9 before 1.10) while the board's task list view shows them alphabetically (1.10 before 1.2). Reported as issue 953 with a screenshot that does not name the surface, so the divergence has to be located before anything is changed.

Measured on this fork: the TUI board sorts through compareTaskIds (src/ui/board.ts), and the CLI plain and JSON outputs and the web task list all use that same comparator. The task list view reached from the board does not sort at all: task-viewer-with-search.ts renders the corpus it is handed in array order, and the corpus coming out of Core.loadTasks() is whatever TaskIdentityIndex.getTasks() produced. That reader currently orders its identity groups with id.localeCompare, so the array arrives alphabetical and the view reproduces it.

Deliverable: make the corpus reader order hierarchical ids numerically through the existing shared comparator, so the board columns, the list view, the CLI and the web list answer the same way for one corpus. Do not add a second sorting implementation, and do not change orderings that are deliberate.

Out of scope: a configurable or persisted sort order. The CLI already exposes --sort, and consistency is the defect being fixed here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-674 and git show 49e2f5d1a as implementation reference.
- [x] #2 The task corpus the board hands to its list view orders hierarchical ids numerically, so TASK-1.9 precedes TASK-1.10 and subtask ordering matches the board columns.
- [x] #3 Ordering comes from the existing shared task ID comparator with no second sorting implementation added.
- [x] #4 Deliberate orderings are unchanged: board ordinal ordering and parent/subtask grouping, task list --sort and its ordinal default, and the web list default.
- [x] #5 Board corpus, board columns, CLI plain, CLI JSON and the comparator the web list sorts by all agree on one identical subtask order for the same corpus.
- [x] #6 A regression test covers double-digit subtask ordering (1.1 through 1.11) on the affected surface and fails against the previous comparator.
- [x] #7 bunx tsc --noEmit, bun run check . and the scoped tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Reproduce and locate the divergence

- 1.1 Build a scratch project with one parent and eleven subtasks created out of numeric order, then compare every surface: CLI plain, CLI JSON, the TUI board columns, and the list view reached from the board.
- 1.2 Confirm which reader produces the wrong order before changing code, and keep every reader that is already correct out of the diff.

### Phase 2 - Route the corpus through the shared comparator

- 2.1 In src/core/task-identity-index.ts order the identity groups in getTasks() with compareTaskIds from src/utils/task-sorting.ts instead of id.localeCompare, importing it alongside the existing task-path helpers.
- 2.2 Leave deliberate orderings untouched: board ordinal ordering and parent/subtask grouping in src/ui/board.ts, task list --sort and its ordinal default in src/cli.ts, and the web list default.
- 2.3 Export prepareBoardColumns from src/ui/board.ts if the regression needs to read real board columns instead of re-deriving them from the corpus.

### Phase 3 - Regression coverage

- 3.1 Add src/test/subtask-ordering-consistency.test.ts with a corpus of one parent, subtasks 1.1 through 1.11 created in reverse order, plus TASK-2 and TASK-11; assert the corpus reader, the other corpus readers, the board columns, the comparator the web list sorts by, and the CLI plain and JSON lists all produce one identical id order.
- 3.2 Add a unit case to src/test/task-identity-index.test.ts for the changed ordering line.
- 3.3 Verify both cases fail against the previous comparator and pass after the change.
- 3.4 Gates: bunx tsc --noEmit, bun run check ., and the scoped tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduced before changing anything: a filesystem-only scratch project with TASK-1, subtasks TASK-1.1 to TASK-1.11 created in reverse, plus TASK-2 and TASK-11. CLI plain, CLI JSON, Core.queryTasks() and filesystem.listTasks() were already numeric, while Core.loadTasks() returned TASK-1.1, TASK-1.10, TASK-1.11, TASK-1.2 and so on. That is exactly the corpus the board hands to its unified view, and that view's task list renders its array as given, so the alphabetical order in the report came from the corpus reader rather than from the list view. The list view was left alone: every other entry point into it (task list, draft list, search, task view) hands it an already-ordered array, and task list --sort plus its ordinal default live there, so sorting inside the view would have overridden deliberate orderings.

Root cause and change: TaskIdentityIndex.getTasks() ordered its identity groups with id.localeCompare, a second ad-hoc id comparator. ContentStore hid it by re-sorting with sortByTaskId, but Core.loadTasks() returns getTasks() order verbatim. getTasks() now sorts with the shared compareTaskIds from src/utils/task-sorting.ts, so the duplicate comparator is gone rather than a third sort added. One line plus the import.

Deliberate orderings untouched: board ordinal ordering and parent/subtask grouping in src/ui/board.ts, task list --sort and its ordinal default in src/cli.ts, and the web list default. src/ui/board.ts only gained an export on prepareBoardColumns so the regression can read real board columns instead of re-deriving them.

Tests: new src/test/subtask-ordering-consistency.test.ts builds the corpus above and asserts one identical id order from the board corpus, queryTasks, filesystem.listTasks, the board columns, the comparator the web list sorts by, and the CLI plain and JSON lists. A unit case was added to src/test/task-identity-index.test.ts for the changed line. Reverting the comparator makes three of the four consistency cases and the unit case fail (the CLI case stays green because the CLI list was already numeric); restoring it returns all twelve to green.

Two tooling notes. The pre-existing useTemplate lint error in src/test/tui-task-composer.test.ts, left behind by earlier work in this fork, made bun run check . fail on an otherwise clean tree; it is fixed in its own commit so this gate stays meaningful. And rewriting a file with Python's default text write on Windows converted src/core/task-identity-index.ts to CRLF, which biome reported as a format error; the file was normalised back to LF.

Gates: bunx tsc --noEmit clean; bun run check . over 414 files with 0 errors and only the 3 pre-existing noNonNullAssertion warnings in src/core/assets.ts; bun test over the 10-file ordering/board/core scoped set gives 111 pass / 0 fail, and the 2-file composer set gives 15 pass / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The board's task corpus now orders hierarchical task ids numerically. With more than nine subtasks the divergence was not in the task list view: TaskIdentityIndex.getTasks() ordered identity groups with id.localeCompare, ContentStore masked that by re-sorting, and Core.loadTasks() returned the alphabetical order straight into the unified view, whose task list renders its array as given. getTasks() now uses the shared compareTaskIds, so the duplicate comparator is removed instead of a third sort being added, and the board's ordinal ordering and parent/subtask grouping, task list --sort with its ordinal default, and the web list default are all unchanged.

Verified on a scratch project across every surface, and by a regression that asserts one identical id order from the board corpus, the other corpus readers, the real board columns, the web-list comparator, and the CLI plain and JSON lists; the corpus case and the identity-index unit case were both confirmed to fail against the previous comparator. A pre-existing lint error that made bun run check . fail was fixed in a separate commit, and TypeScript, Biome over the whole repository, and the scoped suites all pass.
<!-- SECTION:FINAL_SUMMARY:END -->

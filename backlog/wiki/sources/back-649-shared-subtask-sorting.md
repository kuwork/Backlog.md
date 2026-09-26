---
title: BACK-649 Sort the TUI list view through the shared task ID comparator
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
  - core
source_path: backlog/tasks/back-649 - Sort-the-TUI-list-view-through-the-shared-task-ID-comparator.md
---

# BACK-649 Sort the TUI list view through the shared task ID comparator

With more than nine subtasks, the board ordered them numerically (1.9 before 1.10) while the board's task list view showed them alphabetically (issue 953). The divergence was not in the view: `TaskIdentityIndex.getTasks()` ordered identity groups with `id.localeCompare`, and `Core.loadTasks()` returned that order verbatim into the view. One line now routes the corpus reader through the shared `compareTaskIds`. Ports upstream BACK-674.

## Summary

- Reproduced before changing anything: a scratch project with TASK-1 plus subtasks 1.1–1.11 created in reverse showed CLI plain/JSON, `queryTasks()`, and `filesystem.listTasks()` already numeric, while `Core.loadTasks()` was alphabetical — `ContentStore` had been masking the index order by re-sorting with `sortByTaskId`
- Root cause: `TaskIdentityIndex.getTasks()` used `id.localeCompare`, a second ad-hoc id comparator; it now sorts with the shared `compareTaskIds` from `src/utils/task-sorting.ts`, removing the duplicate comparator rather than adding a third sort
- The list view (`task-viewer-with-search.ts`) was deliberately left unsorted: every other entry point hands it an already-ordered array, and sorting inside the view would have overridden `task list --sort` and its ordinal default
- Deliberate orderings untouched: board ordinal ordering and parent/subtask grouping, CLI `--sort` with ordinal default, web list default; `src/ui/board.ts` only gained an export on `prepareBoardColumns` so the regression reads real board columns
- New `src/test/subtask-ordering-consistency.test.ts` asserts one identical id order from the board corpus, other corpus readers, real board columns, the web-list comparator, and CLI plain/JSON; reverting the comparator turns three consistency cases plus the identity-index unit case red
- Tooling notes: a pre-existing `useTemplate` lint error was fixed in its own commit to keep `bun run check .` meaningful, and a Python write that converted the touched file to CRLF was normalized back to LF

## Acceptance Criteria

- The board corpus orders hierarchical ids numerically (TASK-1.9 before TASK-1.10), matching board columns
- Ordering comes from the existing shared comparator with no second implementation
- Board ordinal/grouping, `task list --sort`, and the web list default are unchanged
- Board corpus, CLI plain/JSON, and the web-list comparator agree on one identical subtask order

## Related Concepts

- [[concepts/task-identity]] — shared `compareTaskIds` as the single id-ordering authority
- [[concepts/cli-tui]] — board and unified view surfaces that consume the corpus
- [[concepts/upstream-migration]] — ports upstream BACK-674 (commit 49e2f5d1a)

## Related Sources

- [[sources/back-542-ordinal-task-list-sort]] — ordinal ordering that stays the deliberate default
- [[sources/subtask-grouping-fix]] — BACK-496 subtask grouping in board/list views
- [[sources/back-567-cross-branch-task-identity]] — identity index this comparator fix lives in

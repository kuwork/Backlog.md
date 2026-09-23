---
id: BACK-692
title: Resolve the TUI edit key's target by file location instead of status
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 04:48'
updated_date: '2026-09-23 05:25'
labels:
  - tui
  - bug
dependencies: []
references:
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/test/tui-edit-session.test.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
modified_files:
  - src/core/backlog.ts
  - src/test/tui-edit-session.test.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
priority: high
ordinal: 264400
actual_start: '2026-09-23 04:50'
actual_end: '2026-09-23 05:11'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pressing the TUI edit key on a draft reports that the branch has no such draft, so the file cannot be opened at all.

The edit session picks the store a row belongs to from the record's `status`: a row whose status is `Draft` is looked up in `backlog/drafts/`, and anything else is looked up in `backlog/tasks/`. Every other surface picks the store from where the file lives, so a draft file whose frontmatter status drifted away from `Draft` is listed and editable everywhere except here. `draft list` enumerates `backlog/drafts/` by directory, so those rows stay selectable, and the edit key then resolves a `DRAFT-` id against the task store, whose path lookup finds no task file and reports the row missing: `Task DRAFT-1 was not found on this branch.`

Drifted drafts are ordinary records rather than corruption. Demoting a task moves the file into `backlog/drafts/` and keeps its status (the filesystem copy that performs the move never rewrites `status:` and neither does the draft save), promotion deliberately keeps a non-Draft status instead of resetting it, and the earliest draft records were imported with the statuses they already carried. This repository's own `backlog/drafts/` holds fifteen of them today - draft-10 is `Done` and draft-1 through draft-15 are `To Do` - so the failure is reachable from the shipped drafts list rather than from a hand-made fixture.

The mirror shape fails the same way: a record under `backlog/tasks/` whose status is `Draft` is handed to the drafts store and reported missing.

The rule should match every other surface: where the row's file lives decides the store. Both lists hand the row over with its own `filePath`, and the directory is evidence about the store rather than a guess about which file is meant, so the existing guard for two files sharing one numeric identity stays and a row without a usable path keeps today's resolution order.
The notices the edit key shows are shared by the task list and the board, so they also called a draft a task: `Task DRAFT-9 was not found on this branch.` and `Editor exited with an error; task was not modified.`. The session now reports which store it resolved, and the surfaces take the noun from it, so a draft row reads `Draft DRAFT-9 ...` and `... draft was not modified.`. The board also renders an ambiguous draft result with the rename hint the task list already shows, instead of falling through to "no changes detected".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pressing the edit key on a drafts-store row whose status is not Draft opens that draft file, and the edit lands in the drafts store
- [x] #2 The row a demote produces (a drafts file carrying the task's original status) edits the draft file without creating or touching a task file
- [x] #3 A tasks-store row carrying status: Draft opens and edits the task file instead of being looked up in the drafts store
- [x] #4 A row without a usable file path keeps the current resolution order - the task store first, then the drafts fallback - and an id in neither store still reports not found
- [x] #5 Two draft files sharing one numeric identity still fail closed as ambiguous and neither file changes
- [x] #6 A targeted revert that restores status-based store selection turns exactly the drifted-draft cases red while the normal draft, the plain task and the twin-identity cases stay green
- [x] #7 The edit key's notices name a draft a draft: the session reports the store it resolved and both the task list and the board take their noun from it in the read-only, editor-failed, not-found and marked-modified lines
- [x] #8 The board's edit key renders an ambiguous draft result with the same rename hint the task list shows, instead of reporting no changes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Re-read the store decision in the edit session and every caller that hands a row over (the task viewer's edit key, the board's edit key) together with how those rows are built, so the new rule is derived from what a row actually carries.
2. In `Core.editTaskInTui`, decide the store from the row's own file location - its directory compared against the drafts directory - before any lookup runs, and keep the status check only as the fallback for a row that carries no path.
3. Keep the rest of the draft branch unchanged: resolve the file by id with the existing fail-closed identity check, reload through the file the session is bound to, and keep drafts out of the content store.
4. Cases in the drafts describe of the TUI edit session suite: a drafts row whose status is not Draft, the row a demote produces, a tasks row carrying `status: Draft`, and a bare-id edit of a drifted draft; the twin-identity and unknown-id cases stay as they are.
5. Verify clause by clause with a targeted revert that restores status-based selection, then run the scoped suite, the type check and Biome.
6. Have the session report which store it resolved and let both surfaces name the row from it, so a draft is never reported as a task; the board's edit key also renders the ambiguous result instead of falling through to the no-changes line.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed
- `src/core/backlog.ts` (`Core.editTaskInTui`): the store a row belongs to now comes from the row's own file location before any lookup runs - `relative(await this.fs.getDraftsDir(), dirname(row.filePath)) === ""` means the drafts store, and a row under the tasks directory means the task store. The status check stays only as the fallback for a row that carries no usable path, and a bare id keeps the original order (task store first, drafts store second). Everything else in the draft branch is untouched: resolution by `resolveDraftFilePath` with its fail-closed identity check, reload through the file the session is bound to, drafts kept out of the content store.

## Why drift is ordinary
- Demoting keeps the record's status: the filesystem move copies the task over and the draft save never rewrites `status:`, so `backlog/drafts/draft-1 - ....md` can carry `status: In Progress`. Promotion deliberately keeps a non-Draft status too. This repository's own drafts directory holds fifteen such records (draft-10 is `Done`, draft-1 through draft-15 are `To Do`), which is why the defect was reachable straight from the shipped `draft list`.

## Checks
- `src/test/tui-edit-session.test.ts`, drafts describe: four new cases - a drafts-list row whose status drifted to `In Progress`, the row a demote produces, a tasks-store row carrying `status: Draft`, and a drifted draft edited by bare id. They assert on the file that must change (the drafts file, with no task file minted, and the reverse shape). File: 13 pass.
- Revert matrix `tmp/rollback-692.py`: two variants x eight cases, each case run alone. Variant A (status-only selection restored) turns the three drifted cases red and leaves bare-id, normal-draft, plain-task, twin-identity and unknown-id green. Variant B (path evidence kept for the drafts side only) turns exactly the tasks-store-`Draft` case red and leaves the rest green, so that case pins the second half of the rule. Sources restored byte-for-byte.
- `bunx tsc --noEmit` clean; `bunx biome check src/core/backlog.ts src/test/tui-edit-session.test.ts` clean. `bun run check .` still reports the two errors and three warnings HEAD already carries (`src/utils/task-path.ts`, assets).
- Neighbours: `cli-draft-edit` 8 pass. Two environment failures, both pre-existing on this machine and unrelated: the watcher-fixture `afterEach` in the first `tui-edit-session` describe reports EBUSY under a combined run (the same case passes twice when run alone), and `atomic-task-edit`'s web-409 case fails identically on the untouched tree.

## Traps worth remembering
- The editor line is store-independent: `defaultEditor` here is `rider`, which does not resolve in this environment (`Executable not found in $PATH`), so `openInEditor` returns false and the session reports `editor_failed` - "Editor exited with an error; task was not modified." for tasks and drafts alike. That makes it the signal that a row WAS resolved, while a misrouted row reports not found instead.
- Probes kept in `tmp/`: `probe-tui-demote-e.ts` (create -> demote -> press E), `probe-tui-draft-e2.ts` (both directions), `probe-editor-resolution.ts` (editor resolution).
## The notices name the store the session resolved
- `Core.editTaskInTui` now carries `entity: "task" | "draft"` on every exit, taken from the row's directory when a row was handed over and from the resolved store otherwise; `TuiTaskEditEntity` is exported for the surfaces.
- `src/ui/task-viewer-with-search.ts` exports `editTargetNoun(entity)`, which returns the plain and sentence-initial forms. Both the task list and the board use it for the read-only, editor-failed, not-found and marked-modified lines, so a draft row is never reported as a task.
- The board's edit key had no `ambiguous` branch at all, and a `draft list` session can Tab to the board, so that reason was reachable and fell through to "No changes detected". It now shows the same rename hint as the task list.
- Checks: two new cases in the drafts describe - `entity` is asserted on the drifted row, the demote row, the tasks-store row and the bare-id edit, and a failing editor on a draft reports `editor_failed` with `entity: "draft"` while leaving the file untouched - plus an `editTargetNoun` mapping case. File: 15 pass.
- Revert matrix is now three variants x nine cases, each case run alone (`tmp/rollback-692.py`): A (status-only routing) turns the three drifted cases and the editor-failed case red; B (drafts-side evidence only) turns exactly the tasks-store `Draft` case red; C (`entity` always "task") turns the four draft cases red while the tasks-store case, the guards and the noun mapping stay green. Sources restored byte-for-byte.
- The sentence templates themselves are not unit-tested: these are transient TUI notices with no harness that drives them, which is also true of the wording before this change. The tested seam is the session's `entity` plus the noun mapping.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI edit key now reads the store off the row's own file location instead of the record's status, so a draft whose frontmatter status drifted away from Draft opens instead of being reported missing. Core.editTaskInTui compares the row's directory against the drafts directory before any lookup and keeps the status check only as the fallback for a row without a usable path; a bare id keeps the task-store-first order. Four new cases in the TUI edit session suite pin the drifted drafts row, the row a demote produces, a tasks-store row carrying status Draft, and the bare-id fallback, each asserted on the file that must change. A two-variant revert matrix turns exactly the intended cases red with the guards green and restores the sources byte-for-byte.
<!-- SECTION:FINAL_SUMMARY:END -->

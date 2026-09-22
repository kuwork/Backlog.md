---
id: BACK-683
title: 'Add draft editing to the CLI, aligned with the web board''s draft editing'
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-21 20:50'
updated_date: '2026-09-21 21:54'
labels: []
dependencies: []
references:
  - src/cli.ts
  - src/test/cli-draft-edit.test.ts
  - src/guidelines/cli-instructions/drafts.md
modified_files:
  - src/cli.ts
  - src/test/cli-draft-edit.test.ts
  - src/guidelines/cli-instructions/drafts.md
  - CLI-INSTRUCTIONS.md
ordinal: 258400
actual_start: '2026-09-21 20:51'
actual_end: '2026-09-21 21:50'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web board can already edit a draft. The task routes serve drafts too, so a `DRAFT-` id sent to the task update endpoint lands in `core.editTaskOrDraft`: the draft keeps its Draft status, the whole task field surface applies, and an ambiguous draft identity fails closed before anything is written. The CLI cannot. `backlog draft` stops at list / create / view / archive / promote, so a draft's title, description, assignee, labels, priority, acceptance criteria, plan, notes, refs or dates can only be changed by editing the file by hand or by promoting it and editing the resulting task - even though the capability underneath has been there since the web draft editing landed.

This is the CLI half of the CORE-10 migration item (upstream BACK-639, drafts editable from the CLI and TUI). The TUI half needs a draft surface the fork's board does not have at all - it refuses to show a draft on the board - so it stays a separate follow-up rather than riding along here.

Scope is the CLI command and the plumbing it shares with `task edit`: the field options and the options-to-input mapping move into helpers both commands use, so the two cannot drift. The core entries (`updateDraftFromInput`, `editTaskOrDraft`, `applyTaskUpdateInput`), the fail-closed draft identity resolution, and the server path already exist and do not move.

One deliberate difference from the web path: the web reaches `editTaskOrDraft`, which promotes a draft when a real status is requested. The CLI keeps the ported upstream contract that a draft cannot change status - a non-Draft `--status` is refused with a pointer at `backlog draft promote` - because the fork has an explicit promotion command and a silent promotion from `edit` would be a surprise in a script.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog draft edit DRAFT-1 applies the same field flags task edit takes and writes them to the draft file through the core draft entry, with the file still carrying status: Draft.
- [x] #2 The field-option set and the options-to-input mapping are shared with task edit rather than duplicated, so a flag removed from the shared registration disappears from both commands.
- [x] #3 A non-Draft --status is refused with a message naming backlog draft promote, exit code 1, and the draft file byte-identical afterwards.
- [x] #4 An id that names no draft reports it as not found with exit code 1 and writes nothing, and a task id is refused the same way.
- [x] #5 Several ids are refused as a batch, matching the CLI rule that a batch means one shared change applied to every listed file.
- [x] #6 Two draft files sharing one numeric identity fail closed with the ambiguity error naming both files, and neither file changes.
- [x] #7 --plain prints the updated draft record, and the default output names the updated draft.
- [x] #8 The shipped guidance teaches the command: src/guidelines/cli-instructions/drafts.md, the draft line in CLI-INSTRUCTIONS.md, and the command's help-schema examples.
- [x] #9 Removing the draft branch - routing draft edit to the task store - turns the draft cases red while the task-edit cases stay green, and restoring it turns them green again.
- [x] #10 Live, on a project outside the repository: a field written by draft edit is what the file holds afterwards, and --status Done leaves the file alone while pointing at draft promote.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
- [x] #4 The new CLI draft-editing cases are green and the neighbouring CLI suites stay green
- [x] #5 bunx tsc --noEmit is clean and bun run check . reports only the pre-existing assets.ts warnings
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Re-read the shared pieces: the field-option chain and help schema behind task edit, how its action turns options into editArgs and then into a task update input, the core draft entries, and the helpers the other draft commands already use.
2. Move the field options and the options-to-args mapping into helpers so task edit and draft edit share one list instead of two copies.
3. Add draft edit [taskId] on top of them: require exactly one id, resolve it as a draft, refuse a non-Draft status with the promote pointer, apply through the core draft entry, and print the result (the record with --plain).
4. Guide surfaces: the drafts guide, the draft line in CLI-INSTRUCTIONS.md, and the command's own examples.
5. Cases: a CLI test file for the field writes, the status and unknown-id and batch guards, the ambiguous identity, and the plain output, plus a case pinning that both commands read one shared option list.
6. Verify clause by clause with a rollback matrix that restores the sources, then run tsc, Biome and the neighbouring suites.
7. Live check on a project outside the repository, including that a refused status change leaves the file untouched.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
What changed
- `src/cli.ts`: the field-option chain behind `task edit` moved into `addEditFieldOptions(command)`, and the options-to-args mapping that sat inside that command's action moved into `buildEditArgs(core, options, kind, id)`. Two commands now read one list, so a flag cannot work on one of them and be missing from the other. Inside the mapping, the guards that printed an error and set `process.exitCode` now throw and the callers print `error.message`, which is the same text on stderr. The move was checked against HEAD: the 56 option flags and the 92 help entries are identical before and after.
- `editFieldHelpOptions` is one help list for both commands; the draft schema swaps the type and description of the single field whose rule differs (`status`). `loadDraftOrReport` now sets `process.exitCode = 1` when a draft is missing - the read-only draft commands should have done that all along, and the edit command needs it.
- New `draft edit [taskIds...]`: collapses a repeated id, refuses a batch, requires at least one field flag, resolves the draft through the existing fail-closed resolver, builds the same update input the task path builds, applies it through `core.updateDraftFromInput`, and prints `Updated draft DRAFT-n` or the whole record with `--plain`.
- Guides: `src/guidelines/cli-instructions/drafts.md` gained an "Editing a draft" section and a key rule, `CLI-INSTRUCTIONS.md`'s draft-flow row now shows the edit step, and the command carries its own help examples.

Why the status rule differs from the web
- The web board and the MCP tool both reach `core.editTaskOrDraft`, which promotes a draft the moment a real status is sent. The CLI keeps the ported upstream contract instead: `draft edit --status` accepts only Draft and otherwise points at `backlog draft promote`. The fork promotes through an explicit command, and a promotion hidden inside an edit is a surprise in a script. Everything else is the same surface the web has - same fields, same set/add/remove/clear shape, same core entry underneath - which is what "aligned with the web draft editing" comes to here.

What the checks showed
- `src/test/cli-draft-edit.test.ts`: 8 cases green. They write draft fixtures and drive the real CLI in a temp project: the field write (title, priority, ref, AC, assignee) with the status still Draft; `--status Draft` accepted while any other status is refused with the promote pointer and a byte-identical file; unknown draft and task ids reported without a write; the batch refusal; the missing-field-flag refusal; two files claiming one identity failing closed with both files untouched; the `--plain` record; and the check that the two commands read the same flag list.
- Refactor safety net: 108 cases green across the seven suites that exercise `task edit` (task-edit-preservation, atomic-task-edit, acceptance-criteria, cli-task-batch-edit, cli-plain-create-edit, definition-of-done-cli, final-summary).
- `bunx tsc --noEmit` clean; `bun run check .` reports only the three pre-existing `assets.ts` warnings; the guide-example verifier passes.
- Draft suites: 46 pass alongside the new cases. One unrelated case in `mcp-drafts.test.ts` ("promotes and demotes via task_edit status changes") fails in this environment rather than on this change: its assertions pass, and the failure is its own teardown - the fixture lives under the repository's `tmp/`, and `safeCleanup` cannot delete it while a handle is still open (`EBUSY: resource busy or locked`), with the sandbox also denying `git.exe` on some runs. The suite never imports `src/cli.ts`, so nothing here reaches it, and it passed on earlier runs of the same file.
- Rollback matrix (`tmp/rollback-draft-edit.py`): six variants and seven guard runs, every verdict as expected - A (a draft may take a real status), B (several drafts in one batch), C (a run without a field flag), D (a missing draft that does not fail the run), E (the draft write going to the task store) and F (one option dropped from the shared registration) each turn their case red, while E's control case - a task edit through the same plumbing - stays green. Sources restored byte-for-byte.
- Live on a project outside the repository: `draft edit DRAFT-1 --priority high --add-ref src/cli.ts --ac "..." --assignee @sara` wrote every field and printed `Updated draft DRAFT-1`; the file kept `status: Draft`; `--status "In Progress"` exited 1 with the promote hint and left the file untouched; `draft edit DRAFT-9`, a task id, two ids and a run with no field flag all exited 1 with their own message; `--plain` printed the record.

Traps worth remembering
- The guards inside the mapping had to become throws: a function cannot `return` on behalf of its caller, and the callers print `error.message` so the text on stderr stays the same. Keep that in mind when a guard's message needs the id - `buildEditArgs` takes it as a parameter.
- `Task` carries `acceptanceCriteriaItems`, not `acceptanceCriteria` (that name belongs to the input shape). The first version of the new case failed on exactly that.
- A batch refusal has to be a CLI-level check rather than `allowExcessArguments`, because the message is part of what the command teaches; the fork's other draft commands just ignore extra arguments.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Drafts are editable from the CLI now, with the same field surface the web board edits them through.

- `backlog draft edit DRAFT-1` takes every field flag `task edit` takes - title, description, assignee, labels, priority, milestone, dates, acceptance criteria, Definition of Done, plan, notes, comments, final summary, references, documentation, modified files - including the set/add/remove/clear shape of each, and writes through `core.updateDraftFromInput`, so a draft stays a draft.
- One shared help list, one shared option registration and one shared options-to-args mapping now serve both commands, so the two cannot drift; the move was verified against HEAD as flag-for-flag and entry-for-entry identical.
- A draft cannot take a real status: `--status` accepts only Draft and otherwise points at `backlog draft promote`, so promotion stays an explicit step even though the web and MCP paths promote from a status change. Drafts are edited one at a time, a run with no field flag is refused, and a missing or ambiguous draft id fails closed without touching either file.
- `loadDraftOrReport` marks a missing draft as a failed run, which the read-only draft commands now inherit.
- Guides teach the command: the drafts guide gained "Editing a draft" and a key rule, and `CLI-INSTRUCTIONS.md`'s draft flow shows the edit step.

Verification: 8 new CLI cases green, 108 cases green across the seven suites that exercise `task edit`, `bunx tsc --noEmit` clean, Biome clean apart from the three pre-existing `assets.ts` warnings, the guide-example verifier passing, a six-variant rollback matrix in which every guard ran red and the task-edit control stayed green with the sources restored byte-for-byte, and a live run on a project outside the repository covering the field write, the refused status change with an untouched file, and every refusal message.
<!-- SECTION:FINAL_SUMMARY:END -->

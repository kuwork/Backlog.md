---
title: BACK-683 Add draft editing to the CLI, aligned with the web board's draft editing
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - cli
  - drafts
source_path: backlog/tasks/back-683 - Add-draft-editing-to-the-CLI-aligned-with-the-web-boards-draft-editing.md
---

# BACK-683 Add draft editing to the CLI, aligned with the web board's draft editing

The web board could already edit drafts (a `DRAFT-` id to the task update endpoint lands in `core.editTaskOrDraft`), but the CLI stopped at list/create/view/archive/promote. This task adds `backlog draft edit` sharing the exact field-option surface of `task edit`, with one deliberate difference: a draft cannot take a real status from the CLI — promotion stays an explicit `draft promote` step.

## Summary

- `src/cli.ts`: the field-option chain behind `task edit` moved into `addEditFieldOptions(command)` and the options-to-args mapping into `buildEditArgs(core, options, kind, id)`; the move was verified flag-for-flag (56 options, 92 help entries) identical against HEAD, so the two commands cannot drift
- Mapping guards that printed and set `process.exitCode` now throw and callers print `error.message` — same stderr text (a function cannot `return` on behalf of its caller); `buildEditArgs` takes the id as a parameter for messages that need it
- New `draft edit [taskIds...]`: collapses a repeated id, refuses batches (CLI-level check, not `allowExcessArguments`, because the message teaches), requires at least one field flag, resolves through the existing fail-closed draft resolver, applies via `core.updateDraftFromInput`, prints `Updated draft DRAFT-n` or the record with `--plain`
- Status rule: `--status` accepts only Draft and otherwise points at `backlog draft promote` — unlike the web/MCP path which promotes from a status change — because a promotion hidden inside an edit is a surprise in a script
- `loadDraftOrReport` now sets `process.exitCode = 1` for a missing draft, which the read-only draft commands inherit
- Guides updated: `src/guidelines/cli-instructions/drafts.md` ("Editing a draft" + key rule), `CLI-INSTRUCTIONS.md` draft-flow row, command help examples
- Tests: 8 new cases in `src/test/cli-draft-edit.test.ts`; 108 cases green across seven `task edit` suites as refactor safety net; six-variant rollback matrix with a task-edit control; live check on a project outside the repository. Note: `Task` carries `acceptanceCriteriaItems`, not `acceptanceCriteria`

## Acceptance Criteria

- `draft edit` applies the same field flags as `task edit` through the core draft entry, leaving `status: Draft` in the file
- Field options and mapping shared with `task edit`, not duplicated
- Non-Draft `--status` refused with the promote pointer, exit 1, byte-identical file; unknown ids, task ids, batches, and ambiguous identities all fail closed without writes
- `--plain` prints the updated record; shipped guidance teaches the command

## Related Concepts

- [[concepts/cli-entry]] — CLI command registration and shared option plumbing
- [[concepts/cli-instructions]] — guide surfaces updated to teach the command
- [[concepts/task-lifecycle]] — draft → task promotion boundary the status rule protects

## Related Sources

- [[sources/back-532-cli-draft-workflow-guides]] — earlier draft workflow guide work on the same command family
- [[sources/demote-to-draft-action]] — the reverse transition on the draft lifecycle

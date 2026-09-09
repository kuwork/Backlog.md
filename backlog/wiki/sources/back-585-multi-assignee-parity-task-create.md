---
title: BACK-585 Multi-assignee parity for task create
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - cli
source_path: backlog/tasks/back-585 - Multi-assignee-parity-for-task-create.md
---

# BACK-585 Multi-assignee parity for task create

Fixed task create/draft create storing `-a "@a,@b"` as one literal assignee while task edit parsed comma-separated input. Create/draft now route assignees through the shared `parseDelimitedStringList` helper and `-a` is repeatable, mirroring the earlier --labels fix.

## Summary

- Registered `createMultiValueAccumulator` on -a/--assignee for task create, task edit, and draft create in `src/cli.ts`; comma-separated values split into separate assignees via `parseDelimitedStringList`.
- Replaced the duplicated inline label split in create/draft with `parseDelimitedStringList` (behavior identical since createTaskFromInput already runs normalizeStringList over labels).
- Preserved the --unassign guard and empty -a validation from BACK-584; edit path already used `parseClearableStringList` and needed only repeatable registration.
- Audit: task-creation wizard (`parseListInput` in `src/commands/task-wizard.ts`) and MCP task_create/task_edit (JSON array) already handled multi-assignee — no changes.
- Docs: `src/guidelines/cli-instructions/task-creation.md`, `drafts.md`, `task-execution.md` updated; scoped tests 20 pass / 0 fail.

## Acceptance Criteria

- Comma-separated assignees parse into separate assignees on create and draft create; repeated -a collects on all three commands; shared helper parity with task edit; tests cover both input shapes.

## Related Concepts

- [[concepts/cli-entry]] — commander option registration patterns (multi-value accumulators)
- [[concepts/task-identity]] — assignee list semantics shared with BACK-584 unassign work

## Related Sources

- [[sources/back-584-explicit-unassign-across-surfaces]] — the --unassign guard this task preserved

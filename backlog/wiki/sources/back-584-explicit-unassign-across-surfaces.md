---
title: BACK-584 Allow explicit unassign across CLI, web, and MCP when defaultAssignee is set
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - cli
  - web-ui
  - mcp
  - bug
source_path: backlog/tasks/back-584 - Allow-explicit-unassign-across-CLI-web-and-MCP-when-defaultAssignee-is-set.md
---

# BACK-584 Allow explicit unassign across CLI, web, and MCP when defaultAssignee is set

Completed the "explicitly unassigned" expression across all surfaces after BACK-579/581 shipped defaultAssignee application. Core rule: absent field = no opinion (default applies), explicit empty `[]` = explicitly unassigned.

## Summary

- Core: `src/core/backlog.ts` `createTaskFromInput` uses `input.assignee === undefined` to decide the defaultAssignee fallback; explicit `[]` is preserved as empty.
- `src/utils/task-edit-builder.ts`: assignee uses `sanitizeClearableStringArray` so explicit `[]` reaches updateInput (MCP task_edit assignee: [] clears).
- CLI (`src/cli.ts`): `--unassign` added to task create, draft create, task edit; `-a ""` errors prompting `--unassign`; `--unassign` and `-a` are mutually exclusive.
- Web: `src/web/App.tsx` passes defaultAssignee + availableAssignees to TaskDetailsModal; create mode pre-fills chips and submits with three-state logic (omit when unchanged, `[]` when cleared, list when modified); edit mode uses ChipInput list with dropdown.
- MCP: `src/mcp/utils/schema-generators.ts` documents empty-array semantics.
- Docs: ADVANCED-CONFIG.md, `src/guidelines/cli-instructions/task-creation.md`, `task-execution.md`, `drafts.md` updated; 88 scoped tests pass.

## Acceptance Criteria

- Core distinguishes absent vs explicit []; CLI supports --unassign; web create pre-fills default and clearing chips saves empty; web edit edits assignee as ChipInput list; MCP task_edit assignee: [] clears; docs and help schema updated.

## Related Concepts

- [[concepts/task-identity]] — absent-vs-explicit-empty field semantics on create
- [[concepts/web-ui-features]] — TaskDetailsModal create/edit form behavior
- [[concepts/mcp-workflow]] — MCP tool schema semantics for clearable fields

## Related Sources

- [[sources/back-585-multi-assignee-parity-task-create]] — follow-up that made -a repeatable while preserving the --unassign guard

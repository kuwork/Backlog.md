---
id: BACK-754
title: Re-parent an existing task (task edit --parent / --clear-parent)
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-06 15:52'
updated_date: '2026-10-06 16:29'
labels:
  - cli
  - mcp
dependencies: []
modified_files:
  - src/types/task-edit-args.ts
  - src/types/index.ts
  - src/utils/task-edit-builder.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/mcp/utils/schema-generators.ts
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/mcp/task-execution.md
  - src/test/cli-reparent.test.ts
  - src/test/mcp-reparent.test.ts
priority: medium
ordinal: 318000
actual_start: '2026-10-06 16:04'
actual_end: '2026-10-06 16:29'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`--parent` exists only on `task create` (and as a `task list` filter). There is no way to set or change the parent of a task that already exists, so a task created without a parent can never join an existing parent-child tree. This surfaced when the BACK-614/751/753 tasks needed to be filed under the BACK-239 feature after the fact: the only route was a one-off script calling `core.updateTask` directly.

Add a first-class re-parent path on the edit surface, shared by CLI and MCP:

- `backlog task edit <id> --parent <parentId>` sets `parent_task_id`.
- `backlog task edit <id> --clear-parent` removes it.

Parent is minted at create time (`generateNextId(type, parent)` produces `BACK-239.01`), but the parent-child edge itself is just the `parent_task_id` frontmatter field and is resolved by ID, so re-parenting an existing task does not require renaming it. Keep the existing ID; only the edge changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog task edit <id> --parent <parentId> sets parent_task_id (normalized) and persists it
- [x] #2 backlog task edit <id> --clear-parent removes parent_task_id
- [x] #3 Unknown parent, self-parent, and cycle-creating parents are rejected with a clear error
- [x] #4 The new flags count as edit field flags (bare --parent is treated as a change; wizard/batch guards behave)
- [x] #5 MCP task_edit accepts parentTaskId as string (set) or null (clear)
- [x] #6 Tests cover set/clear/invalid cases; biome and tsc are clean on touched files
- [x] #7 The usage guide documents re-parenting in both the CLI and MCP Task Field Quick Reference (src/guidelines/cli-instructions/task-execution.md and src/guidelines/mcp/task-execution.md): '--parent' / '--clear-parent' for the CLI, 'parentTaskId' for MCP, kept in parallel
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Types: add `parentTaskId?: string | null` to `TaskEditArgs` (src/types/task-edit-args.ts) and to `TaskUpdateInput` (src/types/index.ts). `null` means "clear", mirroring `milestone`.
2. Builder: in `buildTaskUpdateInput` (src/utils/task-edit-builder.ts) map `args.parentTaskId` through — `undefined` = untouched, `null` = clear, string = trimmed target ID.
3. Core: in `applyTaskUpdateInput` (src/core/backlog.ts) apply the field like `milestone`. Validate before assigning: the target must resolve to an existing task, must not be the task itself, and must not create a cycle (walk the proposed parent's ancestor chain and reject if the edited task appears). Normalize the stored ID.
4. CLI: add `-p, --parent <taskId>` and `--clear-parent` to `addEditFieldOptions` (src/cli.ts), teach `hasEditFieldFlags` to count them, and map the commander options into `editArgs.parentTaskId` in the options-to-args builder. Leave `PER_TASK_ONLY_EDIT_FLAGS` alone: re-parenting several tasks to one parent is a legitimate batch.
5. MCP: add `parentTaskId` (string or null) to the generated `task_edit` schema (src/mcp/utils/schema-generators.ts); `TaskEditArgs` already carries it through `handlers.editTask`.
6. Help/usage guide: document the two flags next to the other edit fields.
7. Tests: cover set, clear, unknown parent, self-parent, and cycle; run biome + tsc.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Re-parenting is a single field rewrite, so it lives on the existing edit surface instead of a new command. Both front ends already funnel through `buildTaskUpdateInput` into `applyTaskUpdateInput`, so the feature is one type field, one builder mapping, and one core block plus a validator - CLI and MCP get it together.

- Types: `parentTaskId?: string | null` on `TaskEditArgs` and `TaskUpdateInput`. `null` clears, `undefined` leaves it untouched, mirroring `milestone`.
- Builder: `undefined` passes through untouched, `null` clears, a string is trimmed (an empty string also clears).
- Core: `applyTaskUpdateInput` applies the field like `milestone`. A new private `resolveParentTaskId(taskId, candidate)` resolves the target against tasks + completed and answers the matched record's own ID, so the stored spelling normalizes (a bare `1` is stored as `TASK-1`). It refuses three cases before writing: nothing matches, the target is the task itself, and the target sits below the task (walking the proposed parent's ancestor chain and stopping on the edited ID, with a `seen` set so a pre-existing loop cannot spin the walk).
- CLI: `-p, --parent <taskId>` and `--clear-parent` on `addEditFieldOptions`; `hasEditFieldFlags` counts both, so a bare `--parent` is a change and the wizard stays out of the way; the pair is rejected together and an empty `--parent` points at `--clear-parent`. Left out of `PER_TASK_ONLY_EDIT_FLAGS`: filing several tasks under one parent is a legitimate shared-value batch.
- MCP: `parentTaskId` added to the generated `task_edit` schema next to `milestone`; `TaskEditRequest` already carries it through `handlers.editTask` with no handler change.

No file is renamed: the parent edge is just the `parent_task_id` field, resolved by ID. Subtasks stay derived at read time (`attachSubtaskSummaries`) and the board still groups by `parent_task_id`, so nothing else needed to change. `parentTaskId` is already in `buildUpdatedDateComparableTask`, so an edit bumps `updated_date` as expected.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog task edit <id> --parent <parentId>` and `--clear-parent` now set and clear `parent_task_id` on an existing task, backed by the same validation on the CLI and MCP surfaces.

- CLI: `-p, --parent <taskId>` / `--clear-parent`, both counted as edit-field flags; combining them is refused.
- MCP: `task_edit` accepts `parentTaskId` as a string (set) or `null` (clear).
- Validation: the parent must resolve to exactly one existing task (or a completed one), cannot be the task itself, and cannot close a cycle; the stored ID is normalized to the matched record.
- Docs: the CLI Task Field Quick Reference (`--parent` / `--clear-parent`) and the MCP counterpart (`parentTaskId`) were updated in parallel, plus a note in each "Working with Subtasks" section.

Tests: `bun test src/test/cli-reparent.test.ts src/test/mcp-reparent.test.ts` -> 12 pass / 0 fail. Related suites (`cli-draft-edit`, `cli-parent-shorthand`, `cli-parent-filter`, `atomic-task-edit`, `mcp-milestones`) pass. `biome check` on touched files and `tsc --noEmit` are clean.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-584
title: 'Allow explicit unassign across CLI, web, and MCP when defaultAssignee is set'
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-23 15:20'
updated_date: '2026-08-23 16:17'
labels:
  - bug
  - cli
  - web-ui
dependencies:
  - BACK-579
  - BACK-581
references:
  - ADVANCED-CONFIG.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/cli-instructions/drafts.md
  - src/core/backlog.ts
  - src/utils/task-edit-builder.ts
  - src/cli.ts
  - src/web/App.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/test/core.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/cli-plain-create-edit.test.ts
  - src/test/draft-create-consistency.test.ts
  - src/test/web-task-details-modal-assignee.test.tsx
  - backlog/config.yml
modified_files:
  - src/core/backlog.ts
  - src/utils/task-edit-builder.ts
  - src/cli.ts
  - src/web/App.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/mcp/utils/schema-generators.ts
  - src/test/core.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/cli-plain-create-edit.test.ts
  - src/test/draft-create-consistency.test.ts
  - src/test/web-task-details-modal-assignee.test.tsx
  - ADVANCED-CONFIG.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/cli-instructions/drafts.md
  - backlog/config.yml
priority: high
ordinal: 200400
actual_start: '2026-08-23 13:40'
actual_end: '2026-08-23 15:59'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-579/581 have already shipped defaultAssignee application. This task completes the missing "explicitly unassigned" expression across surfaces.

Core rule:
- absent (field omitted) = no opinion: create applies configured defaultAssignee
- explicit empty [] = explicitly unassigned

CLI design:
- task create / draft create / task edit gain --unassign option
- -a "" errors and prompts user to use --unassign
- --unassign and -a are mutually exclusive
- omitting -a remains absent and applies defaultAssignee

Web design:
- TaskDetailsModal receives defaultAssignee prop
- create mode pre-fills assignee chips from defaultAssignee
- In create mode, submit omits assignee field when unchanged (absent), letting core apply default
- In create mode, clearing chips sends assignee: [] (explicitly unassigned)
- In edit mode, assignee is edited as a list via ChipInput like labels; clearing all chips sends assignee: [] to explicitly clear the current assignee

Core changes:
- createTaskFromInput resolvedAssignees uses input.assignee === undefined to decide defaultAssignee fallback
- task-edit-builder assignee uses sanitizeClearableStringArray so explicit [] reaches updateInput

Also update ADVANCED-CONFIG.md, src/guidelines/cli-instructions/task-creation.md, src/guidelines/cli-instructions/task-execution.md, and related help schema / i18n copy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 core createTaskFromInput distinguishes absent from explicit []; absent applies defaultAssignee, [] clears assignee
- [x] #2 CLI task create/draft create/task edit support --unassign; -a "" errors and prompts to use --unassign
- [x] #3 web create form pre-fills defaultAssignee; clearing chips saves assignee as empty
- [x] #4 web edit mode edits assignee via ChipInput list; clearing all chips saves assignee as empty
- [x] #5 MCP task_edit assignee: [] clears assignee
- [x] #6 Update ADVANCED-CONFIG.md, src/guidelines/cli-instructions/task-creation.md, src/guidelines/cli-instructions/task-execution.md, and related help schema / i18n copy
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Phase 1: core semantics
- Modify src/core/backlog.ts createTaskFromInput so defaultAssignee only applies when input.assignee === undefined; explicit [] is preserved as empty.
- Add/update core tests for create with defaultAssignee and explicit empty assignee.

Phase 2: task-edit-builder
- Modify src/utils/task-edit-builder.ts to use sanitizeClearableStringArray for assignee so explicit [] reaches updateInput.
- Add/update MCP edit tests for clearing assignee with assignee: [].

Phase 3: CLI
- Add --unassign option to task create, draft create, and task edit in src/cli.ts.
- Validate that -a "" errors and prompts --unassign, and that --unassign and -a are mutually exclusive.
- Update help schema descriptions.
- Add CLI tests for --unassign, -a "" error, and defaultAssignee application.

Phase 4: Web
- Pass defaultAssignee prop from src/web/App.tsx to TaskDetailsModal.
- Update TaskDetailsModal Props and create-mode form state to pre-fill assignee chips from defaultAssignee.
- Implement three-state submit for create mode: omit field when unchanged, send [] when cleared, send list when modified.
- Update i18n/help copy if needed and add/update web tests.

Phase 5: MCP schema
- Update assignee description in src/mcp/utils/schema-generators.ts to document empty array semantics if needed.

Phase 6: Documentation
- Update ADVANCED-CONFIG.md Default Assignee section with --unassign scenario.
- Update src/guidelines/cli-instructions/task-creation.md with -a/omit/--unassign semantics.
- Update src/guidelines/cli-instructions/task-execution.md with edit clear/replace semantics.

Phase 7: Verification
- Run bunx tsc --noEmit, bun run check ., and bun test (or scoped tests).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Phase 1 complete: core createTaskFromInput now uses input.assignee === undefined to decide defaultAssignee fallback; explicit [] is preserved as empty; added core test.

Phase 2 complete: task-edit-builder assignee now uses sanitizeClearableStringArray; added MCP test for clearing assignee with [].

Phase 3 complete: CLI --unassign added to task create, draft create, and task edit; -a "" now errors and prompts --unassign; --unassign and -a are mutually exclusive; added CLI tests.

Phase 4 complete: web App.tsx passes defaultAssignee and availableAssignees to TaskDetailsModal; create mode pre-fills defaultAssignee chips; create submit uses three-state logic (omit when unchanged, [] when cleared, list when modified); edit mode uses ChipInput list with dropdown suggestions; added web tests.

Phase 5 complete: updated assignee description in src/mcp/utils/schema-generators.ts to document empty array semantics.

Phase 6 complete: updated ADVANCED-CONFIG.md, src/guidelines/cli-instructions/task-creation.md, src/guidelines/cli-instructions/task-execution.md, and src/guidelines/cli-instructions/drafts.md.

Phase 7 complete: bunx tsc --noEmit passes; bun run check . passes except 3 pre-existing warnings in src/core/assets.ts; scoped relevant tests pass with 0 failures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented explicit unassign semantics across CLI, web, and MCP when defaultAssignee is configured.

Changes:
- Core: createTaskFromInput now applies defaultAssignee only when input.assignee === undefined; explicit [] is preserved as empty.
- task-edit-builder: assignee uses sanitizeClearableStringArray so explicit [] reaches updateInput.
- CLI: task create, draft create, and task edit support --unassign; -a "" errors and prompts --unassign; --unassign and -a are mutually exclusive.
- Web: TaskDetailsModal receives defaultAssignee prop; create mode pre-fills chips from defaultAssignee and submits with three-state logic (omit when unchanged, [] when cleared, list when modified); edit mode uses ChipInput list.
- MCP: task_edit schema description documents empty assignee array semantics.
- Docs: updated ADVANCED-CONFIG.md, task-creation.md, task-execution.md, and drafts.md.
- Tests: added coverage in core.test.ts, mcp-tasks.test.ts, cli-plain-create-edit.test.ts, draft-create-consistency.test.ts, and web-task-details-modal-assignee.test.tsx.

Verification:
- bunx tsc --noEmit passes.
- bun run check . passes (3 pre-existing warnings in src/core/assets.ts).
- Scoped relevant tests (88) pass with 0 failures.

Follow-up fix: added availableAssignees support so the web assignee ChipInput now shows a dropdown of existing/default assignees when focused. Verified by an additional web test.
<!-- SECTION:FINAL_SUMMARY:END -->

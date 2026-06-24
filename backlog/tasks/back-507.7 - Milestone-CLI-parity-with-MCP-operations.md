---
id: BACK-507.7
title: Milestone CLI parity with MCP operations
status: Done
assignee:
  - '@gpt-5.5-xhigh'
created_date: '2026-06-13 21:12'
updated_date: '2026-06-24 06:12'
labels: []
dependencies:
  - BACK-401
modified_files:
  - src/cli.ts
  - src/mcp/tools/milestones/handlers.ts
  - src/test/cli-milestone-management.test.ts
  - CLI-INSTRUCTIONS.md
  - README.md
  - src/guidelines/agent-guidelines.md
parent_task_id: BACK-507
priority: high
ordinal: 38000
actual_start: '2026-06-24 06:03'
actual_end: '2026-06-24 06:11'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add non-interactive CLI commands for milestone add, edit, and remove on top of BACK-401, so CLI users and agents can perform the same milestone management operations currently exposed through MCP. Keep behavior aligned with the post-401 MCP handlers/schemas for validation, task reassignment, archived milestone handling, date-field support, and error messages where practical. Update command help and public docs so agents can discover these operations from the CLI surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog milestone add <name> creates a milestone file with optional description and validates duplicates consistently with MCP milestone_add.
- [x] #2 backlog milestone remove <name> supports clear, keep, and reassign task-handling modes, including validation for required reassign targets.
- [x] #3 backlog milestone edit <name> supports title, description, dueDate, plannedStart, and plannedEnd updates; it preserves the BACK-401 updateTasks behavior, rewriting local task milestone references only when the title changes, and exposes `--no-update-tasks` to disable even title-driven rewrites.
- [x] #4 Milestone command help includes input schema sections, read/write behavior, outputs, and examples for add, edit, remove, list, and archive, including date-field types for edit.
- [x] #5 Tests cover CLI add/edit/remove success paths, validation failures, title-driven task reference updates, date field updates, archived milestone handling, and parity with MCP milestone handler behavior.
- [x] #6 README or CLI reference docs mention the new milestone commands where milestone management is documented.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the legacy CLI `milestone create` and `milestone rename` commands so the milestone surface matches the post-401 MCP shape.
2. Make `milestone edit <name>` the single mutation command, with `--title`, `--description`, `--due-date`, `--planned-start`, `--planned-end`, and `--clear-*` options plus `--no-update-tasks`.
3. Route `milestone add`, `edit`, `remove`, and `archive` through the shared `MilestoneHandlers` so validation, task-reference updates, archived milestone handling, auto-commit, and error text stay aligned with MCP.
4. Add a description-changed check to the MCP `editMilestone` handler and remove the unused `renameMilestone` alias.
5. Update milestone command help schemas and public docs (CLI-INSTRUCTIONS.md, README.md, agent-guidelines.md).
6. Update the focused CLI milestone management test suite to cover add, edit (title/dates/description/clears), remove, validation, help schema, and MCP parity.
7. Run scoped milestone tests, type-check the modified files, and run Biome on the changed source files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented BACK-507.7 on top of BACK-401. Unified the CLI milestone surface around `add`, `edit`, `remove`, `archive`, and `list`. Removed the standalone `create` and `rename` commands; `edit` now accepts `--title`, `--description`, `--due-date`, `--planned-start`, `--planned-end`, and corresponding `--clear-*` flags, plus `--no-update-tasks`. Title-driven task reference rewrites are handled by the shared `MilestoneHandlers.editMilestone` path, so date-only edits do not touch tasks. Updated CLI help schemas, CLI reference docs, README, and agent guidelines. Added focused CLI milestone management tests covering add, edit (title/dates/description/clears), remove, validation, and MCP output parity.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented non-interactive CLI milestone management parity on top of BACK-401. The CLI milestone surface is now `add`, `edit`, `remove`, `archive`, and `list`. The old `create` and `rename` commands were removed. `edit` supports `--title`, `--description`, `--due-date`, `--planned-start`, `--planned-end`, and `--clear-due-date/--clear-planned-start/--clear-planned-end`, plus `--no-update-tasks`. It delegates to the shared `MilestoneHandlers.editMilestone` path, so task milestone references are only rewritten when the title actually changes; date-only edits do not touch tasks.

Updated milestone help schemas and public docs (CLI-INSTRUCTIONS.md, README.md, agent-guidelines.md). Added/updated focused CLI milestone management tests covering add, edit (title/dates/description/clears), remove, validation, help schema output, and MCP output parity. Also added a description-changed check to the MCP `editMilestone` handler so description-only edits are applied, and removed the now-unused `renameMilestone` handler alias.

Verification passed: `bun test src/test/cli-milestone-management.test.ts src/test/cli-task-milestone.test.ts src/test/cli-milestone-filter.test.ts src/test/mcp-milestones.test.ts`; `bunx tsc --noEmit`; `bunx biome check` on modified files.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

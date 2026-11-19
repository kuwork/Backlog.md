---
id: BACK-855
title: Rename task files when task titles change
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-19 07:56'
updated_date: '2026-11-19 08:39'
labels:
  - cli
  - mcp
dependencies: []
modified_files:
  - src/core/backlog.ts
  - src/file-system/operations.ts
  - src/test/core.test.ts
  - src/test/file-rename-plan.test.ts
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/cli-instructions/task-finalization.md
  - src/guidelines/mcp/task-execution.md
  - src/guidelines/mcp/task-finalization.md
ordinal: 414004
actual_start: '2026-11-19 07:56'
actual_end: '2026-11-19 08:39'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate the reusable FileRenamePlan with task title updates so a title change that alters the sanitized filename renames the task file and repairs local references. Preserve task IDs and parent folders, cover active and completed tasks, and update only /task/:id/:title title segments. Reuse existing reference rewriting for tasks, documents, decisions, and Wiki content. Do not add a decision title-rename entry point in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Changing a task title renames its file when the sanitized filename changes while preserving the task ID and parent directory for active and completed tasks
- [x] #2 Task file renames use FileRenamePlan to update matching local references and structured path fields across tasks, documents, decisions, and Wiki content without changing unrelated links
- [x] #3 Task title changes update matching /task/:id/:title segments while preserving IDs, link text, queries, fragments, and ranges; documentation and decision routes are not triggered
- [x] #4 No-op title updates and unchanged sanitized paths do not write unrelated files; target conflicts and apply failures preserve the original task and references
- [x] #5 Core tests cover active and completed task renames, reference and slug updates, no-op behavior, and conflicts; TypeScript, Biome, and scoped tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect task update and filename-generation paths and identify the shared Core entry point used by CLI, MCP, and Web.
2. Reuse FileSystem task filename generation and FileRenamePlan to rename active or completed task files in place while preserving parent paths.
3. Trigger only task title-route normalization and include primary and reference changes in existing auto-commit behavior.
4. Add Core regressions for active/completed renames, references, slugs, no-op updates, conflicts, and legacy frontmatter compatibility.
5. Run scoped tests, bunx tsc --noEmit, and bun run check .; update implementation notes and final summary.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation completed:
- Added a shared getTaskFilename helper and reused it in FileSystem.saveTask so task creation and title renames use identical filename sanitization.
- Core.updateTask now compares the persisted title and only builds a FileRenamePlan when the title changed and the sanitized target path differs. Other field updates keep the existing path and save flow.
- The rename preserves the task ID and parent directory, serializes the updated task through the shared plan, updates matching local references and structured path fields, and triggers only /task/:id/:title normalization.
- Auto-commit stages the task move and every changed reference. CLI, MCP, and Web entry points inherit the behavior through Core.updateTask/updateTaskFromInput.
- Same-ID target collisions fail before writing through existing task identity resolution; the source and target remain unchanged.
- Updated CLI and MCP task execution/finalization guides to remove the obsolete manual mv workflow.

Validation:
- Related rename, Markdown path, frontmatter, and task path tests: 93 pass, 0 fail, 241 assertions.
- Existing Core task operations: 27 pass, 0 fail.
- Auto-commit task rename regression: 1 pass, 0 fail.
- bunx tsc --noEmit: passed.
- bun run check .: exit code 0 with only pre-existing graph/duckdb warnings.

Guidance adjustment: automatic rename is the default; if it fails, the CLI/MCP guides now recommend mv followed by manual reference repair instead of prohibiting mv.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented automatic task file renaming when a task title changes its sanitized filename.

Changes:
- Reused one task filename generator across creation and rename flows.
- Integrated Core task updates with FileRenamePlan for atomic primary-file and reference updates.
- Updated matching local links, task structured fields, Wiki source_path values, and /task/:id/:title segments while leaving documentation and decision routes untouched.
- Preserved IDs, directories, statuses, no-op behavior, and existing auto-commit semantics.
- Updated public CLI/MCP guidance to describe automatic renames, with mv plus manual reference repair as a fallback if the automatic flow fails.

Verification:
- Related tests: 93 pass, 0 fail.
- Existing Core task operations: 27 pass, 0 fail.
- Auto-commit regression: 1 pass, 0 fail.
- TypeScript and full Biome checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-858
title: >-
  Support ID updates and exact source selection for tasks, documents, and
  decisions
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-19 10:46'
updated_date: '2026-11-19 15:09'
labels:
  - cli
  - mcp
  - tasks
  - documentation
  - decisions
dependencies: []
documentation:
  - backlog/docs/PRDS/rename/doc-36 - PRD：任务、文档与决策更新命令支持修改-ID-设计.md
modified_files:
  - CLI-INSTRUCTIONS.md
  - src/cli.ts
  - src/core/backlog.ts
  - src/core/entity-source.ts
  - src/core/file-rename-plan.ts
  - src/markdown/file-rename-references.ts
  - src/types/index.ts
  - src/types/task-edit-args.ts
  - src/utils/entity-id.ts
  - src/mcp/errors/mcp-errors.ts
  - src/mcp/utils/schema-generators.ts
  - src/mcp/workflow-guides.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/mcp/tools/tasks/index.ts
  - src/mcp/tools/tasks/schemas.ts
  - src/mcp/tools/documents/handlers.ts
  - src/mcp/tools/documents/index.ts
  - src/mcp/tools/documents/schemas.ts
  - src/mcp/tools/decisions/handlers.ts
  - src/mcp/tools/decisions/index.ts
  - src/mcp/tools/decisions/schemas.ts
  - src/guidelines/cli-agent-nudge.md
  - src/guidelines/cli-instructions/decisions.md
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/cli-instructions/entity-identity.md
  - src/guidelines/cli-instructions/index.ts
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/guidelines/cli-instructions/task-finalization.md
  - src/guidelines/mcp/task-execution.md
  - src/guidelines/mcp/documents.md
  - src/guidelines/mcp/decisions.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/overview.md
  - src/test/cli.test.ts
  - src/test/entity-id-update.test.ts
  - src/test/file-rename-plan.test.ts
  - src/test/mcp-entity-identity.test.ts
  - src/test/mcp-server.test.ts
  - backlog/docs/PRDS/rename/doc-36 - PRD：任务、文档与决策更新命令支持修改-ID-设计.md
ordinal: 417004
actual_start: '2026-11-19 10:49'
actual_end: '2026-11-19 15:09'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the existing task, document, and decision view/update commands so users can change entity IDs through an optional --id and select an exact local Markdown source through --source-path.

Preserve all current positional ID forms, including doc-1 and bare 1. Support three source-selection modes: ID only, source path only with the old ID read from frontmatter, and ID plus source path with an equivalence check. Reuse FileRenamePlan for atomic file renaming and reference synchronization; do not add a parallel rename command or a new dry-run workflow.

Provide MCP parity: task_edit, document_update, and decision_update accept newId/sourcePath; task_view, document_view, and decision_view support exact source selection. Preserve existing MCP tool description semantics while documenting the additive capabilities.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 task edit, doc update, and decision update support optional --id without adding a rename subcommand; task view, doc view, decision view and their update commands support --source-path.
- [x] #2 ID-only selection preserves existing aliases such as doc-1 and bare 1; path-only selection reads the old ID from frontmatter; combined selection accepts equivalent IDs and rejects mismatches with SOURCE_MISMATCH before any update write.
- [x] #3 Duplicate old IDs return AMBIGUOUS_ID when no path is provided, while --source-path can select exactly one duplicate without modifying or deleting the others.
- [x] #4 Only-ID, ID-and-title, and combined metadata updates keep frontmatter, filenames, and references consistent; equivalent new-ID collisions and existing target paths fail before any write.
- [x] #5 Task dependencies, exact task references, permitted parentTaskId fields, and /task/:id/:title routes follow task ID changes; multi-task use, cross-parent renumbering, and parent changes with children are rejected.
- [x] #6 Document and decision changes synchronize exact relative links, task documentation/references/modified_files, milestone documentation, Wiki source_path, and /documentation/:id/:title and /decisions/:id/:title routes; a missing Wiki directory is skipped and not created.
- [x] #7 Ordinary bare-ID prose is not blindly rewritten, and unrelated content, directories, and metadata remain unchanged.
- [x] #8 Multi-file updates preserve concurrency checks, no-replace installation, rollback, cache refreshes, and complete auto-commit scope.
- [x] #9 Regression tests cover existing behavior, all source-selection modes, conflicts, task hierarchy, references, routes, Wiki handling, rollback, and auto-commit scope; focused tests, TypeScript, and Biome checks pass.
- [x] #10 MCP task_edit, document_update, and decision_update support newId/sourcePath with bare target IDs; task_view, document_view, and the new decision_view support exact source selection without regressing existing tool descriptions.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add --source-path to the task, document, and decision view/update commands and --id to their update commands. Implement shared source selection for ID-only, path-only, and combined modes without changing positional ID parsing.
2. Pass newId separately from the source identity through CLI and Core update flows. Normalize IDs, validate source/destination conflicts and target paths, and complete all preflight checks before writing.
3. Extend FileRenamePlan and reference rewriting to update frontmatter identity, exact structured identity references, relative paths, task documentation/references/modified_files, milestone documentation, Wiki source_path, and /task/:id/:title, /documentation/:id/:title, and /decisions/:id/:title routes. Skip a missing Wiki directory without creating it.
4. Enforce task-specific rules: reject --id or --source-path with multiple task IDs, check active and completed tasks for conflicts, reject parent ID changes when children exist, allow only same-parent subtask renumbering, and keep reparenting separate.
5. Preserve atomic installation, rollback, cache refreshes, and auto-commit scope across every old, new, and related path. Add AMBIGUOUS_ID, SOURCE_MISMATCH, ID_CONFLICT, and PATH_CONFLICT diagnostics.
6. Add regression coverage for existing title updates and positional ID aliases, all three source-selection modes, mismatches, duplicate IDs, conflicts, task hierarchy rules, structured and Markdown references, entity slug routes, missing Wiki directories, rollback, and auto-commit scope. Run focused tests, TypeScript, and Biome checks.

Add MCP schema and handler parity by reusing Core source selection and rename flows. Preserve existing tool description semantics, add decision_view, synchronize MCP workflow guides, and cover the public MCP call path with regression tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented shared exact-source selection and separate source/target IDs for tasks, documents, and decisions. Added stable AMBIGUOUS_ID, SOURCE_MISMATCH, ID_CONFLICT, PATH_CONFLICT, and task hierarchy diagnostics. Reference synchronization covers active/completed tasks, drafts, documents, decisions, active/archived milestones, and an optional Wiki. Duplicate old-ID files outside the selected source remain unchanged. Corrected structured parent_task_id rewriting and preserved ordinary bare-ID prose.

Reopened at user request to add MCP parity for entity ID updates and exact source selection.

Added MCP parity for task, document, and decision identity updates and exact source selection. Added decision_view, preserved original tool description prefixes, kept document content optional without clearing existing bodies, and mapped identity failures to structured MCP errors. Updated MCP guides and doc-36. Validation: new MCP identity tests 4/4; document and decision MCP tests 17/17; task, reparent, and draft MCP tests passed after isolated Windows cleanup retry; TypeScript and full Biome checks passed. The pre-existing mcp-server tool-list expectation still omits graph_legend_get/set/remove and remains outside this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented optional --id for task, document, and decision updates and --source-path for their view/update commands without adding a rename subcommand.

Changes:
- Preserved positional ID aliases and added exact path selection, mismatch checks, conflict preflight, and task hierarchy rules.
- Reused FileRenamePlan for filenames, frontmatter, relative links, structured fields, milestones, Wiki source_path, and entity ID/slug routes.
- Added regression coverage for duplicate IDs, source selection, references, routes, conflicts, rollback, and auto-commit behavior.

Verification:
- 24 focused entity-ID/rename tests passed.
- 38 focused identity/rename/autocommit tests passed.
- 12 document/decision CLI compatibility tests passed.
- 36 remaining CLI compatibility tests passed.
- bunx tsc --noEmit passed.
- bun run check . passed.

MCP task_edit, document_update, and decision_update now support newId/sourcePath; task_view, document_view, and the new decision_view support exact source selection. Existing tool descriptions retain their original semantics with additive capability notes, and regression tests cover the real MCP call path.
<!-- SECTION:FINAL_SUMMARY:END -->

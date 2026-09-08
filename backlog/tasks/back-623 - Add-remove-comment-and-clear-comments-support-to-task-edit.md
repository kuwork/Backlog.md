---
id: BACK-623
title: Add --remove-comment and --clear-comments support to task edit
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-08 06:08'
updated_date: '2026-09-08 17:40'
labels:
  - mcp
  - cli
  - web-ui
dependencies: []
references:
  - src/markdown/structured-sections.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/types/task-edit-args.ts
  - src/mcp/utils/schema-generators.ts
modified_files:
  - src/types/index.ts
  - src/types/task-edit-args.ts
  - src/core/backlog.ts
  - src/cli.ts
  - src/utils/task-edit-builder.ts
  - src/mcp/utils/schema-generators.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/guidelines/agent-guidelines.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/task-execution.md
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-execution.md
  - src/test/comments.test.ts
  - src/test/mcp-tasks.test.ts
  - src/test/server-search-endpoint.test.ts
  - src/test/web-task-details-modal-final-summary.test.tsx
  - README.md
ordinal: 226400
actual_start: '2026-09-08 06:18'
actual_end: '2026-09-08 16:37'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task comments are currently append-only: every surface (CLI --comment, MCP commentsAppend, server API, Web UI) can only add comments, and there is no way to delete a comment or fix a wrong author/body without hand-editing the task markdown, which breaks metadata sync and violates the CLI-only workflow rule.

Scope: CLI task edit flags with core/serializer support, MCP task_edit parity (commentRemove/commentClear), server API passthrough, Web UI per-comment deletion, tests, and updated usage guides. TUI deletion is out of scope for this task. Comment body/author editing stays out of CLI scope; guides must tell agents to handle that case with the text replacement tool (Edit) on the task file directly (see the agent-guidance AC).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog task edit <id> --remove-comment <index> removes the comment at the given 1-based position (the index shown by task view) and rejects out-of-range indexes with a clear error
- [x] #2 --remove-comment is repeatable in a single edit and removes all listed indexes
- [x] #3 backlog task edit <id> --clear-comments removes the entire Comments section content
- [x] #4 Remaining comments are renumbered deterministically by position after removal (indexes are not persisted, per BACK-470 design)
- [x] #5 Removal works for both the current delimited format and legacy <!-- COMMENT:BEGIN --> blocks
- [x] #6 MCP task_edit exposes equivalent commentRemove/commentClear inputs with matching semantics
- [x] #7 Comment removal is reflected in search indexing and plain/JSON output
- [x] #8 Usage guides are updated: CLI help text, agent guidelines (cli-instructions, mcp instructions), and public docs describe the new flags
- [x] #9 Tests cover remove by index, multiple removal, clear, out-of-range errors, legacy-format tasks, and preservation of unrelated task content
- [x] #10 Agent-facing instructions state that editing an existing comment's body or author (still no CLI flag) must be done with the text replacement tool (Edit) on the Comments section of the task file directly, while all add/remove operations go through CLI/MCP
- [x] #11 Web UI task detail exposes a delete action for each specific comment (in edit mode), wired through the server API, with the remaining comments renumbered by position
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Types: add removeComments/clearComments to TaskUpdateInput (src/types/index.ts) and commentRemove/commentClear to TaskEditArgs (src/types/task-edit-args.ts)
2. Core: in Core updateTask comment block (src/core/backlog.ts ~1659), apply clearComments, then removeComments (validate indexes exist, throw 'Comment #N not found' with available-index hint, filter, renumber by position), then existing appendComments
3. CLI: add --remove-comment <index> (repeatable) and --clear-comments to task edit (src/cli.ts), register in hasEditFieldFlags, parse/validate positive integers into editArgs
4. Builder: map commentRemove/commentClear in buildTaskUpdateInput (src/utils/task-edit-builder.ts)
5. MCP: add commentRemove/commentClear to task_edit schema (src/mcp/utils/schema-generators.ts) and clear-vs-remove/append exclusion validation in editTask handler (src/mcp/tools/tasks/handlers.ts)
6. Server: passthrough commentRemove/commentClear in task update API (src/server/index.ts)
7. Web UI: add per-comment delete action in edit mode of TaskDetailsModal.tsx (confirm -> apiClient.updateTask({commentRemove:[index]}), refresh from response), extend TaskUpdate type in src/web/lib/api.ts, add delete-comment labels to en/zh-CN/zh-TW/ja locales
8. Guidelines: update agent-guidelines.md (append-only wording, command tables, text-replacement-tool guidance for editing existing comment body/author), mcp/overview.md, mcp/overview-tools.md, mcp/task-execution.md, cli-instructions/task-execution.md and overview.md
9. Tests: extend src/test/comments.test.ts (remove one/multiple, clear, out-of-range error, legacy block format, renumbering, unrelated content preserved); MCP edit tests for commentRemove/commentClear; web modal comment-delete test if coverage exists
10. Verify: bunx tsc --noEmit, bun run check ., bun test; live smoke on BACK-623 file: add comment then remove it
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete across all surfaces. Core: clear->remove (validated, renumbered by position)->append order in updateTask. CLI: --remove-comment (repeatable) and --clear-comments with mutual exclusion. MCP: commentRemove/commentClear with clear-conflict validation. Server: passthrough. Web: per-comment delete button in edit mode (4 locales). Guidelines: agent-guidelines, mcp (overview/overview-tools/task-execution), cli-instructions (overview/task-execution), README. Tests: comments.test.ts (+7), mcp-tasks.test.ts (+1), server-search-endpoint.test.ts (extended), web modal (+2). Smoke tested on BACK-623 file: append #1, remove #1, exclusion errors, section stripped when empty.

Follow-up UX: Comments section header now has a 'Clear comments' text button on the right (same pattern as AC/DoD 'Click to update'), gated by !isFromOtherBranch && comments.length > 0, wired to commentClear via server API with confirm dialog; 4 locales updated; web modal test covers it (17 pass). Validation: bunx tsc --noEmit clean (excluding pre-existing tmp/ repro errors); bun run check on touched files clean (3 pre-existing warnings in src/core/assets.ts); scoped bun test passes.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kimi
created: 2026-09-08 07:24
---
UX adjustment after user feedback: add-comment form and per-comment delete buttons are now visible directly in the task detail view without entering edit mode (gated only by !isFromOtherBranch), reversing BACK-470 edit-mode-only gating for comments. Delete asks for confirmation; cross-branch tasks stay read-only. AC #11 delivered as delete action visible in task detail rather than edit-mode-only.
---

author: @kimi
created: 2026-09-08 16:36
---
Web: added 'Clear comments' text button to the right of the Comments section header (TaskDetailsModal.tsx), mirroring the AC/DoD header 'Click to update' pattern. Visible in preview when comments exist and task is not cross-branch; confirms then calls updateTask with commentClear:true and refreshes from response. Locales added for en/zh-CN/zh-TW/ja. Test added: clears all comments through the section header button.
---

author: @kimi
created: 2026-09-08 16:39
---
Label tweak: Clear-comments header button text is now short label (en 'Clear', zh '清空', ja '全削除') via new clearCommentsLabel locale key; the descriptive clearComments string is kept as the hover tooltip. dist rebuilt.
---

author: @kimi
created: 2026-09-08 17:00
---
Enhancement: --remove-comment now also accepts comma-separated indexes (e.g. --remove-comment 2,3) in addition to repeated flags. Implemented in the shared parsePositiveIndexList helper (src/utils/task-builders.ts), so --remove-ac/--check-ac/--uncheck-ac/--remove-dod/--check-dod/--uncheck-dod accept commas too. New CLI test added (22 pass in comments.test.ts); live smoke on a scratch task verified 1,3 removal leaves the middle comment renumbered as #1. Help text and agent-guidelines updated. dist rebuilt.
---

author: @kimi
created: 2026-09-08 17:40
---
Doc sync: cli-instructions/overview.md and cli-instructions/task-execution.md now note --remove-comment accepts repeated flags or comma-separated indexes. dist rebuilt (guidelines are embedded in the binary).
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added comment deletion across all surfaces of Backlog.md.

Changes:
- CLI: task edit --remove-comment <index> (repeatable) and --clear-comments, mutually exclusive with --comment; indexes are validated, comments renumbered by position after removal; legacy <!-- COMMENT:BEGIN --> blocks supported
- Core: updateTask applies clear -> remove (validated, renumbered) -> append
- MCP: task_edit commentRemove/commentClear with conflict validation
- Server: task update API passthrough
- Web: per-comment hover X delete button and 'Clear comments' header button (both visible without edit mode, gated by !isFromOtherBranch), 4 locales
- Guides: agent-guidelines, mcp (overview/overview-tools/task-execution), cli-instructions (overview/task-execution), README — including guidance that editing an existing comment's body/author must use the text replacement tool (Edit) on the task file

Verification:
- bun test src/test/comments.test.ts (21 pass), src/test/mcp-tasks.test.ts (30 pass), src/test/server-search-endpoint.test.tsx, src/test/web-task-details-modal-final-summary.test.tsx (17 pass)
- bunx tsc --noEmit clean (excluding pre-existing tmp/ repro errors)
- bun run check clean on touched files (pre-existing src/core/assets.ts warnings only)
- Live smoke on BACK-623: append/remove/clear round-trip via bun run cli
<!-- SECTION:FINAL_SUMMARY:END -->

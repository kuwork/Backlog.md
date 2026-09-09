---
title: BACK-623 Add --remove-comment and --clear-comments support to task edit
created_date: '2026-09-08 17:40'
updated_date: '2026-09-08 17:40'
labels:
  - source
  - cli
  - mcp
  - web-ui
  - comments
source_path: backlog/tasks/back-623 - Add-remove-comment-and-clear-comments-support-to-task-edit.md
---

# BACK-623 Add --remove-comment and --clear-comments support to task edit

Task comments were append-only: every surface (CLI --comment, MCP commentsAppend, server API, Web UI) could add comments but never delete them, forcing hand-edits of task markdown that break metadata sync. This task adds comment deletion across all surfaces — CLI flags with core/serializer support, MCP task_edit parity, server passthrough, Web UI per-comment deletion and a Clear-comments header button — with deterministic renumbering by position after removal (indexes are not persisted, per BACK-470).

## Summary

- Core (`src/core/backlog.ts` updateTask): applies clear → remove (indexes validated, 'Comment #N not found' with available-index hint, filter, renumber by position) → append; works for the current delimited format and legacy `<!-- COMMENT:BEGIN -->` blocks; removal flows into search indexing and plain/JSON output
- CLI (`src/cli.ts`): `task edit --remove-comment <index>` (repeatable) and `--clear-comments`, mutually exclusive with `--comment`; enhancement — `--remove-comment` also accepts comma-separated indexes (2,3) via the shared `parsePositiveIndexList` helper in `src/utils/task-builders.ts`, so --remove-ac/--check-ac/--uncheck-ac/--remove-dod/--check-dod/--uncheck-dod accept commas too
- MCP: `task_edit` schema gains commentRemove/commentClear (`src/mcp/utils/schema-generators.ts`) with clear-conflict validation in the handler
- Server: task update API passthrough; Web (`TaskDetailsModal.tsx`): per-comment hover-X delete and 'Clear comments' header button — both visible without edit mode after user feedback, reversing BACK-470's edit-mode-only gating (gated only by !isFromOtherBranch), 4 locales
- Guides: agent-guidelines, mcp (overview/overview-tools/task-execution), cli-instructions (overview/task-execution), README — including the rule that editing an existing comment's body/author has no CLI flag and must use the text replacement tool (Edit) on the task file directly
- Tests: comments.test.ts (+7, 22 pass), mcp-tasks (+1), server-search-endpoint extended, web modal (+2); live smoke on the BACK-623 file via `bun run cli`

## Acceptance Criteria

- --remove-comment removes the comment at the given 1-based position and rejects out-of-range indexes; repeatable; --clear-comments removes the whole section
- Remaining comments renumber deterministically by position
- Removal works for current delimited format and legacy COMMENT blocks
- MCP task_edit exposes equivalent commentRemove/commentClear inputs
- Removal reflected in search indexing and plain/JSON output
- Guides updated; agent instructions state body/author edits go through the text replacement tool on the task file
- Web UI exposes a delete action per comment through the server API

## Related Concepts

- [[concepts/task-comments]] — comment storage format, position-based indexing, and deletion semantics
- [[concepts/mcp-workflow]] — task_edit parity for commentRemove/commentClear
- [[concepts/cli-instructions]] — guideline surfaces synced (append-only wording replaced)

## Related Sources

- [[sources/back-470-task-comments]] — the original append-only comment design this task extended with removal

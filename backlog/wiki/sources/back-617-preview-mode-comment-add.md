---
title: BACK-617 Add comments directly from task detail view
created_date: '2026-09-07 08:25'
updated_date: '2026-09-07 08:25'
labels:
  - source
  - web-ui
  - comments
source_path: backlog/tasks/back-617 - Add-comments-directly-from-task-detail-view.md
---

# BACK-617 Add comments directly from task detail view

In the Web UI, adding a task comment was only possible while the task details modal was in edit mode, forcing users into edit mode just to leave a comment. The comment form now renders whenever the task is locally editable — including preview mode — reusing the existing server comment append API; cross-branch read-only tasks keep the form hidden.

## Summary

- `src/web/components/TaskDetailsModal.tsx`: comment form renders whenever `!isFromOtherBranch`, not only in edit mode; `handleAddComment` no longer sets `preserveEditModeAfterCommentRefresh` outside edit mode, so a preview-mode add refreshes data without switching to edit
- Simplification: removed the `preserveEditModeAfterCommentRefresh` ref (legacy from BACK-470) — mode preservation across refreshes now relies solely on `modeRef`, which also fixes the edge case where canceling edit after adding a comment forced the modal back into edit mode
- Comment author input gained `placeholder-gray-400 dark:placeholder-gray-500` (was rendering white-ish in dark mode)
- i18n: zh-CN/zh-TW `placeholderCommentAuthor` changed from 作者/作者 to 评论人/評論人; en/ja unchanged
- `src/test/web-task-details-modal-final-summary.test.tsx`: updated preview assertions + new preview-mode add test; full bun test 2176 pass / 0 fail

## Acceptance Criteria

- Task detail page allows adding a comment directly in preview (non-edit) mode
- After submitting, the comment list updates immediately and the modal does not switch to edit mode
- Read-only (cross-branch) tasks show only the comment list without the input form
- Web/server tests cover adding a comment from preview mode

## Related Concepts

- [[concepts/task-comments]] — comment append flow and preview/edit mode gating
- [[concepts/web-ui-features]] — TaskDetailsModal mode handling and cross-branch read-only behavior

## Related Sources

- [[sources/back-470-task-comments]] — the original comment feature whose edit-mode-only gating this task relaxed

---
id: BACK-617
title: Add comments directly from task detail view
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-07 06:44'
updated_date: '2026-09-07 08:25'
labels:
  - comments
  - web-ui
dependencies: []
references:
  - src/web/components/TaskDetailsModal.tsx
  - src/server/index.ts
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/web-task-details-modal-final-summary.test.tsx
ordinal: 220400
actual_start: '2026-09-07 07:35'
actual_end: '2026-09-07 08:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the current Web UI, adding a task comment is only possible while the task details modal is in edit mode, forcing users to enter edit mode just to leave a comment.

This task improves the comment interaction: the comment form is available directly on the task details page (preview mode), so users can add comments without entering edit mode.

Scope: Web UI (TaskDetailsModal) reusing the existing server comment append API; read-only (cross-branch) tasks keep the form hidden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task detail page allows adding a comment directly in preview (non-edit) mode
- [x] #2 After submitting a comment the comment list updates immediately and the modal does not switch to edit mode
- [x] #3 Read-only (cross-branch) tasks still show only the comment list without the input form
- [x] #4 Web/server tests cover adding a comment from preview mode
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TaskDetailsModal.tsx: render the comment form whenever the task is locally editable (!isFromOtherBranch), not only in edit mode.
2. handleAddComment: only set preserveEditModeAfterCommentRefresh when currently in edit mode, so a preview-mode comment add refreshes data without switching the modal to edit mode.
3. Update web modal comment tests: preview now shows the form; add a test covering preview-mode add staying in preview; keep cross-branch form-hidden coverage.
4. Run bunx tsc --noEmit, bun run check ., and scoped bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented preview-mode comment add in TaskDetailsModal:
- Comment form now renders whenever the task is locally editable (!isFromOtherBranch), including preview mode (previously edit mode only).
- Simplification: removed the preserveEditModeAfterCommentRefresh ref (legacy from BACK-470); mode preservation on refresh now relies solely on modeRef, which also fixes the edge case where canceling edit after adding a comment forced the modal back into edit mode.
- Comment author input: added missing placeholder-gray-400 dark:placeholder-gray-500 classes (was rendering white-ish in dark mode).
- i18n: zh-CN/zh-TW placeholderCommentAuthor changed from 作者/作者 to 评论人/評論人; en/ja unchanged.
- Tests: updated preview assertions in web-task-details-modal-final-summary.test.tsx and added a preview-mode add test verifying the modal stays in preview after submit.

Full verification: bun test (2176 tests across 237 files) passed with 0 failures; an earlier run showed 2 flaky failures (git blob temporarily unavailable) that did not reproduce.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Web task detail modal now allows adding comments directly in preview mode, without entering edit mode.

Changes:
- TaskDetailsModal: comment form renders for every locally editable task (removed the edit-mode-only condition); cross-branch read-only tasks still hide the form.
- Removed the redundant preserveEditModeAfterCommentRefresh ref; mode across refreshes is handled by modeRef alone.
- Comment author input placeholder styled with placeholder-gray-400 dark:placeholder-gray-500 (was unreadable white in dark mode).
- i18n: zh-CN/zh-TW author placeholder is now 评论人/評論人.

Verification:
- bunx tsc --noEmit
- bun run check (only pre-existing warnings in src/core/assets.ts)
- bun test src/test/web-task-details-modal-final-summary.test.tsx (14 pass), web-task-details-modal-unsaved-navigation.test.tsx (6 pass); full bun test running
<!-- SECTION:FINAL_SUMMARY:END -->

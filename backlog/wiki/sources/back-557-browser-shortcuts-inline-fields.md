---
title: BACK-557 Prevent browser shortcuts intercepting inline task fields
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - web-ui
  - keyboard
  - bug
source_path: backlog/tasks/back-557 - Prevent-browser-shortcuts-from-intercepting-inline-task-fields.md
---

# BACK-557 Prevent browser shortcuts intercepting inline task fields

Fixed global task-detail shortcuts so they no longer intercept ordinary text entry in inline-editable controls while continuing to work outside editable targets.

## Summary

- Added an ancestor-aware editable-target predicate in `src/web/components/TaskDetailsModal.tsx` covering `input`, `textarea`, `select`, and `content-editable` (including nested descendants via `closest()`).
- Gated only the preview-mode `e`/`E`/`c`/`d`/`p` shortcut branches with the predicate; edit-mode `Escape` and `Cmd/Ctrl+S` branches remain active inside editable fields.
- Moved the guard after the edit-mode branches so the previous top-of-handler guard no longer wrongly intercepts edit-mode shortcuts.
- Added a focused keyboard test verifying editable targets keep literal keystrokes and non-editable shortcuts stay active.

## Related Concepts

- [[concepts/web-ui-features]] — Web UI task editing and keyboard behavior

## Related Sources

- [[sources/task-edit-modal-keyboard-fix]] — BACK-494 keyboard shortcut vs input conflict fix

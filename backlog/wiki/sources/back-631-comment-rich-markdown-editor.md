---
title: BACK-631 Replace the web comment input with the rich markdown editor
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - comments
source_path: backlog/tasks/back-631 - Replace-the-web-comment-input-with-the-rich-markdown-editor.md
---

# BACK-631 Replace the web comment input with the rich markdown editor

The task modal Comments section was the last plain-textarea surface in the modal while the description, plan, notes and final summary all used PasteAwareMDEditor — and saved comments were already rendered as markdown. This task swapped the textarea for the shared editor and deleted the redundant comment-specific autocomplete plumbing.

## Summary

- `TaskDetailsModal.tsx` only: comment textarea replaced by PasteAwareMDEditor (preview=edit, height 200, theme-aware, placeholder via textareaProps), gaining the markdown toolbar, paste-as-markdown, image/docx drop upload and entity-link autocomplete
- Deleted the comment-specific wiring the shared editor makes redundant: `commentTextareaEl` state, the `commentAutocomplete` hook call, the `EntityLinkAutocompleteMenu` render and both imports
- Insert-HR command dropped from this editor via a module-level `COMMENT_EDITOR_COMMANDS` filter, because the comment serializer rejects standalone `---` lines and that command always emits one
- Follow-up fix (user report: pasted images stayed in `.temp`): `handleAddComment` now follows the task-description promotion path — `extractTempImageUrls` → `apiClient.promoteAssets` → `replaceTempImageUrls` — and writes the rewritten body back into editor state so a failed save retries against permanent URLs
- Storage unchanged: comment saved as markdown text, author field separate, `---` rejection guard kept
- Verified in a real browser on a throwaway task: theme in light/dark, ID-prefix autocomplete inserting a markdown link, real paste events promoted `/assets/.temp/<uuid>.png` to `assets/paste`; 66 modal tests pass

## Acceptance Criteria

- New-comment input is the same rich markdown editor as the task description, following the modal theme
- Author input, save/disabled states, unsaved-draft guard and `---` rejection unchanged
- Comment-specific autocomplete state, menu and imports removed from TaskDetailsModal
- Images pasted into a comment are promoted from `assets/.temp` to `assets/paste` before storage

## Related Concepts

- [[concepts/task-comments]] — comment storage and serialization rules the editor must respect
- [[concepts/paste-as-markdown]] — paste/drop pipeline the shared editor provides
- [[concepts/asset-management]] — `.temp` → `paste` asset promotion pattern applied on save
- [[concepts/web-ui-features]] — task modal editing surfaces

## Related Sources

- [[sources/back-470-3-server-web-task-comments]] — earlier web comments surface this editor replaces the input of
- [[sources/back-617-preview-mode-comment-add]] — BACK-617 comment entry added in preview mode
- [[sources/back-632-decision-image-promotion]] — same latent `.temp` defect fixed next for decisions

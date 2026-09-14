---
id: BACK-631
title: Replace the web comment input with the rich markdown editor
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-14 05:17'
updated_date: '2026-09-14 05:28'
labels:
  - web-ui
dependencies: []
priority: medium
ordinal: 232400
actual_start: '2026-09-14 04:30'
actual_end: '2026-09-14 05:35'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task modal Comments section accepts new comments through a plain textarea (BACK-617 / BACK-623), while the description, implementation plan, notes and final summary all use PasteAwareMDEditor - markdown toolbar, keyboard shortcuts, paste-as-markdown, docx/image drop upload and [[ entity-link autocomplete. Saved comments are already rendered as markdown through MermaidMarkdown, so the input is the last plain-text surface in the modal.

Replace the textarea with PasteAwareMDEditor so authoring a comment matches authoring the description, and delete the comment-specific entity-autocomplete plumbing that the shared editor makes redundant.

Storage is unchanged: a comment is still saved as markdown text in the task file, the author field stays separate, and the existing guard that rejects standalone '---' delimiter lines stays in place. Because that guard rejects the Insert-HR command's output unconditionally, the command is removed from this editor's toolbar.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The new-comment input in the Comments section is the same rich markdown editor used for the task description (markdown toolbar and shortcuts, paste-as-markdown, image/docx drop upload, [[ entity-link autocomplete) instead of a plain textarea
- [x] #2 The comment editor follows the modal theme in both light and dark mode
- [x] #3 The author input, Add comment button, saving and disabled states, the unsaved-draft guard and the standalone '---' rejection are unchanged, and a saved comment is stored as markdown and rendered as before
- [x] #4 The Insert-HR command is not offered by the comment editor because its output is always rejected by the comment serializer
- [x] #5 The comment-specific autocomplete state, menu and imports are removed from TaskDetailsModal so [[ autocomplete is wired only by the shared editor
- [x] #6 The tsc noEmit check passes and the task modal / comment tests pass
- [x] #7 Images pasted into a comment are promoted out of assets/.temp to assets/paste before the comment is stored, exactly as the description, plan, notes and final summary fields do, so a saved comment never references a temporary asset that the temp cleanup would delete
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In TaskDetailsModal.tsx replace the comment textarea block with PasteAwareMDEditor (preview=edit, fixed height, theme-aware, placeholder via textareaProps) inside the same bordered container used by the description editor.
2. Delete the comment-specific autocomplete wiring: the commentTextareaEl state, the commentAutocomplete hook call, the EntityLinkAutocompleteMenu render and the now-unused imports.
3. Drop the Insert-HR command from the comment editor toolbar (commands.getCommands().filter(name !== 'hr')).
4. Verify in the real browser on a throwaway task: editor renders in light and dark, [[ autocomplete opens, a markdown comment saves and renders, the Add button stays disabled while empty, and no HR button is present.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed src/web/components/TaskDetailsModal.tsx only.

- The comment form's textarea is now PasteAwareMDEditor, mirroring the description editor: preview=edit, height 200, data-color-mode=theme, placeholder passed through textareaProps. It brings the markdown toolbar and shortcuts, paste-as-markdown, image and docx drop upload, and the entity-link autocomplete.
- Deleted the comment-specific autocomplete plumbing that the shared editor already provides: the commentTextareaEl state, the commentAutocomplete hook call, the EntityLinkAutocompleteMenu render, and both imports. No duplicate wiring remains in the file.
- Added a module-level COMMENT_EDITOR_COMMANDS that drops the Insert-HR command, because the comment serializer rejects standalone '---' lines and that command always emits one.

Follow-up fix (user report: pasted images stayed in .temp after adding a comment): handleAddComment never promoted temporary assets, unlike handleSave. It now follows the same three steps as the task description path: extractTempImageUrls(body) -> apiClient.promoteAssets(urls) -> replaceTempImageUrls(body, mapping), and it writes the rewritten body back into the editor state with setCommentBody so a failed save can be retried against the permanent URLs instead of re-promoting an already-moved file.

Verification on a throwaway task, deleted again afterwards:
- Editor renders as the only .w-md-editor in preview mode, 200px tall, placeholder 添加评论..., full markdown toolbar, no Insert-HR button.
- Entity autocomplete: typing BACK-6 opened the menu with TASK BACK-600..604 and Enter inserted see [BACK-600](/task/600). The trigger is a bare ID prefix, not a [[ prefix.
- Image promotion, exercised twice with a real paste event carrying a PNG: the editor first held ![image](/assets/.temp/<uuid>.png); after clicking 添加评论 the stored comment body held ![image](/assets/paste/<uuid>.png), the .temp file was gone from disk, the file existed under assets/paste, and the modal rendered the image from the permanent URL. The editor cleared after saving.
- Dark mode: editor reported data-color-mode=dark with background rgb(30,41,59) and text rgb(241,245,249), matching the description editor.

Known related gap (not part of this task): DecisionDetail.tsx also uses PasteAwareMDEditor and saves through apiClient.updateDecision without any promoteAssets call, so pasted images in decisions stay in .temp too.

Checks: bunx tsc --noEmit passes; bun test over the 8 modal-touching files - 66 pass / 0 fail, plus 43 pass on the three suites re-run after the promotion fix; bun run check . reports the 3 pre-existing warnings and no errors (biome.json ignores src/web).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web task modal now accepts comments through the same rich markdown editor as the task description.

Why: the comment input was the last plain textarea in the modal while the description, plan, notes and final summary all use PasteAwareMDEditor, and saved comments were already rendered as markdown.

Changes:
- src/web/components/TaskDetailsModal.tsx: comment textarea replaced by PasteAwareMDEditor; comment-specific entity-autocomplete state, menu and imports removed; Insert-HR command dropped from this editor because standalone '---' lines are rejected by the comment serializer

Verification:
- real browser on a throwaway task: editor renders and follows the theme in light and dark, ID-prefix autocomplete opens and inserts a markdown link, a comment saves as markdown and renders as a link
- bunx tsc --noEmit
- 66 modal tests pass (8 files), bun run check . has no errors
<!-- SECTION:FINAL_SUMMARY:END -->

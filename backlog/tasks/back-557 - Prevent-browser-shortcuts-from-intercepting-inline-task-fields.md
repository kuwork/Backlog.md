---
id: BACK-557
title: Prevent browser shortcuts from intercepting inline task fields
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-07-30 17:11'
updated_date: '2026-08-15 06:23'
labels:
  - web
dependencies:
  - BACK-494
references:
  - src/web/components/TaskDetailsModal.tsx
priority: high
actual_start: '2026-08-15 06:17'
actual_end: '2026-08-15 06:21'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Global task-detail shortcuts intercept ordinary text entry in inline-editable controls because the capture-phase key handler does not distinguish editable event targets. User-entered text must remain intact while the existing preview shortcuts continue to work outside editable controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-558 and git show deedb4e as implementation reference.
- [x] #2 In task preview, typing e or E in assignee, labels, references, title, or dependencies does not prevent the keystroke or enter full edit mode.
- [x] #3 Preview shortcuts do not intercept keystrokes originating from input, textarea, select, or content-editable targets (including nested editable descendants).
- [x] #4 The c completion shortcut follows the same editable-target rule.
- [x] #5 Plain e or E outside editable controls still opens edit mode.
- [x] #6 Existing edit-mode Escape and Cmd/Ctrl+S behavior remains unchanged.
- [x] #7 Automated tests and rendered browser QA cover inline text entry and preserved shortcut behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add one ancestor-aware editable-target predicate in src/web/components/TaskDetailsModal.tsx (input, textarea, select, and content-editable, including nested editable descendants via closest()).
2. Gate only the preview e/E and c shortcut branches (around :450/:455) with the predicate, returning before interception when the event originates in an editable target; leave edit-mode Escape and Cmd/Ctrl+S branches unchanged. The d/p preview branches share the same editable-target rule.
3. Add a focused keyboard test that mounts the real component and reproduces e/E interception across input, textarea, select, and content-editable targets, proves c is protected, and confirms non-editable e/E, edit-mode Escape, and Cmd/Ctrl+S remain active.
4. Run the focused and related Web task-detail tests, bunx tsc --noEmit, bun run check, and rendered browser QA.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fork already had BACK-494's isTypingTarget guard (input/textarea/contenteditable) at the top of the TaskDetailsModal keydown handler. BACK-558 gap analysis: 1) SELECT was not covered (priority/milestone inline selects); 2) contenteditable descendants were missed because jsdom does not expose isContentEditable on child spans; 3) the top-of-handler guard wrongly intercepted edit-mode Escape and Cmd/Ctrl+S, which BACK-558 requires to keep working inside editable fields. Fixed: isTypingTarget now covers SELECT and uses closest() for contenteditable ancestors; the guard moved from the handler top to after the edit-mode branches, and the redundant mode === preview prefixes were dropped from the c/d/p branches (the guard already excludes non-preview).

Validation: new web-task-details-modal-keyboard-shortcuts.test.tsx (6 tests, adapted from upstream with fork MemoryRouter+I18nProvider+ThemeProvider setup) passes 6/6; existing modal regression 15 pass (documentation test 2 fails pre-exist without these changes, verified via git stash); bunx tsc --noEmit passes; biome check passes on keyboard.ts (tsx files are outside biome includes).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prevented task-detail preview shortcuts (e/E, c, d, p) from intercepting typing in inline-editable fields. Extended the existing isTypingTarget helper to cover SELECT and contenteditable descendants via closest(), and moved the guard after the edit-mode branches so edit-mode Escape and Cmd/Ctrl+S keep working inside editable fields (BACK-558 requirement). Verified by 6 new keyboard-shortcut tests (editable targets keep e/E/c literal; non-editable e/E/c shortcuts stay active; Escape and Cmd/Ctrl+S still work in edit inputs), typecheck, and regression runs.
<!-- SECTION:FINAL_SUMMARY:END -->

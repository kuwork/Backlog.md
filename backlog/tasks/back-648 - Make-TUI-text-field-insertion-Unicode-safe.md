---
id: BACK-648
title: Make TUI text field insertion Unicode-safe
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-07 20:48'
updated_date: '2026-09-17 20:30'
labels:
  - tui
dependencies: []
references:
  - src/ui/components/task-composer.ts
  - src/test/tui-task-composer.test.ts
modified_files:
  - src/ui/components/task-composer.ts
  - src/test/tui-task-composer.test.ts
  - src/test/tui-task-composer-unicode.test.ts
priority: low
actual_start: '2026-09-17 20:26'
actual_end: '2026-09-17 20:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI task composer lets users type into a Title and a Description field. Insertion is currently delegated to the vendored `neo-neo-bblessed` widgets, and those compute the caret offset in terminal display cells while slicing the JavaScript string by UTF-16 index. The two disagree as soon as an astral character is present, so a printable keystroke typed next to one lands between its surrogate halves. The unpaired surrogates are then written out as replacement characters and persist in the saved task file.

Concretely, with `A😀B` in a field, pressing Left and typing `X` corrupts the emoji and the saved task file silently. Any emoji, CJK-adjacent astral character or flag sequence in a title or description triggers it, which makes the defect directly relevant to this fork's CJK usage.

The fork already solves the same problem for deletion: `deletionStart`/`deletionEnd` in `src/ui/components/task-composer.ts` snap Backspace/Ctrl+W/Delete onto surrogate pairs, and the composer owns those keys through `ownInputKeys`. Insertion was left with the widget default, so only the insertion path is unsafe. The caret conversion helpers `caretIndexFromCursor` and `cursorFromCaretIndex` in the same file are also still the original UTF-16 implementations: they use `String.prototype.length` on the widget's wrapped lines and know nothing about display width or the widget's internal wide-character placeholder.

Deliverable: make the caret conversion display-width aware and code-point safe, and own printable insertion for both text fields through the same mutation and caret-repositioning path deletion already uses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-592 and git show bc96f2310 as implementation reference.
- [x] #2 caretIndexFromCursor and cursorFromCaretIndex resolve a display-cell cursor to a complete code-point boundary, ignore the widget's internal wide-character placeholder, and remain exact inverses for indexes on either side of an astral character.
- [x] #3 A printable keystroke typed in the Title field next to an astral character never splits its surrogate pair, and the persisted task file keeps the original character with no replacement characters.
- [x] #4 The same holds for the Description field, including when the astral character sits mid-field rather than at an edge.
- [x] #5 The caret lands where the user aimed after such an insertion, never between the surrogates; an edit on an early wrapped line of a long description stays in the viewport.
- [x] #6 Tab, Backspace, Delete, Ctrl+W and every non-printable or control key keep working exactly as before, on both fields.
- [x] #7 A regression test types next to a mid-field astral character in both fields through the real composer and asserts on the persisted file content and the reloaded task.
- [x] #8 bunx tsc --noEmit, bun run check . and the scoped TUI composer tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend `CaretLines` with an optional `displayWidth` hook and add the display-cell helpers the caret math needs: strip the widget's internal wide-character placeholder, snap a candidate index back off a low surrogate, and map a display column to a code-point index.
2. Rewrite `caretIndexFromCursor`/`cursorFromCaretIndex` on top of those helpers so a cursor reported in terminal columns resolves to a complete code point, keeping the existing wrapped-line and logical-newline accounting.
3. Extract the existing delete mutation into a shared `setTextAtCaret` (park the caret, set the value, re-read the wrapped lines, restore the caret, restore the scroll line) and add `insertText` on top of it.
4. Teach `ownInputKeys` to claim printable input via an `isTextInsertion` predicate and route it to `insertText`, leaving Tab/Backspace/Delete interception and every other key untouched.
5. Add a model-level caret round-trip test around a wide astral character and an end-to-end composer test that types into both fields next to a mid-field astral character and asserts on the persisted task bytes and reload.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC1: verified the upstream scope with `git log --oneline v1.50.1..v1.52.0 --grep BACK-592` (implementation commit bc96f2310, PR #907) and `git show bc96f2310` - it touches the composer, the interaction tests and the task file, and the composer mechanics port over unchanged, so the whole fix was re-implemented against the fork's own composer.

AC2-AC5: the composer used to leave printable insertion to the vendored widgets, which report the caret in terminal display cells but slice the value by UTF-16 unit; a keystroke typed next to an astral character therefore landed between its surrogates and the halves persisted as replacement characters. Only insertion was affected - deletion was already owned. caretIndexFromCursor/cursorFromCaretIndex now reconcile the two units: CaretLines gained an optional displayWidth hook fed from the widget's own strWidth (falling back to one cell per code point), the widget's internal \x03 wide-character placeholder is stripped before any counting, a display column is mapped through indexAtDisplayColumn to a code-point start instead of a raw UTF-16 offset, and the result is snapped with safeCodePointBoundary so no index can land inside a surrogate pair. The delete mutation was extracted into a shared setTextAtCaret (park the caret on the last line, set the value, re-read the wrapped lines, restore the caret, restore the scroll row) and insertText was added on top of it, so insertion and deletion reposition identically. Restoring the scroll row is a real behavior change rather than a refactor detail: without it an insertion leaves the viewport parked on the last wrapped line. ownInputKeys claims printable input through an isTextInsertion predicate and routes it to insertText, with the Tab/Backspace/Delete interception still checked first, so every other key keeps its previous path.

AC6: the widget hooks were probed rather than assumed. neo-neo-bblessed's Textbox extends Textarea, and strWidth/setScroll are prototype methods on Element/Textarea that the bundled index.d.ts does not declare for textbox, so they are read through the internal ComposerInput type that already handled _clines/_cursor; both were confirmed present at runtime (strWidth("𠮷") === 2). The model-level guard walks every display column of A𠮷B and asserts the conversion never yields the index between the surrogates and never produces U+FFFD when the caret is used to splice.

AC7: this fork had no composer interaction coverage at all - when the upstream test file was split for BACK-563 only the model cases came across, so nothing had ever driven openTaskComposer here. src/test/tui-task-composer-unicode.test.ts adds that harness (createScreen, emitted keypress events, core.createTaskFromInput as persist) and runs the composer for real at 100x30 against a project built by initializeTestProject. Title A𠮷B plus two Left presses onto the wide character's second cell then X gives AX𠮷B at caret { x: -3, y: 0 }; description "left 𠮷 right" with the caret walked seven columns back then Y gives "left Y𠮷 right" at caret { x: -8, y: 0 }. The persisted task file carries `title: "AX\U00020BB7B"` (YAML escapes the astral) and a literal `left Y𠮷 right` in the Markdown body, with no U+FFFD and no \uD842, and the reload returns both strings intact. A second case asserts an edit on an early wrapped line of a long description leaves childBase off the final row. The upstream commit also re-numbered a putCaret(4) call in its interaction test, but that test exists only upstream, so there was nothing to port.

AC8: bunx tsc --noEmit clean; bun run check . over 413 files with 0 errors and only the 3 pre-existing noNonNullAssertion warnings in src/core/assets.ts; the scoped run over the 9 composer/board/list/rendering files gives 48 pass, 4 skip (the pre-existing PTY handoff skips), 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI composer's Title and Description fields are now Unicode-safe. The caret widget cursor, which arrives in terminal display cells, is translated to a complete UTF-16 code-point boundary - with the widget's wide-character placeholder stripped and the widget's own strWidth used for width - and printable insertion is owned by the composer through the same mutation and caret-repositioning path deletion already used. Typing next to an emoji, a CJK-adjacent astral character or any other surrogate pair can no longer split it, so no replacement characters reach the saved task file.

The fix was verified through the real composer rather than only at the model level: a headless screen at 100x30 typed into both fields next to a mid-field astral character, then the canonical task file was read off disk and the task reloaded. The title round-trips as AX𠮷B and the description as "left Y𠮷 right", the file keeps the complete code point in both its YAML and Markdown forms, and the caret ends up where the user aimed. This fork had no composer interaction coverage before - nothing here had ever driven openTaskComposer - so the harness is new alongside the regression. TypeScript, Biome over the whole repository, and the nine-file scoped TUI suite all pass.
<!-- SECTION:FINAL_SUMMARY:END -->

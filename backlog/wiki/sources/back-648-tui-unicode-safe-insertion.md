---
title: BACK-648 Make TUI text field insertion Unicode-safe
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
source_path: backlog/tasks/back-648 - Make-TUI-text-field-insertion-Unicode-safe.md
---

# BACK-648 Make TUI text field insertion Unicode-safe

The TUI task composer delegated printable insertion to the vendored neo-neo-bblessed widgets, which compute the caret in terminal display cells but slice the string by UTF-16 index — typing next to an astral character (emoji, CJK extension, flag) split its surrogate pair and persisted replacement characters into the task file. Insertion is now owned by the composer through the same code-point-safe path deletion already used. Ports upstream BACK-592.

## Summary

- `caretIndexFromCursor`/`cursorFromCaretIndex` in `src/ui/components/task-composer.ts` reconciled the two units: `CaretLines` gained an optional `displayWidth` hook fed from the widget's own `strWidth` (fallback one cell per code point), the widget's internal `\x03` wide-character placeholder is stripped before counting, `indexAtDisplayColumn` maps a display column to a code-point start, and `safeCodePointBoundary` snaps any index off a low surrogate
- The delete mutation was extracted into a shared `setTextAtCaret` (park caret, set value, re-read wrapped lines, restore caret, restore scroll row) with `insertText` on top — restoring the scroll row is a real behavior fix: without it an insertion left the viewport parked on the last wrapped line
- `ownInputKeys` claims printable input via an `isTextInsertion` predicate and routes it to `insertText`; Tab/Backspace/Delete interception is still checked first, so every other key keeps its previous path
- Widget capabilities were probed at runtime rather than assumed: `strWidth`/`setScroll` are prototype methods the bundled index.d.ts does not declare for textbox, read through the existing internal `ComposerInput` type (`strWidth("𠮷") === 2` confirmed)
- This fork had no composer interaction coverage at all (only model cases came across in the BACK-563 test split); new `src/test/tui-task-composer-unicode.test.ts` drives `openTaskComposer` for real on a headless 100x30 screen, typing next to mid-field astral characters in both fields and asserting on persisted file bytes (`AX𠮷B`, `left Y𠮷 right`, no U+FFFD) and reload
- Gates: tsc clean, biome 0 errors, 48 pass / 4 skip (pre-existing PTY skips) across the 9-file scoped TUI set

## Acceptance Criteria

- Caret conversion resolves display-cell cursors to complete code-point boundaries and ignores the widget placeholder; exact inverses around astral characters
- Typing next to an astral character in Title or Description never splits the pair; the persisted file keeps the original character
- Caret lands where aimed; editing an early wrapped line of a long description stays in the viewport
- Tab/Backspace/Delete/Ctrl+W and all control keys behave exactly as before

## Related Concepts

- [[concepts/cli-tui]] — composer input ownership via `ownInputKeys`
- [[concepts/upstream-migration]] — ports upstream BACK-592 (commit bc96f2310, PR #907)

## Related Sources

- [[sources/back-563-tui-intent-first-composer]] — composer rework whose test split dropped the interaction coverage this task re-creates
- [[sources/back-587-repair-tui-task-composer-ux]] — adjacent composer UX repair

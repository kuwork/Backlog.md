---
id: BACK-679
title: Support mouse clicks in the TUI task composer
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-07 20:45'
updated_date: '2026-09-21 06:15'
labels:
  - tui
dependencies: []
references:
  - src/ui/components/task-composer.ts
  - src/test/tui-task-composer-mouse.test.ts
modified_files:
  - src/ui/components/task-composer.ts
  - src/test/tui-task-composer-mouse.test.ts
priority: low
actual_start: '2026-09-21 05:50'
actual_end: '2026-09-21 06:05'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mouse support in the TUI composer is only half wired: a click can move focus but never enters the read state, which is worse than not supporting the mouse at all.

Reproduced on a real blessed screen at 100x30 through the real mouse dispatch path (`program.emit("mouse", ...)` with coordinates taken from the rendered `lpos`): after clicking Description, `screen.focused` did become description, but `_reading` was `undefined`, the border stayed gray and **Title kept its yellow highlight**, while the following "Clicked description" keystrokes never landed in the field (`getValue()` stayed `""`). Keyboard navigation followed by a click back on Title showed the same symptom (`_reading=false`, "First" lost). What the user sees is a wedged composer: the previous control stays highlighted and typing does nothing.

Two layers of root cause. (1) The two text fields are created with `inputOnFocus: false` and carry no click handler at all, so nothing routes them into the existing `focusField` / `readInput` path. (2) The selectors do have a click handler, but it neither went through `focusField` first nor returned a value, so blessed's ancestor-chain `element click` autofocus focuses the same widget a second time - and the `screen.focused` setter goes through `_focus(el, old)`, which **unconditionally** emits `old.emit("blur")`. The widget therefore blurs itself, and the blur handler that `readInput` registered immediately flips `_reading` back to false.

The composer has no Type selector, so the surface is Title / Description / Status / Priority. Expected behaviour: clicking a field gives that field sole highlight and enters the read state - text fields show a cursor and accept typing immediately, selectors open the existing picker - while keyboard navigation, action buttons, persistence and layout behaviour stay unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-590` and `git show b2fecd1d` as implementation reference, and confirm each change against the fork before porting it - the composer is self-authored here, so the port targets the fork's own insertion point rather than an upstream file
- [x] #2 Clicking either composer text field (Title / Description) leaves it solely highlighted and in the read state: `screen.focused` is the clicked field, `_reading === true`, `getCursor()` returns a value, and the following keystrokes land in that field - measured at 100x30, typing "Clicked description" after clicking Description makes `getValue()` equal that string, where the pre-change code still returned ""
- [x] #3 The previously highlighted control visibly loses its highlight on click: the clicked text field's border is yellow while the other text field's border returns to gray - measured with the Title border going from yellow to gray
- [x] #4 Navigating away from Title with the keyboard and then clicking Title behaves like the first click: it enters the read state and accepts further input - measured with the typed "First" landing in Title
- [x] #5 Clicking the already-active Title again does not drop the read state: `_reading === true` still holds and later input is appended to the same value
- [x] #6 Clicking Status / Priority opens its picker with entries equal to that field's full configured option set (including the existing construction rules such as Draft / None), and confirming returns focus to the clicked selector; the composer has no Type selector, so Type is out of scope
- [x] #7 The effect of the click handler's `return false` bubbling cut is pinned by a test: after a click the field is still in the read state and the "same widget focuses twice -> self-blur -> `_reading` flips false" path does not occur; that assertion must go red when `return false` is removed
- [x] #8 The task notes record the measured values and the evidence boundary of the real-screen, real-mouse dispatch path, and keyboard navigation, action buttons, persistence and layout behaviour are unchanged (the neighbouring composer / board suites stay green)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Route the `click` of Title / Description / Status / Priority into the existing `focusField` transition through one loop: text fields thereby reuse the readInput / caret behaviour and selectors keep the existing openPicker; delete the selector's previous click handler that only opened the picker without going through `focusField`.

2. Have the handler `return false` to cut the bubbling: this stops blessed's ancestor-chain `element click` from focusing the same widget a second time (which self-blurs through `_focus(el, old)`'s `old.emit("blur")`) and cancelling the read state readInput had just established - measured as `_reading` going from true to false once the return is removed.

3. Write the regression through the real mouse dispatch path: `program.emit("mouse", { action: "mousedown" | "mouseup", x, y })` with coordinates taken from the centre of the rendered `lpos`; cover entering the read state with a cursor, sole highlight, typed input landing, re-clicking an active Title, and Status / Priority opening their pickers and restoring focus.

4. Run the focused composer suites, `bunx tsc --noEmit` and `bun run check .`; perform both whole-change and per-clause rollback verification; write the measured values into the task notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Title / Description / Status / Priority `click` handlers now funnel into the existing `focusField` transition through a single loop, and the selector's old click handler - which only opened the picker without going through `focusField` - is gone; the handler returns `false` to cut the bubbling.

**Why `return false` is required (measured mechanism, not an inherited comment)**: blessed's `screen.focused` setter runs `Screen._focus(el, old)`, which **unconditionally** does `old.emit("blur")`. Once the click bubbles to the ancestor-chain `element click`, the screen's autofocus handler focuses the same widget again, so the widget blurs itself and the blur handler `readInput` registered (`_done`) immediately sets `_reading` to false and does `delete this._done` (dist 12823-12832). `__listener` is only attached on the following `nextTick`, so the keypress listener stays in place while `_done` has already been deleted. The measured fallout is not limited to the lost read state: pressing Escape afterwards reaches `_listener`'s `done(null, null)` and throws **TypeError: done is not a function** (dist 12894, observed blowing up in test teardown and smearing into later cases).

**Measurements** (real blessed screen at 100x30 through the real mouse dispatch path `program.emit("mouse", { action: "mousedown" | "mouseup", x, y })`, coordinates taken from the centre of the rendered `lpos`):

- Before the fix: clicking Description did move `screen.focused` to description, but `_reading=undefined`, the border stayed gray and **Title stayed yellow** (the old highlight was never withdrawn); typing "Clicked description" afterwards left `getValue()` at `""`. Clicking Title after keyboard navigation behaved the same (`_reading=false`, "First" lost).
- After the fix: the same two steps give `_reading=true`, a `getCursor()` value, a yellow border on the clicked field and gray on the other, and the input landing as "Clicked description" / "First" respectively; re-clicking the active Title keeps `_reading=true` and appends ("First" then "First again"); clicking Status / Priority opens their pickers with entries equal to `["Draft","To Do","In Progress","Done"]` / `["None","High","Medium","Low"]`, and confirming returns focus to the clicked selector (inverse + bold).

**Surface trim**: the composer has no Type selector, so the criteria cover Status / Priority rather than Status / Type / Priority. The regression drives the real mouse dispatch path instead of emitting `click` on the widget directly (blessed's own hit testing, clickable registration and the bubbling chain all participate) and explicitly asserts that the previously focused text field has given up its highlight while the picker is open - that assertion is the only discriminator for the selector half of the change.

**Rollback matrix** (4 variants x 4 cases, each run on its own): pre-change HEAD -> all 4 red; with only `return false` removed -> the 3 text cases red (stuck on `_reading` true vs false) while the selector case stays green; with the selector skipping `focusField` -> exactly the selector case red; current implementation -> all 4 green. A whole-block rollback also turns the selector case red, since it now depends on the focusField assertion.

**Test-helper pitfall**: letting an exception escape during teardown masks the real assertion failure and makes later cases cascade with `Cannot switch a node's screen` (measured with the guard missing: Escape throws inside blessed and the screen is never destroyed), so `withComposer`'s finally wraps teardown in try/catch and guarantees `screen.destroy()` runs in the finally block. Two-popup teardown order: the first Escape closes the picker, the second cancels the composer.

**Verification**: new `src/test/tui-task-composer-mouse.test.ts` (4 cases / 33 assertions); the 12 neighbouring suites give 88 pass / 0 fail (tui-task-composer 15 / layout 4 / unicode 2 / board-hide-empty-columns 14 / board-render 4 / help-popup 8 / tui-vim-boundary-navigation 5 / tui-emoji-width 4 / tui-acceptance-criteria-progress 18 / generic-list-selection 3 / line-wrapping 7); `bunx tsc --noEmit` clean; `bun run check .` over 432 files reports only the 3 pre-existing `assets.ts` warnings.

**Evidence boundary**: the fork's `createScreen` passes `mouse: process.platform !== "win32"`, so a real PTY mouse event is not reachable on this win32 host (the repository's interactive PTY case `tui-ready-filter-pty` is permanently skipped on win32). The evidence is therefore the widget-level real dispatch path.

**Number collision**: the allocated id duplicates an unrelated entry already registered in the migration ledger (a category-C entry carrying no code of its own here). The fork keeps the number it was handed and renumbers nothing; the ledger row for the collision, and its bookkeeping commit, are left to a separate change per the 2026-09-19 rule to ask first.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Mouse activation in the composer now shares the single `focusField` / `readInput` transition with keyboard navigation: clicking any text field gives it sole highlight and the read state (visible cursor, characters landing immediately), re-clicking the active Title keeps accepting input, and clicking Status / Priority opens the existing picker and hands focus back to the clicked selector on confirm. The load-bearing detail is the click handler's `return false` bubbling cut - without it blessed's ancestor-chain autofocus focuses the same widget twice, self-blurs it through the `screen.focused` setter's `old.emit("blur")`, and the freshly established read state is cancelled at once (measured to make a later Escape throw a TypeError inside blessed). New `src/test/tui-task-composer-mouse.test.ts` covers the read state and cursor, sole highlight, typed input landing, repeated activation and both selectors' pickers through the real mouse dispatch path. Verification: 4 cases / 33 assertions in that file, 88 pass / 0 fail across the 12 neighbouring suites, `bunx tsc --noEmit` clean, `bun run check .` reporting only the 3 pre-existing `assets.ts` warnings, and a rollback matrix (whole change / guard removed / selector bypassing focusField) producing consistent red items.
<!-- SECTION:FINAL_SUMMARY:END -->

---
title: BACK-679 Support mouse clicks in the TUI task composer
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - tui
source_path: backlog/tasks/back-679 - Support-mouse-clicks-in-the-TUI-task-composer.md
---

# BACK-679 Support mouse clicks in the TUI task composer

A mouse click in the TUI composer moved focus but never entered the read state: the previous control kept its yellow highlight and typed characters went nowhere. This task routes all four composer fields' clicks through the existing `focusField`/`readInput` transition, with the load-bearing detail being the click handler's `return false` that stops blessed's ancestor-chain autofocus from re-focusing the same widget and self-blurring it.

## Summary

- Root cause, two layers: text fields had `inputOnFocus: false` and no click handler; the selector handler bypassed `focusField` and did not cut bubbling, so blessed's `screen.focused` setter (`_focus(el, old)` unconditionally emits `old.emit("blur")`) blurred the widget a second time and the `readInput` blur handler flipped `_reading` back to false — a later Escape then threw `TypeError: done is not a function` inside blessed
- `src/ui/components/task-composer.ts`: Title / Description / Status / Priority click handlers funnel into `focusField` through one loop and `return false` to cut bubbling; the selector's old picker-only handler deleted (composer has no Type selector)
- After the fix (measured at 100x30 through the real dispatch path `program.emit("mouse", ...)` from rendered `lpos` centers): clicked field is solely highlighted with `_reading=true` and a cursor, typed text lands immediately, re-clicking the active Title appends, and Status/Priority open their full configured pickers and restore focus on confirm
- New `src/test/tui-task-composer-mouse.test.ts`: 4 cases / 33 assertions; rollback matrix (whole change / `return false` removed / selector bypassing `focusField`) produces consistent red items
- Test-helper pitfall recorded: an exception escaping teardown masks real failures and cascades `Cannot switch a node's screen`, so `withComposer` wraps teardown in try/catch and always destroys the screen
- Evidence boundary: `createScreen` gates mouse on `process.platform !== "win32"`, so evidence is the widget-level real dispatch path rather than a PTY mouse event
- ID note: BACK-679 duplicates a migration-ledger entry; number kept, ledger bookkeeping deferred per the ask-first rule

## Acceptance Criteria

- Clicking a text field leaves it solely highlighted, in read state with a cursor, and subsequent keystrokes land in it; the previously highlighted control visibly loses highlight
- Re-clicking the already-active field keeps the read state and appends input
- Clicking Status/Priority opens the picker with the full configured option set and returns focus on confirm
- A test pins the `return false` bubbling cut (goes red when removed); keyboard navigation, action buttons, persistence and layout unchanged

## Related Concepts

- [[concepts/cli-tui]] — blessed focus/readInput mechanics the fix depends on

## Related Sources

- [[sources/back-678-composer-extreme-terminal-sizes]] — sibling composer task from the same wave, same real-screen evidence approach
- [[sources/back-587-repair-tui-task-composer-ux]] — earlier composer UX repair

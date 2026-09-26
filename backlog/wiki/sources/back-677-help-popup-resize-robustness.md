---
title: BACK-677 Make the TUI help popup robust to resize and wrapped lines
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - tui
source_path: backlog/tasks/back-677 - Make-the-TUI-help-popup-robust-to-resize-and-wrapped-lines.md
---

# BACK-677 Make the TUI help popup robust to resize and wrapped lines

The TUI help popup never called the `reflow` helper its popup chrome already returned, so a terminal resize left the backdrop hanging below a re-centered popup, the popup height frozen at the size it was opened with, and the scroll bound computed from logical shortcut count rather than rendered (wrapped) rows. This task makes the popup lay itself out from the live terminal size and derive scroll bounds from what the renderer actually drew.

## Summary

- `src/ui/components/help-popup.ts`: `getHelpPopupHeight` clamps to the terminal height (`Math.min(screen.height, preferred)`), so the popup is never taller than the screen; width and footer text hoisted into `HELP_POPUP_WIDTH` / `getHelpText(scrolls)` so a layout pass can rebuild both
- `openHelpPopup` takes `reflow` from `createPopupChrome` and adds `getMaxScrollOffset`, `applyLayout` (recompute height → reflow chrome, which re-anchors the backdrop → render → clamp `childBase` to measured bound → reflow again with measured footer) and `onResize` registered on `screen.on("resize")` and removed in the close path
- Scroll bound comes from the viewport's `getScrollHeight()` minus visible height instead of the shortcut count; `scrollBy` reads the current bound rather than the one computed at open; wrapped descriptions at 30x24 now scroll to the final rendered line
- `src/ui/components/filter-popup.ts`: `ScrollableViewport` declares `getScrollHeight(): number` — type-level only, the scrollable box already implements it
- Measured reproduction at 80x24 → 80x12: before, popup `top: -4, height: 21` with backdrop frozen at `top: 0, height: 23`; after, popup `top: 1, height: 10`, backdrop `top: 0, height: 12`
- Tests: 8 tests / 48 assertions in `src/test/help-popup.test.ts`, 3 driving a real screen, each new assertion checked red against the pre-change code and against a backdrop-repositioning rollback; eleven neighbouring TUI suites green
- ID note: BACK-677 collides with an unrelated migration-ledger entry; the fork keeps the allocated number and left the ledger row to separate bookkeeping

## Acceptance Criteria

- Resize with the popup open reflows it: height follows the viewport, border and help row stay on-screen even below the five-row minimum
- Backdrop tracks the popup (top follows popup top, bottom within one row) instead of staying at its drawn geometry
- Scroll bound recomputed from rendered rows on resize; offset clamped; footer hint shows only while content actually overflows; wrapped content scrolls to its last line at 30x24
- Resize listener removed when the popup closes; the four help contexts keep their shortcut lists and `escape/q/Q/?` close keys

## Related Concepts

- [[concepts/cli-tui]] — blessed TUI popup chrome and resize handling
- [[concepts/tui-theme-adaptive]] — neighbouring TUI rendering work in the same surface

## Related Sources

- [[sources/back-563-tui-intent-first-composer]] — the task composer is the other `createPopupChrome` caller that already reflows on resize
- [[sources/back-565-tui-theme-adaptive-scroll]] — earlier TUI scrolling/rendering work on the same helpers

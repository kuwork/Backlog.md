---
title: BACK-678 Improve composer usability at extreme terminal sizes
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - tui
source_path: backlog/tasks/back-678 - Improve-composer-usability-at-extreme-terminal-sizes.md
---

# BACK-678 Improve composer usability at extreme terminal sizes

At 8-row terminals the task composer's bordered inputs rendered as a bare border with no editable row or cursor, and at 80/100 columns the 30%-of-form selectors clipped the trailing ▼ cue of the longest status value, because geometry came from fixed breakpoints. This task derives composer geometry from its content: popup height from chrome plus one complete bordered input, popup width and the compact-layout decision from the longest configured selector content measured in display cells.

## Summary

- `src/ui/components/task-composer.ts`: popup height reserves popup chrome plus one three-row bordered input, so from 8 rows up the focused field keeps an editable row and a painted caret
- Popup width and compact/stacked decision come from the longest configured selector content (status/priority values plus trailing cue) measured with `Bun.stringWidth`, replacing the fixed 64-column breakpoint and fixed 72/96% widths; a normal selector column stays 30% of the form and the popup grows (capped by the terminal and the chrome's four-column backdrop margin) until it fits
- Fork adaptation: upstream's separate `stackSelectors` flag not ported — the fork has no Type selector and its compact layout already stacks both selectors full-width, so a second flag would be dead state
- Measured on real blessed screens: 80x8 scrollable form 1 → 3 rows; at 80x24/100x24 the status selector goes 20 → 21 cells for the 21-cell `Status: In Progress ▼` (popup 72 → 74 columns); a 37-cell configured status switches to stacked compact
- New `src/test/tui-task-composer-layout.test.ts` (4 tests / 72 assertions) drives the real composer at 80x8–10, 80x24, 100x24, 140x24 and 50x18; whole-change and per-clause rollbacks turn exactly the six new assertions red
- Evidence boundary recorded: no genuine PTY run on win32 (the repo's PTY harness self-skips), so evidence is rendered-widget geometry of real blessed screens
- ID note: BACK-678 duplicates an unrelated migration-ledger entry; number kept, ledger left to separate bookkeeping

## Acceptance Criteria

- At terminal heights 8–10 the focused composer field always shows at least one editable row with a visible cursor
- Selector values render unclipped at 80 and 100 columns for the longest shipped status, including the trailing cue
- Compact layout engages whenever the longest configured selector content cannot fit a normal selector column, not only below a fixed threshold
- Field navigation, picker flow, focus graph and persistence unchanged; existing composer suites still pass

## Related Concepts

- [[concepts/cli-tui]] — TUI composer surface and blessed screen testing

## Related Sources

- [[sources/back-677-help-popup-resize-robustness]] — same resize-aware popup chrome (`createPopupChrome`) the composer reflows through
- [[sources/back-563-tui-intent-first-composer]] — earlier composer UX work on the same component
- [[sources/back-587-repair-tui-task-composer-ux]] — prior composer repair wave

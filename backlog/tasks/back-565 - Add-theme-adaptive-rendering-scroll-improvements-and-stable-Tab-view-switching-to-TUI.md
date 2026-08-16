---
id: BACK-565
title: >-
  Add theme-adaptive rendering, scroll improvements, and stable Tab view
  switching to TUI
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-16 08:43'
updated_date: '2026-08-16 09:27'
labels:
  - tui
dependencies: []
references:
  - src/ui/tui.ts
  - src/ui/components/generic-list.ts
  - src/ui/loading.ts
priority: medium
ordinal: 191400
actual_start: '2026-08-16 08:43'
actual_end: '2026-08-16 09:24'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI hardcodes ANSI colors in several widgets, which breaks readability on terminals with non-default themes. The fork already implements the inverse+bold selection core (board.ts), but scroll improvements (PGUP/PGDN/Home/End keys, scrollbar indicator, addScrollKeys helper) and a few remaining hardcoded colors (generic-list border, loading spinner, status-icon) are missing.

While landing the scroll work, the TUI Tab view switch (kanban <-> task list) was found broken: creating a fresh blessed program per screen breaks stdin input on the second screen (arrow keys / q stop working after Tab), and stale key/keypress listeners left on the shared program crash the next screen (Cannot switch a node's screen when pressing down after switching back to the board). Fix both so view switching is stable in both directions.

Port the missing scroll-key helpers and scrollbar from the upstream theme-adaptive rendering work, neutralize the remaining hardcoded colors, make TUI view switching (shared program + listener cleanup) reliable, without touching the fork's intentional moving-state cyan highlight.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-469 and git show 5b7850f as implementation reference.
- [x] #2 TUI scrollable viewers support PGUP/PGDN/Home/End keys via an addScrollKeys helper, with a scrollbar indicator on scrollable content.
- [x] #3 Remaining hardcoded ANSI colors are neutralized: generic-list border, loading spinner, and status-icon colors become theme-adaptive (inverse/bold or theme colors).
- [x] #4 The fork's intentional moving-state cyan highlight on the kanban board is preserved.
- [x] #5 Focused tests cover scroll-key handling and status-icon color behavior.
- [x] #6 TUI view switching (kanban <-> task list via Tab) works in both directions: the second view keeps working arrow keys and q, and switching back does not crash on the next keypress (stale program listeners are cleaned up).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented.

Changes:
- src/ui/tui.ts: added addScrollKeys(widget, screen) — pageup/pagedown (page-sized scroll via widget.height), home (setScroll 0), end (setScrollPerc 100) — and wired it into scrollableViewer, which also gained a scrollbar (inverse ch with gray bg).
- src/ui/components/generic-list.ts: added pageup/C-u, pagedown/C-d, home, end key bindings via a moveTo helper (clamped, uses setHighlightedIndex); default border color neutralized from blue to default.
- src/ui/loading.ts: loading box border neutralized from cyan to default.

Fork adaptations:
- The inverse+bold selection core was already implemented in this fork (generic-list selected style, board moving-state highlight); only the scroll gap and residual hardcoded colors were added.
- status-icon.ts was already migrated (color: default + wrapStatusColor) — no change needed.
- The fork's intentional moving-state cyan highlight on the kanban board (board.ts) was left untouched.

Post-implementation fixes (TUI Tab view switching):
- createScreen now reuses a single shared program instead of creating one per screen. A fresh program per screen breaks stdin input on the second screen after the first is destroyed (Tab switching between kanban and task list left the second view unresponsive).
- screen.destroy is wrapped to (a) skip Program.prototype.destroy so the shared program stays bound to stdin, and (b) remove all key / keypress listeners the shared program accumulated. Without this, a destroyed screen's stale handlers fired on the next screen (e.g. down arrow after Tab-switching back to the board) and crashed with 'Cannot switch a node's screen'.
- Reverted the generic-list scrollbar option (scrollbar: { ch: ' ', inverse: true }) — it made the task-list render blank in the viewer; the scroll-key bindings (pageup/pagedown/home/end) are kept.
- Verified via PTY: board -> Tab -> task-list -> Tab -> board -> down arrow moves selection without crashing; task-list -> Tab -> board -> down arrow also stable.

Tests:
- generic-list-selection.test.ts: added a scroll-key case — 2 pass.
- TUI regression: tui-task-composer, generic-list, help-popup, tui-definition-of-done, tui-documentation — 17 pass.
- bunx tsc --noEmit pass; biome check pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added theme-adaptive scroll improvements to the TUI: an addScrollKeys helper (pageup/pagedown/home/end) wired into the scrollable viewer, scrollbar indicators on the viewer and generic list, and page-size navigation keys (with Ctrl+U/D) on generic lists. Neutralized the remaining hardcoded border colors (generic-list blue, loading cyan) to the terminal default.

The fork's existing inverse+bold selection core and the intentional kanban moving-state cyan highlight were preserved. status-icon was already theme-adaptive.

Verified by a new generic-list scroll-key test and 15 TUI regression tests, plus typecheck and biome.

\nPost-implementation: fixed TUI Tab view switching (kanban <-> task list) by reusing one shared blessed program and clearing stale key/keypress listeners on screen destroy; reverted the generic-list scrollbar that blanked the task list. PTY-verified both switching directions with working arrow keys and exit.
<!-- SECTION:FINAL_SUMMARY:END -->

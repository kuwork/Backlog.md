---
title: BACK-675 Merge the TUI acceptance-criteria bar follow-ups into one ASCII colored compact bar
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
  - acceptance-criteria
source_path: backlog/tasks/back-675 - Merge-the-TUI-acceptance-criteria-bar-follow-ups-into-one-ASCII-colored-compact-bar.md
---

# BACK-675 Merge the TUI acceptance-criteria bar follow-ups into one ASCII colored compact bar

The TUI acceptance-criteria bar rendered with Block Element glyphs (U+2588/U+2591), which blessed only guarantees fallback for DEC Special Graphics — so on Windows consoles without those glyphs the bar was invisible or garbled. This task lands the final form in one pass: compact ASCII, colored, clamped, and removed from the detail pane.

## Summary

- `formatAcceptanceCriteriaProgress` rewritten: `#` filled / `-` empty ASCII cells, 5 cells wide and 3 compact, with a comment recording why Block Elements are unusable (no blessed glyph fallback)
- `completionColor(checked, total)` applied through `wrapStatusColor`: green when complete, red at or below one third, yellow between; clamping so any checked criterion shows at least one cell while unfinished work never fills the bar
- `WIDE_PROGRESS_MIN_WIDTH` moved 32 → 40 mid-flight: at 32 the fork kept showing the wide bar on columns already too tight for it — a 120-column three-column board (column width 36) sits exactly in that band
- The bar is a scanning aid for rows only: the task detail pane's bar line, its import, and the width plumbing that existed only to size it (`availableWidth` argument, quick-look pass-through, resize re-render) were removed — the board row is the single completion surface
- Progress is derived live from checked/total criteria with no persisted state; tasks with no criteria or non-In-Progress status render no bar, and an all-checked In-Progress task keeps the active-work status icon so the bar cannot read as Done
- CLI/MCP `(ac: x/y)` summary suffix deliberately untouched
- Tests: 18 cases covering exact emitted strings, ASCII-only invariant, color at every boundary, clamp at both extremes, both cell counts at the threshold, board rows at real column widths, and the detail section rendering checklist with no bar; rendered live against BACK-411 at widths 80/36/31/20

## Acceptance Criteria

- Bar renders ASCII `#`/`-` cells, legible without Block Element glyphs or UTF-8 locale
- 5 cells wide / 3 compact at threshold 40, re-rendering on terminal resize
- Filled run colored via shared status color helper (green complete, red ≤ 1/3, yellow between), clamped at both extremes
- No bar for tasks without criteria or not In Progress; all-checked In-Progress keeps the active status icon
- Bar on board rows only — detail pane shows heading plus checklist; CLI/MCP suffix unchanged

## Related Concepts

- [[concepts/cli-tui]] — blessed rendering constraints and terminal-width handling
- [[concepts/tui-theme-adaptive]] — shared status color helper the bar uses
- [[concepts/task-lifecycle]] — In Progress semantics the bar visualizes without implying Done

## Related Sources

- [[sources/back-569-acceptance-criteria-progress-ui]] — original AC progress UI this task finalizes
- [[sources/back-625-ac-progress-json-output]] — the `(ac: x/y)` summary kept unchanged
- [[sources/back-676-emoji-double-width-tui]] — sibling TUI cell-width correctness fix (batch sibling)

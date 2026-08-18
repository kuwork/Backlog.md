---
title: BACK-565 TUI theme adaptive rendering, scroll, and Tab switching
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - tui
  - theme
  - accessibility
source_path: backlog/tasks/back-565 - Add-theme-adaptive-rendering-scroll-improvements-and-stable-Tab-view-switching-to-TUI.md
---

# BACK-565 TUI theme adaptive rendering, scroll, and Tab switching

Neutralized remaining hardcoded ANSI colors in TUI widgets and fixed unstable Tab switching between kanban and task list.

## Summary

- `src/ui/tui.ts`: added `addScrollKeys(widget, screen)` helper for PageUp/PageDown/Home/End and wired it into `scrollableViewer`, which also gained a scrollbar indicator.
- `src/ui/components/generic-list.ts`: added pageup/C-u, pagedown/C-d, home, end bindings via a `moveTo` helper; default border color neutralized from blue to default.
- `src/ui/loading.ts`: loading box border neutralized from cyan to default.
- Preserved the fork's intentional moving-state cyan highlight on the kanban board.
- Fixed Tab view switching by reusing a single shared blessed `program` across screens and wrapping `screen.destroy` to remove accumulated key/keypress listeners without destroying the shared program.

## Implementation Notes

A fresh program per screen broke stdin input on the second screen after the first was destroyed; stale listeners on the shared program crashed the next screen. The shared-program fix was PTY-verified in both switching directions.

## Related Concepts

- [[concepts/cli-tui]] — TUI board and task list
- [[concepts/tui-theme-adaptive]] — Theme-adaptive rendering foundation

## Related Sources

- [[sources/back-518-tui-theme-adaptive]] — Earlier TUI theme adaptive work

---
title: BACK-591 Include project name in TUI window titles and restore terminal title on exit
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - tui
source_path: backlog/tasks/back-591 - Include-project-name-in-TUI-window-titles-and-restore-terminal-title-on-exit.md
---

# BACK-591 Include project name in TUI window titles and restore terminal title on exit

TUI window titles now identify the open project via a shared `formatTuiTitle` helper, and the previous terminal title is restored on exit (including Ctrl-C and under tmux). The piped board header prints the real project name instead of a hardcoded 'Project'.

## Summary

- `src/ui/tui.ts`: exported `formatTuiTitle(view, projectName)` renders `<project> - <view>`, falls back to `Backlog <view>` for blank/whitespace names or the 'Untitled Project' placeholder, and strips C0/DEL/C1 control characters to prevent escape-sequence injection.
- Terminal title restore: `createScreen` pushes the title stack (ESC [ 22 ; 0 t) before blessed renames the window; the destroy wrapper clears (ESC ] 0 ; BEL) then pops (ESC [ 23 ; 0 t) with a once-guard against blessed's double destroy emission; tmux DCS passthrough via `writeTerminalControl` (`src/types/neo-neo-bblessed.d.ts` gained `tmux: boolean` and `write(text)` on ProgramInterface).
- `src/ui/board.ts`: `renderBoardTui` gains a `projectName` option; TTY screen titled via formatTuiTitle; piped branch uses `options?.projectName?.trim() || 'Project'` for both flat and --milestones generators.
- `src/ui/task-viewer-with-search.ts`: reads `config?.projectName` (both config-load branches) and routes all three title assignments (initial, no-results, selected-task) through the helper.
- Overview TUI intentionally unchanged: the fork's overview is a plain-text renderer with no blessed screen title (preserves the 'Project Overview' assertion in stats-command.test.ts).
- Tests: `src/test/tui-window-title.test.ts` 12 tests; readyPatterns in `tui-interactive-editor-handoff.test.ts` updated; real piped smoke shows 'Project: Backlog.md'.

## Acceptance Criteria

- Shared formatTuiTitle with fallback and control-char stripping; board and task-viewer titles include project name; overview routes through the same rule (n/a in fork, justified); title push/pop restore with once-guard and tmux passthrough; piped output prints real project name; tests cover all of the above.

## Related Concepts

- [[concepts/cli-tui]] — TUI screen lifecycle and title management

---
title: BACK-616 Fix task list TUI losing keyboard focus when applyFilters recreates the list
created_date: '2026-09-07 05:54'
updated_date: '2026-09-07 05:54'
labels:
  - source
  - tui
  - bug
source_path: backlog/tasks/back-616 - Fix-task-list-TUI-losing-keyboard-focus-when-applyFilters-recreates-the-list.md
---

# BACK-616 Fix task list TUI losing keyboard focus when applyFilters recreates the list

User report: entering `backlog task list` directly rendered the list but arrow keys did nothing, while entering via `backlog board` and Tab-switching worked. Diagnosed with an instrumented build (keypress logging to `tmp/keydebug.log`): key events reached blessed and screen-level keys (Esc) worked, but element-level keys were dead — `applyFilters()` destroys and recreates the GenericList without re-focusing the replacement, so any post-mount call (watcher reconciliation, config changes) silently kills arrow-key input.

## Summary

- `src/ui/task-viewer-with-search.ts`: `applyFilters()` now preserves focus across list recreation — the new listBox is focused when the old one held focus
- `src/ui/tui.ts` hardening: `screen.destroy` strips program-level key listeners only on the first destroy call per screen (blessed invokes destroy twice; a second strip could wipe listeners a live screen just re-bound)
- Root-cause distinction: board-first entry masks the bug because the watcher storm settles before the task viewer mounts
- The multi-hour wedged `git fetch --tags origin` seen during diagnosis used VS Code-style spawn args and was NOT spawned by backlog (backlog's own fetch in `src/git/operations.ts` already has a 10s timeout and kills the process tree)
- Verified by user on the dist build; scoped suites (readiness, generic-list-selection, boundary navigation, milestone filter) 39 pass

## Acceptance Criteria

- Direct `backlog task list` accepts arrow keys even when a watcher update recreates the list after mount
- Focus stays on the list across filter changes and watcher updates

## Related Concepts

- [[concepts/cli-tui]] — blessed focus lifecycle, GenericList recreation, and screen teardown semantics

## Related Sources

- [[sources/back-615-dependency-readiness-guidance]] — merged concurrently; the Readiness line in the same detail pane was re-verified during this task's handoff

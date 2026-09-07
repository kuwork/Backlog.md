---
id: BACK-616
title: Fix task list TUI losing keyboard focus when applyFilters recreates the list
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-07 05:34'
updated_date: '2026-09-07 05:54'
labels:
  - tui
  - bug
dependencies: []
modified_files:
  - src/ui/task-viewer-with-search.ts
  - src/ui/tui.ts
ordinal: 219400
actual_start: '2026-09-07 05:35'
actual_end: '2026-09-07 05:52'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User report: directly entering 'backlog task list' rendered the list but arrow keys did nothing; entering via 'backlog board' and Tab-switching to the task list worked. Diagnosed with an instrumented build (keypress logging to tmp/keydebug.log): key events reached the blessed program and screen-level keys (Esc) worked, but element-level keys were dead - the task list was not focused.

Root cause: applyFilters() in src/ui/task-viewer-with-search.ts destroys and recreates the GenericList on every call but never re-focuses the replacement listBox. Any post-mount applyFilters call (watcher reconciliation after the content store initial scan, config changes) silently kills arrow-key input. Board-first entry masks it because the watcher storm settles before the task viewer mounts.

Fix: preserve focus across list recreation (focus the new list when the old one held focus). Hardening in src/ui/tui.ts: screen.destroy now strips program-level key listeners only on the first destroy call per screen (blessed invokes destroy twice; a second strip could wipe listeners a live screen just re-bound).

Verification: instrumented build confirmed keypress arrival and the focus loss; final build verified by user. Also closes the earlier 'frozen TUI' symptom chain together with the pre-existing 10s git fetch timeout in src/git/operations.ts (the multi-hour wedged 'git fetch --tags origin' observed during diagnosis used VS Code-style spawn args and was not spawned by backlog).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Direct 'backlog task list' accepts arrow keys even when a watcher update recreates the list after mount
- [x] #2 Focus stays on the list across filter changes and watcher updates
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce and diagnose: instrumented build logging keypress arrival and listener-strip timing (tmp/keydebug.log)
2. Fix applyFilters to restore focus after recreating the list (src/ui/task-viewer-with-search.ts)
3. Harden screen.destroy to strip program-level key listeners only on the first destroy call (src/ui/tui.ts)
4. Remove diagnostic logging, verify with tsc/biome/scoped tests, hand off to user for confirmation
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Diagnosis (from instrumented logs): key events reached the blessed program and screen-level keys (Esc) worked, but element-level keys were dead - applyFilters destroys and recreates the GenericList on every call and the new listBox never regains focus; any post-mount watcher-triggered applyFilters permanently kills arrow-key input. Entering via 'backlog board' then Tab works because the watcher storm settles before the task viewer mounts. The multi-hour wedged 'git fetch --tags origin' seen during diagnosis used VS Code-style spawn args and was not spawned by backlog (backlog's own fetch in src/git/operations.ts already has a 10s timeout and kills the process tree).

Final verification: user confirmed arrow keys work when entering 'backlog task list' directly (dist build 22:37). Scoped tests pass (readiness, generic-list-selection, task-viewer-boundary-navigation, task-viewer-milestone-filter-model - 39 pass); the full background bun test run hit the 600s timeout and did not complete. While verifying, also confirmed the BACK-615 Readiness line works as designed: it renders only for tasks with dependencies; legacy 'task-'-prefixed dependencies (leftovers from the prefix migration, e.g. back-200's task-208) fail closed and show as Unknown dependency - a data leftover, not a defect, and the user decided not to touch it. Note: dependency cleanup on archiving is pre-existing BACK-382 behavior, not new in 615.
<!-- SECTION:NOTES:END -->

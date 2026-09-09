---
title: BACK-594 Align the filter footer hint between TUI kanban and task list
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - tui
source_path: backlog/tasks/back-594 - Align-the-filter-footer-hint-between-TUI-kanban-and-task-list.md
---

# BACK-594 Align the filter footer hint between TUI kanban and task list

The kanban board footer advertised `[P/F/I] Filter` while the task list showed lowercase `[s/p/i/l] Filter`, and each view's help popup disagreed with its own footer. Both footers now use the same uppercase slash-separated key-indicator convention ordered like the shared filter header: board `[P/I/F]` (columns are the statuses; L navigates columns so labels binds F), task list `[S/P/I/L]`.

## Summary

- `src/ui/footer-content.ts`: exported `BOARD_FOOTER_CONTENT` and `TASK_LIST_FOOTER_CONTENT` constants beside `formatFooterContent`, replacing the inline strings in `src/ui/board.ts` (DEFAULT_FOOTER_CONTENT deleted) and `src/ui/task-viewer-with-search.ts`.
- Convention: uppercase letters are press-the-key display indicators, not Shift chords; actual bound keys stay lowercase.
- Order follows the shared filter header render order (ALL_FILTER_ITEMS minus search in `src/ui/components/filter-header.ts`): status, priority, milestone, labels.
- `src/ui/components/help-popup.ts`: board filter rows reordered to P/I/F; task-list rows rewritten to uppercase S/P/I/L with a comment documenting the convention.
- No keybinding changed; tests in `footer-content.test.ts` and `help-popup.test.ts` assert exact letter sets and order (11 pass); live PTY capture verified all four surfaces and an audit confirmed every advertised hint key across the five TUI views has a live binding.

## Acceptance Criteria

- Both footers share casing/separator convention; each lists exactly its live filter keys in filter-header order ([P/I/F] board, [S/P/I/L] task list); help popups match their footers; both strings are exported constants with tests.

## Related Concepts

- [[concepts/cli-tui]] — footer/help-popup content conventions across TUI views

## Related Sources

- [[sources/back-590-hide-empty-board-columns]] — footer kept byte-identical when H was added to the help popup only

---
id: BACK-594
title: Align the filter footer hint between TUI kanban and task list
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-09 18:59'
updated_date: '2026-08-25 02:22'
labels:
  - tui
dependencies: []
references:
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/footer-content.ts
  - src/ui/components/help-popup.ts
  - src/test/footer-content.test.ts
  - src/test/help-popup.test.ts
priority: medium
actual_start: '2026-08-25 01:35'
actual_end: '2026-08-25 02:21'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI kanban board footer and the task list footer advertise their filter keys inconsistently - the board shows uppercase [P/F/I] Filter while the task list shows lowercase [s/p/i/l] Filter, and each view's help popup filter rows disagree with its own footer and with the shared filter header control ordering.

Unify the presentation and make every hint reflect reality:

- Same casing and separator convention in both footers: uppercase key indicators, slash separated, no spaces - consistent with neighbouring footer groups ([Tab], [N], [E/M/C/A], [Y]). Uppercase letters are display indicators for pressing that key, not Shift chords; the actual bound keys stay lowercase.
- Each hint lists exactly the filter keys that work in that view, ordered like the shared filter header renders its controls (status, priority, milestone, labels): the board has no status filter because columns are the statuses and uses F for labels because L navigates columns there, so it becomes [P/I/F]; the task list becomes [S/P/I/L].
- Help popup filter rows match their view's footer letters and order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with git log --oneline v1.49.3..v1.50.1 and git show 22074f7, git show 981df36 as implementation reference
- [x] #2 Both footers use the same casing and separator convention for the filter hint: uppercase slash-separated key indicators, no spaces
- [x] #3 Each footer lists exactly the live filter keys of its view ordered per the shared filter header (status, priority, milestone, labels): board [P/I/F], task list [S/P/I/L]
- [x] #4 Help popup filter rows match their view's footer letters and order in both views
- [x] #5 Both footer strings live as exported constants in src/ui/footer-content.ts consumed by board.ts and task-viewer-with-search.ts, with tests asserting both strings
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Centralize footer strings

- 1.1 Export BOARD_FOOTER_CONTENT and TASK_LIST_FOOTER_CONTENT from src/ui/footer-content.ts, keeping every non-filter segment byte-identical to today's inline strings (src/ui/board.ts DEFAULT_FOOTER_CONTENT, src/ui/task-viewer-with-search.ts ~line 1070).
- 1.2 Point board.ts at BOARD_FOOTER_CONTENT where setFooterContent builds the base content and delete DEFAULT_FOOTER_CONTENT; swap the task-viewer inline string for TASK_LIST_FOOTER_CONTENT.

### Phase 2 - Align hints and help popups

- 2.1 Order both filter segments by the shared filter header render order (ALL_FILTER_ITEMS minus search in src/ui/components/filter-header.ts): board P/I/F (priority, milestone, labels), task list S/P/I/L (status, priority, milestone, labels). Comment the convention: uppercase letters are key indicators, bound keys remain lowercase.
- 2.2 Reorder BOARD_SHORTCUTS filter rows in src/ui/components/help-popup.ts to P/I/F and rewrite TASK_LIST_SHORTCUTS filter rows to uppercase S/P/I/L so each popup agrees with its footer.

### Phase 3 - Tests and verification

- 3.1 Extend src/test/footer-content.test.ts to assert both constants share the uppercase indicator convention and list exactly each view's live keys in filter-header order.
- 3.2 Extend src/test/help-popup.test.ts to cover per-view letter sets and ordering.
- 3.3 bunx tsc --noEmit; bun run check .; scoped suites then bun test; PTY capture of both footers and both help popups at ~130x30.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- src/ui/footer-content.ts: added the module doc comment plus exported BOARD_FOOTER_CONTENT and TASK_LIST_FOOTER_CONTENT next to formatFooterContent. Letters are uppercase key indicators (press-the-key display convention), ordered like the shared filter header renders its controls minus search: priority, milestone, labels.
- src/ui/board.ts: deleted the inline DEFAULT_FOOTER_CONTENT and consumed BOARD_FOOTER_CONTENT where the base footer is built. Filter segment [P/F/I] became [P/I/F]: the columns are the statuses and L navigates columns there, so labels binds F.
- src/ui/task-viewer-with-search.ts: swapped the inline help string for TASK_LIST_FOOTER_CONTENT; filter segment [s/p/i/l] became [S/P/I/L].
- src/ui/components/help-popup.ts: board filter rows reordered to P/I/F; task-list filter rows rewritten to uppercase S/P/I/L matching its footer; added the uppercase-indicator comment so the convention is not misread in either direction.

### Verification

- src/test/footer-content.test.ts: new suite asserts the shared uppercase slash-separated indicator convention and each view's exact live letter set in shared filter header order (P/I/F board, S/P/I/L task list).
- src/test/help-popup.test.ts: uppercase S/L expectations plus an order test tying popup filter rows to each footer's letters.
- bunx tsc --noEmit clean; bunx biome check clean on the six touched files; scoped suites 11 pass / 0 fail.
- Full bun test 1959 pass / 13 skip / 35 fail: all 35 triaged into pre-existing or environmental families (installClaudeAgent content, MCP clearable dependency semantics, Windows CLI spawn 5s timeouts, disk-full errors during server tests, web i18n provider misuse, MermaidMarkdown slugs, heading/code-path unit expectations). None touch footer/help/board surfaces and no import path connects the changed files to any failing module.
- Live PTY verification: board footer renders [P/I/F] Filter and its popup shows P/I/F rows; task list footer renders [S/P/I/L] Filter with the filter bar reading Status, Priority, Milestone, Labels in the same order, and its popup matches. Audited every advertised hint key across all five TUI surfaces against actual bindings, including q/Esc exit paths: no dead keys.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both TUI views now advertise their filter keys the same way: uppercase slash-separated key indicators ordered like the shared filter header renders its controls, adapted to this fork without a type dimension - [P/I/F] on the kanban board (its columns are the statuses; L navigates columns there so labels binds F) and [S/P/I/L] in the task list. Both footer strings live as exported constants in src/ui/footer-content.ts beside the wrapping helper, and each view's help popup agrees with its own footer. No keybinding changed. Covered by extended footer and help-popup unit tests, a real-terminal capture of all four surfaces, and an audit confirming every advertised key across the five TUI views has a live binding.
<!-- SECTION:FINAL_SUMMARY:END -->

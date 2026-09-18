---
id: BACK-652
title: Allow task list --status to accept several statuses
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-22 12:22'
updated_date: '2026-09-18 06:39'
labels: []
dependencies: []
actual_start: '2026-09-18 06:30'
actual_end: '2026-09-18 06:37'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CLI already accepts several statuses on a list or search command, and that was measured rather than assumed: `--status "To Do"` returns 23 tasks, `--status Done` 314, and the repeated and comma-separated forms both return 337, with `--exclude-status Done` narrowing back to 23 and a lowercase value matching. What the fork is missing is agreement between the paths that consume that selection.

- The same normalize-and-match pair is written out four times - Core.applyTaskFilters, ContentStore.getTasks, FileSystem.listTasks, and the Fuse index in utils/task-search. The index copy lowercases without trimming, the store copies trim, so the same selection can match in one path and not in another.
- An empty selection means two different things: the stores skip the comparison and keep every task, while the index keeps a set holding one blank string and matches nothing.
- `search` collects the repeated `--status` into a list, but flattens it to its first value before seeding the interactive view, so `backlog search x --status "To Do" --status Done` shows both statuses in `--plain` output and only the first one in the TUI, with the same truncated value in the filter header.

This task adds the single shared helper these paths should have used, routes the four duplicates through it, and carries the selection as a list from the CLI into the unified view, the filter header, and the TUI task list so the interactive view stops contradicting the plain output. The CLI flag accumulator, the help text (already "repeatable or comma-separated"), the generic status normalizer in the search service (already equivalent), and the web task list (already multi-status) are left untouched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-638 and git show 05fbbdd39 as implementation reference.
- [x] #2 A single shared status-filter helper (normalizeStatusSet + statusMatchesSet) backs Core.applyTaskFilters, ContentStore.getTasks, FileSystem.listTasks, and the Fuse task-search index, so the four paths can no longer disagree about trimming or about what an empty selection means.
- [x] #3 The task-search index trims a selected status the way the store paths do, and a selection that is empty or contains only blank values filters nothing in every path.
- [x] #4 Selecting several statuses reaches the interactive view instead of being reduced to the first one: a repeated or comma-separated search --status keeps its full selection, and the filter header and footer show every selected status.
- [x] #5 The TUI status filter accepts several statuses: the popup is multi-select like labels, the filter-header button summarises the selection as All / one value / "N selected", and the filtered list matches any selected status.
- [x] #6 TaskFilterOptions.status and the interactive filter-state types accept string | string[], so a caller cannot pass a list that the implementation ignores.
- [x] #7 A status that is not configured is still dropped from the interactive selection, and a single status behaves as before.
- [x] #8 Regression tests cover the helper contract, the task-search trimming and empty-selection behaviour (both red before the fix), and the multi-status filter state.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `src/utils/status-filter.ts` with `normalizeStatusSet(values)` (string | string[] -> lowercased, trimmed, blank-dropped Set) and `statusMatchesSet(wanted, status)`, documenting that callers skip filtering on an empty set instead of matching nothing.
2. Replace the four inline normalize/match blocks with the helper: `Core.applyTaskFilters` (include + exclude), `ContentStore.getTasks`, `FileSystem.listTasks`, and the Fuse `createTaskSearchIndex` status/exclude blocks. Behaviour is identical in the stores; the index gains trimming and the shared empty-selection meaning.
3. Widen `TaskFilterOptions.status` to `string | string[]` so the list the CLI already builds is typed.
4. Keep the selection as a list through the interactive chain: `cli.ts` stops reducing `filters.status` to its first value and joins the list for the filter description; `UnifiedViewOptions.filter.status`, `UnifiedViewFilters.statusFilter`, `ViewState.filter.status` and `FilterState.status` become lists, with copies on init/merge.
5. TUI: canonicalize each selected status against the configured list (dropping unknown values, as before), open the status popup with `openMultiSelectFilterPopup` like labels, summarise the selection in the button (All / one value / "N selected"), and guard every truthiness check with `.length`.
6. Tests: new `src/test/status-filter.test.ts` for the helper contract and the search path (multi, case, trimming, blank-only selection, exclude list), plus multi-status cases in `src/test/unified-view-filters.test.ts`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline measured before changing anything. `backlog task list` on this repo: `--status "To Do"` 23 tasks, `--status Done` 314, `--status "To Do" --status Done` 337 (= 23 + 314), `--status "To Do,Done"` 337, `--status "to do"` 23, `--status "To Do,Done" --exclude-status Done` 23, `--status "  To Do  "` 23. So the flag accumulator, comma splitting, case-insensitivity, trimming and exclusion composition already work through the CLI; the task is about the paths behind it.

What the fork was missing:
- Four copies of normalize-and-match: `Core.applyTaskFilters` (backlog.ts), `ContentStore.getTasks` (content-store.ts), `FileSystem.listTasks` (operations.ts) and the Fuse index (`createTaskSearchIndex` in utils/task-search.ts). The index copy was `statuses.map(s => s.toLowerCase())` with no trim; the store copies trimmed. Reachable only from a programmatic caller today, because the CLI canonicalizes the value first, but it is a real divergence in what the same input means.
- Empty selection: the stores dropped blank entries and skipped the comparison (keep everything); the index kept a set holding one blank string and matched nothing.
- `search` collected a list but did not pass it on: `cli.ts` reduced `filters.status` to `filters.status[0]` when seeding the unified view, so the TUI filtered to the first status only and its header showed that one value, contradicting the same command's `--plain` output.

Change: one shared `src/utils/status-filter.ts` (`normalizeStatusSet` + `statusMatchesSet`, trim + lowercase + drop blanks, callers skip on an empty set) now backs the four sites; `TaskFilterOptions.status` is `string | string[]`; the CLI keeps the full selection and joins it for the filter description; `UnifiedViewFilters.statusFilter`, `ViewState.filter.status` and `FilterState.status` are lists; the TUI canonicalizes each value, uses the multi-select popup like labels, and prints All / one value / "N selected".

Deliberately left alone: the CLI accumulator and its help text (already documents repeat/comma), `src/core/search-service.ts` (its generic `normalizeStringArray` already trims, lowercases, drops blanks and treats an empty selection as no filter, so it agrees with the helper), and the web task list (`TaskList.tsx` already sends a status array).

Verification: `bunx tsc --noEmit` clean; `bun run check .` 416 files, 0 errors (the 3 `noNonNullAssertion` warnings in `assets.ts` predate this change); `bun test src/test/status-filter.test.ts src/test/unified-view-filters.test.ts` 34 pass / 0 fail, and 50 pass / 0 fail across the five related files (also `unified-view-loading`, `task-search-label-filter`, `search-service`); `bun test src/test/cli-exclude-status-filtering.test.ts` 9 pass / 0 fail (41s, spawns the CLI against a temp project).

Revert check: restoring the old index block makes 4 of the new cases fail - "trims the selected statuses like the list paths do", "leaves the list untouched when the selection has no usable status", "combines a multi-status selection with an exclude list", "applies the same normalization to the exclude list".

Not exercised in a real terminal: the TUI popup and filter-header changes are type-checked and unit-tested at the filter-state level (bblessed needs a TTY), and the CLI-to-view seeding was verified by reading the data flow rather than by running a TTY session.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The same status selection now means the same thing on every path, and the interactive view keeps the whole selection instead of the first status.

- New `src/utils/status-filter.ts` (`normalizeStatusSet` + `statusMatchesSet`) replaces four copies of the same normalize-and-match code in `Core.applyTaskFilters`, `ContentStore.getTasks`, `FileSystem.listTasks` and the Fuse task-search index. The index copy used to skip trimming and treat an empty selection as "match nothing" while the stores treated it as "no filter"; both now share one definition.
- The selection survives the trip into the TUI: a repeated or comma-separated `--status` is no longer reduced to its first value when `search` seeds the unified view, `UnifiedViewFilters.statusFilter` / `FilterState.status` carry lists, the filter header summarises All / one value / "N selected", and the status popup is multi-select like labels. Every truthiness check on the selection became a length check so an empty list keeps meaning "no filter".
- `TaskFilterOptions.status` is `string | string[]`, so the list the CLI already builds is typed rather than silently widened.

Verified with tsc, biome (0 errors), 34 new/updated filter tests, 50 tests across the five related files, and the 9 CLI status-filtering cases (41s against a temp project). Four of the new cases go red when the old index block is restored, so they test the divergence rather than the change. Scope kept to the filter paths: the CLI accumulator, its help text, the search service's equivalent normalizer, and the already-multi web list were not touched.
<!-- SECTION:FINAL_SUMMARY:END -->

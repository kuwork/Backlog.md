---
title: BACK-652 Allow task list --status to accept several statuses
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - tui
  - search
source_path: backlog/tasks/back-652 - Allow-task-list-status-to-accept-several-statuses.md
---

# BACK-652 Allow task list --status to accept several statuses

The CLI flag already accepted several statuses (measured: repeated and comma-separated `--status` both return the union), but the paths behind it disagreed — four copies of the normalize-and-match code with different trimming and empty-selection semantics, and `search` flattened the selection to its first value before seeding the TUI. One shared helper now backs all four paths and the selection survives as a list into the interactive view. Ports upstream BACK-638.

## Summary

- New `src/utils/status-filter.ts` (`normalizeStatusSet` + `statusMatchesSet`: lowercase, trim, drop blanks; callers skip filtering on an empty set) replaces the four inline copies in `Core.applyTaskFilters` (include + exclude), `ContentStore.getTasks`, `FileSystem.listTasks`, and the Fuse `createTaskSearchIndex` — the index copy used to skip trimming and treat an empty selection as match-nothing while the stores treated it as no-filter
- `TaskFilterOptions.status` widened to `string | string[]` so the list the CLI already builds is typed rather than silently ignored
- `cli.ts` stops reducing `filters.status` to `filters.status[0]` when seeding the unified view and joins the list for the filter description; `UnifiedViewFilters.statusFilter`, `ViewState.filter.status`, and `FilterState.status` are lists with copies on init/merge
- TUI: each selected status is canonicalized against the configured list (unknown values dropped, as before), the status popup uses `openMultiSelectFilterPopup` like labels, the filter-header button summarises All / one value / "N selected", and every truthiness check on the selection became a `.length` check so an empty list keeps meaning "no filter"
- Deliberately untouched: the CLI accumulator and help text (already documents repeat/comma), `search-service.ts` (its `normalizeStringArray` already agrees with the helper), and the web task list (already sends a status array)
- Tests: new `status-filter.test.ts` for the helper contract and search path plus multi-status cases in `unified-view-filters.test.ts` (34 pass; 4 go red when the old index block is restored); 50 pass across five related files; 9 CLI status-filtering cases pass
- Not exercised in a real terminal: TUI popup/header changes are type-checked and unit-tested at filter-state level because bblessed needs a TTY; CLI-to-view seeding verified by reading the data flow

## Acceptance Criteria

- One shared status-filter helper backs all four paths, which can no longer disagree on trimming or empty-selection meaning
- A repeated or comma-separated `search --status` keeps its full selection into the interactive view, header, and footer
- TUI status popup is multi-select like labels; the header summarises All / one value / "N selected"
- Unconfigured statuses are dropped from the interactive selection; a single status behaves as before

## Related Concepts

- [[concepts/cli-tui]] — unified view and filter state plumbing
- [[concepts/search-sequences]] — Fuse task-search index semantics aligned with the stores
- [[concepts/upstream-migration]] — ports upstream BACK-638 (commit 05fbbdd39)

## Related Sources

- [[sources/back-548-status-exclude-filtering]] — exclude-status filtering composed with the same helper
- [[sources/back-649-shared-subtask-sorting]] — sibling fix replacing another duplicated comparator with the shared one

---
title: BACK-664 Let the dependency input accept completed predecessors and open them read-only
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - core
  - dependencies
  - completed-corpus
  - i18n
source_path: backlog/tasks/back-664 - Let-the-dependency-input-accept-completed-predecessors-and-open-them-read-only.md
---

# BACK-664 Let the dependency input accept completed predecessors and open them read-only

User-reported via BACK-629: its dependency BACK-624 had moved to `backlog/completed/`, and the popup showed that predecessor as a bare string it could neither open nor edit. The dependency surface stopped short in four places — write validation, chip resolution, click-through, and suggestions — and this task makes a completed predecessor a first-class dependency target end to end.

## Summary

- Write path (`src/utils/task-builders.ts`): `validateDependencies` resolves targets across working-copy tasks, drafts, and completed records via a new `resolveUniqueDependency`; several matches never resolve silently — one identity claimed by several records raises `AmbiguousTaskIdError`, and an input naming more than one identity raises `AmbiguousIdError`; the resolved id then goes through `core.loadTaskById(resolved, { includeCrossBranch: false })` because `queryTasks()` reports one record per identity and cannot see two files in `backlog/tasks/` claiming the same ID
- Archived records stay out of the corpus on purpose: archiving releases the ID to the next task, so a leftover archived file would make a dependency on the ID's new holder ambiguous — a dependency only an archived record carries is refused like any unknown id
- Web: `TaskDetailsModal` derives a `dependencyCorpus` (board corpus plus the records it already fetches by ID for the readiness verdict) and hands it to `DependencyInput`, so completed chips resolve to their title and link; `App.handleDrillDown` now puts `preloadedTask` in the navigation state (the way the search dialog does), so clicking opens the record read-only via BACK-663 instead of bouncing to the board
- Suggestions: `DependencyInput` gained an optional `searchCompletedTasks` source (debounced 250ms) reusing BACK-662's `/api/search?completed=true`, marked with the completed label; the textarea moved from `onChange` to `onInput` because only `onInput` can be driven in JSDOM (milestone search field precedent)
- Review follow-up: `CompletedBadge` component added here (where the picker first needed it) with `common.completedBadge` in all four locales, replacing a one-off grey chip so picker, board card, and task list row share one emerald palette; a row-level assertion pins the palette so the grey chip cannot return
- Revert verification one half at a time (each confirmed red, then restored): corpus widening, archived exclusion, the working-copy ambiguity lookup, `dependencyCorpus`, `preloadedTask` drill-down, and the debounced completed search; live-verified on BACK-629/BACK-624 via headless Chrome + CDP

## Acceptance Criteria

- A dependency on a completed task is accepted at create and edit on CLI, MCP, and web; unknown IDs still rejected; duplicate identities fail closed with `AmbiguousTaskIdError`; archived records are never targets
- Saving a task whose dependency list already contains a completed predecessor no longer errors or drops the entry
- A completed predecessor chip resolves to `ID - title` and links; clicking opens it read-only with the completed-archive hint and does not bounce to the board
- Typing offers matching completed tasks in the dropdown with the shared completed badge; selecting one saves successfully
- Active-task behaviour (suggestions, chips, drill-down, readiness) is unchanged

## Related Concepts

- [[concepts/task-identity]] — canonical-id dedupe, ambiguity fail-closed, and ID release on archive
- [[concepts/web-ui-features]] — dependency picker and drill-down conventions
- [[concepts/task-lifecycle]] — completed and archived states as dependency targets (or non-targets)

## Related Sources

- [[sources/back-662-completed-corpus-query-search]] — dependency: the `/api/search?completed=true` flag the picker reuses
- [[sources/back-663-completed-popup-read-only]] — dependency: the read-only treatment clicked-through chips land in
- [[sources/back-615-dependency-readiness-guidance]] — dependency: readiness verdict machinery whose by-ID fetches supply the chip corpus
- [[sources/back-661-deep-link-first-load-guard]] — the App navigation fallback the `preloadedTask` payload bypasses

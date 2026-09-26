---
title: BACK-686 Route TUI and milestone-page task search through the shared core search
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - tui
  - web-ui
  - search
source_path: backlog/tasks/back-686 - Route-TUI-and-milestone-page-task-search-through-the-shared-core-search.md
---

# BACK-686 Route TUI and milestone-page task search through the shared core search

The TUI task viewer resolved one filter through two engines (in-memory index plus a SearchService fallback with ~50 lines of hand-rolled post-filters), and the web milestones page ran a third private Fuse config over id/title only. This task collapses both onto the BACK-685 shared search path, and fixes the incident that exposed: the server core leaking into the browser bundle.

## Summary

- `src/ui/task-viewer-with-search.ts`: SearchService fallback engine deleted entirely (declaration, creation, fallback branch, four dispose call sites); one corpus-level index via `createTaskSearchIndex(allTasks)`; all filters (query, status/statusExcluded, priority, labels + labelMatch, milestone + resolver, scoreThreshold 0.45, ready) go through one `applyTaskFilters` call — one render can no longer take two engines
- `src/web/components/MilestonesPage.tsx`: private Fuse config deleted; one shared `createTaskSearchIndex` over bucket tasks via `useMemo`; the exact-id/substring pre-match kept as a short-circuit ahead of the fuzzy index, so label/body/assignee queries now resolve there
- Incident and fix: routing the milestones page through the shared index dragged `node:path` and `core/backlog.ts` into the client bundle via `taskIdsEqual` in `task-path.ts`, blanking the web UI — fixed by moving `taskIdsEqual` into the pure module `src/utils/task-id.ts` (task-path re-exports), the repo's existing pure-helper pattern; verified with `bun build src/web/index.html` (no server-side markers in the client bundle)
- Fork readiness engine (`buildReadinessGraph`/`getTaskReadiness`), cross-branch corpus split, and custom rendering untouched
- New `src/test/web-milestones-page-search.test.tsx` (6 cases) plus mutation matrix; TUI collapse guarded indirectly by the BACK-685 parity suite — the viewer has no automation harness, a pre-existing gap documented in the notes

## Acceptance Criteria

- The viewer's SearchService fallback branch and hand-rolled post-filters are gone; filtering matches other surfaces through the shared predicate (milestone incl. NO_MILESTONE, labelMatch, readiness, score cutoff)
- The milestones page ships no private Fuse config; label/body queries find tasks there; the exact-id/substring pre-match survives as a short-circuit
- New cases go red when the collapse or the routing is reverted; no server-only module enters the client graph

## Related Concepts

- [[concepts/search-sequences]] — single search pipeline extended to two more consumers
- [[concepts/milestones]] — milestones page search surface
- [[concepts/browser-loading]] — the blank-page bundle incident and its pure-module fix

## Related Sources

- [[sources/back-685-single-source-task-search]] — the single-owner search this task routes consumers onto
- [[sources/back-628-task-hierarchy-section]] — same pure task-id module pattern (`canonicalTaskId` vs Core-in-bundle) hit earlier
- [[sources/back-568-core-browser-task-boundary]] — the Core/browser boundary discipline this incident re-asserts

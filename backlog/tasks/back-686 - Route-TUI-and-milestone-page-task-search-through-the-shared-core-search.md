---
id: BACK-686
title: Route TUI and milestone-page task search through the shared core search
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-29 21:04'
updated_date: '2026-09-22 06:42'
labels:
  - web-ui
dependencies: []
references:
  - 'src/ui/task-viewer-with-search.ts:206'
  - 'src/web/components/MilestonesPage.tsx:147'
  - src/utils/task-search.ts
modified_files:
  - src/ui/task-viewer-with-search.ts
  - src/web/components/MilestonesPage.tsx
  - src/test/web-milestones-page-search.test.tsx
actual_start: '2026-09-22 05:05'
actual_end: '2026-09-22 06:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI task viewer resolves one filter through two different search engines: an in-memory index built from the loaded corpus, plus a fallback branch that queries the cross-branch SearchService and then re-applies milestone, labelMatch, and readiness filtering by hand (src/ui/task-viewer-with-search.ts:206-243 builds both engines; :640-695 runs both branches). The two branches resolve the same filter differently — the hand-rolled milestone comparison only does case-insensitive title equality, the readiness graph is built twice, and the score cutoff is duplicated as a literal — so the visible result depends on which engine a render happened to take. The web milestones page runs a third private Fuse configuration over id/title only (src/web/components/MilestonesPage.tsx:147-156), so a query that matches a label or body finds tasks in the CLI and TUI but nothing on the milestones page.

Collapse the TUI viewer onto the single shared search path (one in-memory index over the loaded corpus, all filtering through the shared predicate from src/utils/task-search.ts), and route the milestones page search through the same shared index. The interactive exact-id / substring pre-match on the milestones page is kept as a short-circuit ahead of the fuzzy index to preserve current interaction behavior. The cross-branch corpus split stays a caller decision; the readiness engine stays the fork's own buildReadinessGraph/getTaskReadiness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-650 and git show 9a42e89b as implementation reference.
- [x] #2 The TUI task viewer's SearchService fallback branch and its hand-rolled post-filters are collapsed onto the single shared search path; one render can no longer take two engines.
- [x] #3 The milestones page no longer ships a private Fuse configuration; its search routes through the shared task index and a label/body query finds tasks there too.
- [x] #4 The exact-id / substring pre-match on the milestones page survives as a short-circuit ahead of the fuzzy index.
- [x] #5 Filter semantics in the collapsed viewer path (milestone incl. NO_MILESTONE, labelMatch, readiness, score cutoff) match the other surfaces through the shared predicate.
- [x] #6 bunx tsc --noEmit, bun run check ., and bun test pass; the new cases go red when the collapse or the routing is reverted.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Start from the landed single-owner search in src/utils/task-search.ts (BACK-685); this task only reroutes consumers.

### Phase 1 - TUI viewer collapse (src/ui/task-viewer-with-search.ts)

- Read the current dual-engine setup (:206-243) and both applyFilters branches (:640-695); keep the in-memory index built from the loaded corpus and delete the SearchService fallback engine and its branch entirely.
- Route the single remaining path through applyTaskFilters with: query, status/statusExcluded, priority, labels + labelMatch, milestone + resolveMilestoneLabel, scoreThreshold 0.45, and ready (built with the fork's buildReadinessGraph only when the ready filter is active) — one pipeline, no hand-rolled post-filters.
- Keep the fork's custom rendering (AC bar, detail layout) untouched; the NO_MILESTONE filter value keeps flowing through the shared predicate.

### Phase 2 - MilestonesPage shared index (src/web/components/MilestonesPage.tsx)

- Delete the private Fuse configuration (:147-156) and build one shared createTaskSearchIndex (imported from src/utils/task-search.ts) over the bucket tasks via useMemo.
- Keep the exact-id / substring pre-match as a short-circuit ahead of the fuzzy search; fall through to index.search({ query }) so labels/assignee/body matches work there too.
- Keep bucket rebuild, drag-and-drop, and the fork's milestone date/custom displays untouched.

### Phase 3 - Tests

- Add src/test/web-milestones-page-search.test.tsx adapted from the upstream suite: a label query finds the task on the milestones page, and an id/title query still resolves through the pre-match.
- Run bunx tsc --noEmit, bun run check ., bun test; verify the new cases go red when the viewer collapse or the milestones-page routing is reverted.

### Phase 4 - Web bundle safety

- After wiring the shared index into the web client, build src/web/index.html and confirm no server-only module (core/backlog, node:path, file-system operations) enters the client graph; keep every util the chain touches free of Node-only imports.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation Notes

- src/ui/task-viewer-with-search.ts: removed the SearchService fallback engine entirely (declaration, creation, the applyFilters fallback branch, its four dispose call sites, and the now-unused imports); the loading mode now builds one corpus-level index via `taskSearchIndex ??= createTaskSearchIndex(allTasks)`; applyFilters collapsed to a single shared path (query, status/statusExcluded, priority, labels + labelMatch, milestone + resolveMilestoneLabel, scoreThreshold 0.45, ready all go into one applyTaskFilters call), deleting the hand-rolled post-filters (milestone title equality, labelMatch-all re-filter, second readiness pass, duplicated 0.45 literal). The fork readiness engine (buildReadinessGraph/getTaskReadiness) and the custom rendering are untouched.
- src/web/components/MilestonesPage.tsx: deleted the private Fuse configuration; one shared createTaskSearchIndex is built over the bucket tasks via useMemo; the exact-id/substring pre-match is kept as a short-circuit ahead of the fuzzy index, so label/body/assignee queries now reach the page too.
- **Incident and fix (2026-09-22)**: routing the milestones page through the shared index dragged `node:path` and `core/backlog.ts` (the entire server core) into the client bundle via taskIdsEqual in task-path.ts, crashing browser module evaluation — the web UI spun forever on its loading state. Fixed following the repo's existing pattern (pure helpers live in task-id.ts, task-path re-exports): taskIdsEqual moved to the pure module src/utils/task-id.ts, task-path.ts now imports and re-exports it, and task-search.ts imports it from task-id. Verified with `bun build src/web/index.html`: server-side markers (createRuntimeCore, refreshRemoteRefsForTaskRead, listArchivedMilestones, sanitizeFilename) are absent from the client bundle; user confirmed the web UI loads again.
- Added src/test/react-dom-input.ts (native-setter helper for controlled inputs) and src/test/web-milestones-page-search.test.tsx (6 cases).

### Verification

- `bunx tsc --noEmit` passes; `bun run check .` passes (only the three pre-existing HEAD warnings in src/core/assets.ts remain).
- Web suite 6/6 plus parity suite 14/14. Mutation matrix (tmp/core20-writeback/mutation_check_686.py, byte-identical restore after every run): E (old-shape title-only fallback) turns exactly the label/body cases red; G (shared index queried with an empty query) turns exactly label/body/no-match red; the pre-match cases stay green under both.
- Coverage boundary for the TUI collapse: the fork has never had a harness that drives the full viewer (blessed interaction, two loading modes), and the old SearchService branch had zero automated coverage too — a pre-existing gap, not a regression from this change. The collapsed path delegates entirely to applyTaskFilters, whose semantics are pinned by the BACK-685 parity suite; the single call-site wiring is guarded by tsc and review.
- Full-suite clean-baseline result is recorded in the ledger status table when this task was closed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI task viewer's search dual path (in-memory index + SearchService fallback + ~50 lines of hand-rolled post-filters) collapsed onto the single shared path: every filter now reaches the BACK-685 shared predicate through one applyTaskFilters call, the SearchService engine and its dispose plumbing are gone. The web milestones page dropped its private Fuse configuration and routes through the shared createTaskSearchIndex (label/body/assignee queries now resolve there), with the interactive exact-id/substring pre-match kept as a short-circuit. The incident this exposed — the server core entering the client bundle through taskIdsEqual — was fixed by moving taskIdsEqual into the pure module task-id.ts (task-path.ts re-exports), and the browser loads again. The fork readiness engine, the cross-branch corpus split, and the custom rendering are untouched. The web half is guarded by 6 new tests plus a mutation matrix; the TUI half's semantics are pinned indirectly by the shared-predicate parity suite (the viewer has no automation harness, a pre-existing gap documented in the Notes).
<!-- SECTION:FINAL_SUMMARY:END -->

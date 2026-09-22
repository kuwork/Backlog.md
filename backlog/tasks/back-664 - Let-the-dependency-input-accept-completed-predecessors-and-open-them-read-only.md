---
id: BACK-664
title: Let the dependency input accept completed predecessors and open them read-only
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-19 08:24'
updated_date: '2026-09-19 16:21'
labels: []
dependencies:
  - BACK-662
  - BACK-663
  - BACK-615
references:
  - src/utils/task-builders.ts
  - src/core/backlog.ts
  - src/web/components/DependencyInput.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
modified_files:
  - src/utils/task-builders.ts
  - src/web/components/DependencyInput.tsx
  - src/web/components/CompletedBadge.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
  - src/test/dependency.test.ts
  - src/test/web-dependency-input-completed.test.tsx
  - src/test/web-completed-task-modal.test.tsx
ordinal: 250400
actual_start: '2026-09-19 08:25'
actual_end: '2026-09-19 08:50'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User-reported, using BACK-629 as the worked example: its dependency BACK-624 has been moved to `backlog/completed/`, and the task popup still shows that predecessor as a bare string it can neither open nor edit.

The dependency surface stops short in four places:

1. **Write.** `validateDependencies` (src/utils/task-builders.ts) builds its known-ID corpus from `core.queryTasks()` plus drafts only, so a completed target is refused. Probing `["BACK-624", "BACK-663", "BACK-9999"]` against this repository returns `valid: ["BACK-663"]`, `invalid: ["BACK-624", "BACK-9999"]`; `updateTaskFromInput` (src/core/backlog.ts) turns that into the hard error "The following dependencies do not exist: BACK-624 ...". A completed predecessor can therefore be neither added nor kept while saving a list that already contains one. The ported fix for this is not in the worktree: the fork's `task-builders.ts` has diverged from the shape that fix assumed (no `resolveUniqueDependency`, no cycle check), so it has to be re-expressed here. The fork's migration note for it, `draft-136`, records the change as done - no part of it is in the worktree.

2. **Chip resolution.** `DependencyInput` builds its chip index from `availableTasks` alone (src/web/components/DependencyInput.tsx), which App fills with the active board corpus (src/web/App.tsx). A completed predecessor does not resolve, so the chip renders as a plain, unclickable `BACK-624` instead of `BACK-624 - Global Spotlight-style search dialog for Web UI`.

3. **Click-through.** Both the chip's `onTaskClick` and `handleTaskClick` look the target up in `availableTasks` (src/web/components/TaskDetailsModal.tsx), so a completed target falls through to `navigate("/task/624")` - and that deep link cannot resolve either, because App matches the board corpus or a `preloadedTask` only and replaces anything else with the board. Clicking a completed predecessor bounces back to the board.

4. **Suggestions.** The dropdown filters `availableTasks` (src/web/components/DependencyInput.tsx), so completed tasks are never offered, even though `/api/search?completed=true&type=task&query=...` already returns them (BACK-662).

What BACK-662 and BACK-663 already provide, verified live on this repository: `/api/task/624` returns `source: "completed"`, so `source` is the read-only signal; `/api/search?completed=true` widens the task corpus (12 results for "spotlight" against 9 without the flag); the modal already fetches unresolved dependency IDs into `offBoardDependencies` (src/web/components/TaskDetailsModal.tsx) for the readiness verdict; and BACK-663 makes any `source: "completed"` popup open read-only with the archive hint.

Scope: one user-visible outcome - a completed predecessor is offered by the dependency input, displayed with its title, and opens read-only when clicked. The write-side widening mirrors the ported fix and is included because the picker is unusable without it. The read side reuses the records the modal already fetches instead of adding a second corpus fetch, and reuses BACK-662's search flag for suggestions instead of a new endpoint.

Non-goals: no change to readiness or dependency-graph semantics, no change to the board or search-dialog corpora, no dependency-graph visualization work.

Two deliberate differences from the ported fix, both settled once the write path was running:

- Archived records stay out of the corpus. Archiving releases the ID to the next task (the allocator counts active and completed records only), so a leftover archived file would make an ordinary dependency on that ID's new holder ambiguous and the ID unusable as a target. A dependency whose ID only an archived record carries is refused like any unknown id.
- The ported fix's second check is kept: `core.loadTaskById(resolved, { includeCrossBranch: false })` runs after the corpus match. `queryTasks()` reports one record per identity, so it cannot see two files in `backlog/tasks/` claiming the same ID; only the working-copy lookup fails closed on that shape.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A dependency on a task that lives in backlog/completed/ is accepted at create and edit time on CLI, MCP, and web; unknown IDs are still rejected with the existing error; several records claiming one identity fail closed with AmbiguousTaskIdError instead of resolving to one of them; an archived record is never a target, because archiving releases the ID to the next task
- [x] #2 Editing and saving a task whose dependency list already contains a completed predecessor no longer errors and does not drop that entry
- [x] #3 In the dependency input a completed predecessor chip resolves to BACK-624 - <title> and renders as a link, exactly like an active dependency chip
- [x] #4 Clicking that chip opens BACK-624 read-only with the completed-archive hint, using the same drill-down and back behavior as an active chip, and does not bounce to the board
- [x] #5 Typing in the dependency input offers matching completed tasks in the dropdown, marked with the existing completed label, and selecting one adds a dependency that saves successfully
- [x] #6 Active-task behavior is unchanged: suggestions, chip links, drill-down, and readiness verdicts on the board
- [x] #7 Tests cover the completed target at create and edit time, the archived target rejection, the id the archive released resolving to the task that reused it, unknown ID rejection, the cross-store duplicate identity, two working-copy files claiming one identity, the completed chip link and its click-through, and the suggestion inclusion; each new test is confirmed red with the corresponding change reverted
- [x] #8 bunx tsc --noEmit passes and bun run check . passes for touched files
- [x] #9 The dependency input's completed suggestion rows render that same shared badge, keeping the picker's compact chip shape, so the picker, the board card and the task list row cannot drift apart, and a row-level assertion pins the palette against the old grey chip returning
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Both halves landed.

Write path (src/utils/task-builders.ts): validateDependencies resolves targets across working-copy tasks, drafts and completed records, and runs each input through a new resolveUniqueDependency helper. Several matches are never resolved silently - one canonical identity claimed by several records raises AmbiguousTaskIdError, and an input naming more than one identity raises AmbiguousIdError, which only a caller passing a raw unprefixed value can produce because the write path normalizes ids first. The resolved id then goes through core.loadTaskById(resolved, { includeCrossBranch: false }), called for its ambiguity check: queryTasks() reports one record per identity, so two files in backlog/tasks/ claiming one ID are invisible to the corpus match and only this working-copy lookup fails closed on that shape. Archived records are excluded from the corpus on purpose - archiving releases the ID to the next task, so keeping the archived file would make an ordinary dependency on the new holder ambiguous and the ID unusable as a target, exactly the defect a later `backlog doctor` run would have to repair. That fail-closed guard is new to the fork (it arrives with the ported fix), so an input that previously resolved to whichever record came first now errors instead of guessing. Equivalent spellings of one task (1 and BACK-1) no longer persist twice.

Web: TaskDetailsModal derives a dependencyCorpus (board corpus plus the records fetched by ID for the readiness verdict) and hands it to DependencyInput, so a completed predecessor resolves to its title, the picker offers those records and clicking one drills down carrying the record itself. App.handleDrillDown now puts preloadedTask in the navigation state the way the search dialog does, so the modal opens a target outside the board corpus instead of hitting the unknown-id fallback to the board. DependencyInput gained an optional searchCompletedTasks source, debounced at 250 ms, merged into the dropdown and marked with the existing completed label. Its textarea moved from onChange to onInput: for a text control React's onChange *is* the input event, but only the onInput binding can be driven in JSDOM, and the repo's milestone search field already binds that way.

Verified against the running board (bun src/cli.ts browser -p 6467, headless Chrome over CDP):
- /task/629: the predecessor chip renders "BACK-624 - Global Spotlight-style search dialog for Web UI" and links to /task/624; clicking it lands on /task/624/global-spotlight-style-search-dialog-for-web-ui with the completed-archive hint, no edit button and no comment box.
- /task/663: typing "spotlight" issues /api/search?query=spotlight&type=task&completed=true&limit=8 and the first row reads "BACK-624" followed by the localized completed marker and the task's title.

Revert verification, one half at a time (each run confirmed red, then restored):
- corpus widening reverted -> the completed, archived and duplicate-identity cases fail.
- archived exclusion reverted (archived records back in the corpus) -> both archived cases fail: the archived target is accepted again, and the id the archive released stops resolving to the task that reused it.
- the working-copy ambiguity lookup removed -> only the two-files-in-tasks/ case fails; the cross-store duplicate case stays green, because the corpus match catches that one.
- dependencyCorpus reverted at the DependencyInput call site -> both chip cases fail.
- only preloadedTask removed from handleDrillDown -> the click-through case fails while the chip case stays green.
- debounced completed search removed -> the two suggestion cases fail while the active-task control stays green.

Gates: bunx tsc --noEmit clean; bun run check . clean (3 pre-existing assets.ts warnings); bun test src/test/dependency.test.ts 15 pass, src/test/cli-dependency.test.ts 22 pass, and web-dependency-input-completed + web-dependency-input-links + web-completed-task-modal 15 pass.

Review follow-up, from the picker's own marker: its completed suggestion rows still wore a one-off grey chip (`bg-gray-200 text-gray-600`, inherited from the search dialog) while the board card and the task list row had moved to an emerald marker, so the picker was the one place that marker had not followed. `CompletedBadge` therefore lands here, where the dependency input first needs it, together with the `common.completedBadge` label it renders in all four locales, and BACK-665's two surfaces render that same component: `DependencyInput` passes the picker's compact chip shape (`rounded-circle px-1.5 py-0.5 text-[10px] font-medium`) and keeps BACK-663's corpus tooltip, and `web-dependency-input-completed` pins the palette on the row so the grey chip cannot come back.

Verified on the running board (`bun src/cli.ts browser -p 6469 --no-open`, headless Chrome over CDP, deep link /task/629, typing "baseline" - not "spotlight", because BACK-624 is already a dependency of BACK-629 and is therefore correctly kept out of the suggestions): the dropdown marker computes `oklch(0.508 0.118 165.612)` on `rgb(255, 255, 255)`, identical to the task list's marker measured in the same page.

Revert verification: the marker put back on the old grey chip -> only the new colour assertion fails, the other two suggestion cases stay green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A completed predecessor is now a first-class dependency target end to end. validateDependencies (src/utils/task-builders.ts) resolves targets across working-copy tasks, drafts and completed records, with several matches failing closed rather than resolving to whichever record came first - the fork-side equivalent of the ported fix, needed because the picker cannot offer a record the write path refuses. On the web side TaskDetailsModal hands the dependency input the board corpus plus the records it already fetches by ID, so a completed predecessor chip shows its title and links, clicking it opens that record read-only through BACK-663's treatment, and the picker's dropdown offers matching completed tasks from BACK-662's /api/search?completed=true, marked with the existing completed label. Verified on the running board with BACK-629 and BACK-624, and with each half of the change reverted in turn.

Two shapes were settled after that first pass. Archived records stay out of the corpus: archiving releases the ID to the next task, so a leftover archived file would make an ordinary dependency on the new holder ambiguous and the ID unusable as a target, which is why a dependency that only an archived record carries is refused like any unknown id. The ported fix's second check is kept for the opposite reason: queryTasks() reports one identity as one record, so two files in backlog/tasks/ claiming the same ID are only visible to the working-copy lookup, which fails closed with AmbiguousTaskIdError. Both are pinned by tests, each confirmed red with its half of the change reverted.

Follow-up: the dependency input's completed suggestion rows render that shared emerald marker - `CompletedBadge`, added here because the picker is where it is first needed - instead of a one-off grey chip, so the picker, the board card and the task list row carry one palette and one tooltip, and a row-level assertion goes red if the grey chip comes back.
<!-- SECTION:FINAL_SUMMARY:END -->

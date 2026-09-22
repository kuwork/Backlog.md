---
id: BACK-685
title: Single-source task search config and filters in core
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-29 21:04'
updated_date: '2026-09-22 06:32'
labels:
  - cli
dependencies: []
references:
  - src/utils/task-search.ts
  - src/core/search-service.ts
  - 'src/core/backlog.ts:621'
  - 'src/mcp/tools/tasks/handlers.ts:199'
  - 'src/cli.ts:272'
modified_files:
  - src/utils/task-search.ts
  - src/core/search-service.ts
  - src/core/backlog.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/cli.ts
  - src/test/task-search-parity.test.ts
actual_start: '2026-09-22 01:51'
actual_end: '2026-09-22 03:09'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task search and filtering are implemented five times in this codebase with real behavior drift:

- `Core.applyTaskFilters` (src/core/backlog.ts:621) matches any label and ignores the labelMatch parameter entirely.
- SearchService keeps two private filter copies (src/core/search-service.ts:392 and :435), both any-label only.
- The MCP task_list path filters labels with a case-sensitive `Array.includes` in two places (src/mcp/tools/tasks/handlers.ts:199-205 and :272-278).
- The CLI re-implements all-label matching locally (src/cli.ts:272) because the core filter cannot do it.
- src/utils/task-search.ts has the only copy that supports labelMatch any|all.

The searchable corpus also drifts: the local index builder (src/utils/task-search.ts:125) puts labels and assignees into the searchable text, while the cross-branch SearchService builder (src/core/search-service.ts:592) does not — the same query finds a task via `task list --search` and the TUI but not via `backlog search` or the web API (verified by probe).

Unify: make src/utils/task-search.ts the single owner of the searchable-entity builder, the Fuse key/weight/threshold config, and one shared filter predicate set, consumed by SearchService, Core, the CLI, and the MCP adapter. Labels and assignees become searchable text on every surface. The fork-specific extensions survive: wiki entities stay in the search corpus and the `fileName` key stays in the service-side Fuse options. The local vs cross-branch corpus split stays a deliberate caller decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-649 and git show 23403d5b as implementation reference.
- [x] #2 One module owns the Fuse config and the searchable-text builder; SearchService imports it and its duplicated config is deleted.
- [x] #3 A query matching a label or an assignee finds the task identically via backlog search, task list --search, MCP, and the web API.
- [x] #4 One shared filter implementation with explicitly resolved labelMatch semantics; the five divergent copies are deleted or delegate to it.
- [x] #5 The fork-specific search extensions survive: wiki entities stay in the search corpus, the fileName key (weight 0.25) stays in the service-side Fuse options, and the board/unified-view filter consumers keep working.
- [x] #6 MCP label matching is case-insensitive like every other surface.
- [x] #7 Tests pin the cross-surface parity including the labels and assignees cases; bunx tsc --noEmit, bun run check ., and bun test pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Start by reading references/current-branch-migration-exclusions.md.

### Phase 1 - Single owner in src/utils/task-search.ts

- Export `buildTaskSearchBodyText(task)` (description, AC items, plan, notes, comments, labels, assignee, modifiedFiles) and `buildTaskSearchFields(task)`; export `TASK_SEARCH_FUSE_OPTIONS` with the existing key/weight set (title 0.35, bodyText 0.3, id 0.2, idVariants 0.1, dependencyIds 0.05, modifiedFiles 0.15, threshold 0.35) so the indexed keys and the text behind them can never drift apart.
- Extend the shared filter options to the union of every existing copy (status, excludeStatus, priority, assignee, unassigned, labels+labelMatch, modifiedFiles, parentTaskId, milestone + resolveMilestoneLabel, ready) and export `createTaskFilterMatcher(options, corpus)`; keep `applyTaskFilters` / `applySharedTaskFilters` as thin wrappers over it so the board (src/ui/board.ts:389) and unified view (src/ui/unified-view.ts:172) consumers keep working.

### Phase 2 - SearchService (src/core/search-service.ts)

- Replace `buildTaskBodyText` with the shared builders for task entities; delete the inline Fuse config and BOTH private filter copies (`applyTaskFilters`, `matchesTaskFilters`) plus `NormalizedFilters`, filtering tasks through the shared matcher over `entity.task`.
- Keep the wiki entity corpus (the BACK-481 capability at :301-309) and extend the service-side Fuse options with the `fileName` key (weight 0.25) instead of adopting the shared options wholesale.

### Phase 3 - Core / CLI / MCP

- src/core/backlog.ts: `Core.applyTaskFilters` delegates to the shared matcher (keep the statusExcluded / parentTaskId / milestone surfaces intact).
- src/cli.ts: delete `taskMatchesAllLabels`; the plain/JSON task list passes labels + labelMatch "all" through baseFilters like every other filter.
- src/mcp/tools/tasks/handlers.ts: delete the two hand-rolled label loops (task path and draft path) and use the shared filters; label matching becomes case-insensitive like every other surface.

### Phase 4 - labelMatch resolution and tests

- Default "any"; the CLI `task list --labels` flag and the MCP task_list labels argument pass "all" (matches the documented CLI contract and MCP's existing every-label behavior); interactive pickers keep "any".
- Add src/test/task-search-parity.test.ts pinning: the corpus builder puts labels/assignees in the searchable text; a label query and an assignee query return the same task through createTaskSearchIndex and SearchService; labelMatch any/all semantics; filter wiring through the real CLI and MCP surfaces (the wiki corpus and the fileName key get their own pins).
- Run bunx tsc --noEmit, bun run check ., and bun test; then do the mandatory revert-and-rerun regression check on the new suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation Notes

- src/utils/task-search.ts rewritten as the single owner: new exports `buildTaskSearchBodyText` / `buildTaskSearchFields` / `TASK_SEARCH_FUSE_OPTIONS` / `createTaskFilterMatcher(options, corpus)`; `applyTaskFilters` / `applySharedTaskFilters` / `createTaskSearchIndex` signatures and option types unchanged (zero changes needed at the board.ts:389, unified-view.ts:172, and task-viewer-with-search.ts consumers), and `scoreThreshold` plus the fork's ID-variant algorithm preserved. The predicate semantics are the union of the five copies (status/statusExcluded/assignee/unassigned/priority/labels+labelMatch/modifiedFiles/parentTaskId/milestone+resolver/ready); labelMatch defaults to any.
- src/core/search-service.ts: task entities now come from the shared builders (labels/assignees enter the searchable text, closing the cross-surface corpus drift); deleted `buildTaskBodyText`, the inline Fuse config, `NormalizedFilters`, both private filter copies (`applyTaskFilters`, `matchesTaskFilters`) and the four normalize helpers; task filtering goes through the shared predicate. **The wiki corpus (entity building at :228-237) and the `fileName:0.25` key are preserved** — the service-side Fuse options are the shared options plus the fileName extension key. Also fixed a pre-existing gap where dispose() left the wikis array reset out.
- src/core/backlog.ts: `Core.applyTaskFilters` now delegates to the shared predicate (milestone resolver, statusExcluded, parentTaskId surfaces intact); the queryTasks search path passes labelMatch through into searchFilters; removed the now-unused imports (normalizeStatusSet/statusMatchesSet/createMilestoneFilterMatcher).
- src/cli.ts: deleted `taskMatchesAllLabels` and the labelsToLower import; `--labels` now flows through baseFilters.labels + labelMatch "all" into the core predicate (identical semantics across plain, JSON, and interactive paths); narrowForDisplay keeps only sort/parent/limit.
- src/mcp/tools/tasks/handlers.ts: the draft path is a single applyTaskFilters call (the "search narrows drafts to the literal Draft status, list does not" behavior and the 0.45 scoreThreshold preserved); the task path passes labels + labelMatch "all" through filters and the local case-sensitive loops are gone; new createMilestoneFilterValueResolver helper. The MCP label case-sensitivity defect is fixed as a side effect.
- src/types/index.ts: `TaskListFilter` and `SearchFilters` each gain `labelMatch?: "any" | "all"` (additive only).
- Added src/test/test-cli.ts (getTestCliPath shim the fork was missing) and src/test/task-search-parity.test.ts (14 cases: corpus builder, cross-surface label/assignee parity, labelMatch any/all, CLI/MCP wiring, MCP draft label case-insensitivity, wiki corpus by file name and by content with the fileName key pinned via match metadata). The upstream project-related cases were not ported because the fork has no project field.

### Verification

- `bunx tsc --noEmit` passes; `bun run check .` passes (only the three pre-existing HEAD warnings in src/core/assets.ts remain).
- Parity suite 14/14. Mutation matrix (tmp/core20-writeback/mutation_check.py, file restored byte-identically after every run): A (corpus without labels/assignees) turns exactly 3 cases red; B (MCP labelMatch "all" dropped) turns exactly 2; C (fileName key removed) turns exactly 1; baseline and post-restore runs are green.
- Full `bun test`: unrelated pre-existing reds are the cli-json-output compact-envelope case (red at HEAD; json-output emits source:null), the mcp-server workflow-overview case (red at HEAD), and the web search-results getSearchResultMeta case (its import graph contains none of the changed files; red at HEAD). Section-marker and the content-store moved-document timeouts flake only under full-suite load and pass scoped with this change. Eighteen stale probe .test files left in tmp/ by earlier tasks were moved to tmp/_stale-probes/ (renamed so bun no longer picks them up), removing the module-resolution error noise from full runs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/utils/task-search.ts is now the single owner of task search and filtering: it exports `buildTaskSearchBodyText` / `buildTaskSearchFields` / `TASK_SEARCH_FUSE_OPTIONS` / `createTaskFilterMatcher`, and the five filter implementations (the Core private method, both SearchService private copies, the CLI local helper, and the two MCP hand-rolled loops) collapsed into one shared predicate set, with `applyTaskFilters` / `applySharedTaskFilters` / `createTaskSearchIndex` keeping their signatures and behavior for existing consumers. Labels and assignees are searchable text on every surface, so `backlog search` / the web API agree with `task list --search` / the TUI / MCP on the same query. labelMatch is explicit: any by default, with the CLI `--labels` flag and the MCP task_list labels argument passing all (matching the documented CLI contract and MCP's existing every-label behavior); interactive pickers stay any, and MCP label matching is now case-insensitive. All fork-specific extensions survive: wiki entities stay in the search corpus, the service-side Fuse options extend the shared config with the `fileName:0.25` key, and the board/unified-view filter entry points are unchanged. Regression is pinned by the 14-case src/test/task-search-parity.test.ts (including a mutation matrix proving the cases discriminate).
<!-- SECTION:FINAL_SUMMARY:END -->

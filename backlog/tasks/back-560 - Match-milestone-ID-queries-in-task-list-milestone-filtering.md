---
id: BACK-560
title: Match milestone ID queries in task list milestone filtering
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-02 18:01'
updated_date: '2026-08-15 07:47'
labels: []
dependencies: []
references:
  - src/utils/milestone-filter.ts
  - src/utils/task-search.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/unified-view.ts
  - src/cli.ts
  - src/mcp/tools/tasks/handlers.ts
actual_start: '2026-08-15 07:35'
actual_end: '2026-08-15 07:46'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Milestone filtering in task lists accepted milestone titles but failed for numeric or canonical milestone IDs (for example 0 or m-0), even when tasks store the canonical ID. Punctuated titles (e.g. Release-1) also could not round-trip through the interactive list because the CLI seeded a normalized value while the interactive matcher compares raw titles.

Restore the documented Milestone ID or title contract consistently across the canonical CLI listing, the interactive task list, and the MCP task_list adapter (active and Draft paths) without changing unrelated milestone behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-564 and git show 2dcc901 as implementation reference.
- [x] #2 Numeric and canonical milestone ID queries, including case variants, list only tasks assigned to that milestone.
- [x] #3 Milestone title filtering continues to support exact, partial, and typo queries, including titles whose punctuation is semantically significant to interactive matching.
- [x] #4 Plain CLI task-list output and the interactive task list resolve milestone IDs and punctuated titles consistently.
- [x] #5 MCP task_list resolves milestone IDs consistently for active tasks and for the Draft status path.
- [x] #6 Queries that match no configured milestone return no tasks rather than unrelated tasks.
- [x] #7 Regression tests cover shared matching, CLI output, interactive filtering, and MCP active-task and draft paths.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Upgrade src/utils/milestone-filter.ts: createMilestoneFilterValueResolver now returns a MilestoneFilterValueResolver (callable plus resolveExactId / resolveExactTitle / resolveId) built from id-keyed and title-keyed maps with canonical-alias precedence; normalizeMilestoneFilterValue switches to the \p{L}\p{N} Unicode character class so symbol-only and non-ASCII titles keep their identity; add resolveMilestoneFilterTitle and createMilestoneFilterMatcher (exact ID beats title, exact title beats fuzzy, else closest title match).
2. src/utils/task-search.ts applyMilestoneFilter gains a milestoneCandidates parameter and, when the resolver exposes resolveExactId, filters via createMilestoneFilterMatcher; applyTaskFilters passes the full task list as candidates.
3. src/core/backlog.ts applyTaskFilters uses the same matcher path (falling back to an empty resolver) instead of resolveClosestMilestoneFilterValue + normalize comparison.
4. src/ui/board.ts replaces its inline milestone-label map with createMilestoneFilterValueResolver.
5. src/ui/task-viewer-with-search.ts removes the duplicate createMilestoneLabelResolver; buildTaskViewerMilestoneFilterModel gains an archivedMilestones parameter and resolves from active + archived; viewTaskEnhanced loads archived milestones.
6. src/ui/unified-view.ts passes archived milestones to buildTaskViewerMilestoneFilterModel at both call sites.
7. src/cli.ts removes the task list pre-seeding block that normalized the milestone filter before the interactive view.
8. src/mcp/tools/tasks/handlers.ts Draft path filters via createMilestoneFilterMatcher.
9. Tests: milestone-filter.test.ts replaced with the upstream expanded suite (matcher / title resolution); cli-milestone-filter.test.ts adds an ID-query case (numeric, canonical, uppercase) plus an unmatched-query case; task-viewer-milestone-filter-model.test.ts adds archived alias resolution; mcp-drafts.test.ts adds milestone-ID filtering for active and Draft paths.
10. Verify bunx tsc --noEmit, biome check, focused milestone/CLI/MCP tests, and board/search regression tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented.

Changes:
- src/utils/milestone-filter.ts: resolver now exposes resolveExactId/resolveExactTitle/resolveId with canonical-alias precedence; normalizeMilestoneFilterValue uses \p{L}\p{N}; added resolveMilestoneFilterTitle and createMilestoneFilterMatcher.
- src/utils/task-search.ts: applyMilestoneFilter takes milestoneCandidates and uses the matcher when the resolver supports it; applyTaskFilters passes the full task list.
- src/core/backlog.ts: applyTaskFilters filters through createMilestoneFilterMatcher.
- src/ui/board.ts: inline milestone-label map replaced with createMilestoneFilterValueResolver.
- src/ui/task-viewer-with-search.ts: removed the duplicate createMilestoneLabelResolver; buildTaskViewerMilestoneFilterModel accepts archivedMilestones; viewTaskEnhanced loads archived milestones.
- src/ui/unified-view.ts: both buildTaskViewerMilestoneFilterModel call sites pass archived milestones.
- src/cli.ts: removed the task-list pre-seeding block that normalized the milestone filter.
- src/mcp/tools/tasks/handlers.ts: Draft path filters via createMilestoneFilterMatcher.

Tests:
- milestone-filter.test.ts replaced with the upstream suite (matcher identity, title resolution, punctuated titles, reused titles) — 20 pass.
- cli-milestone-filter.test.ts: added ID-query case (numeric, canonical, uppercase -> only the ID-stored task) and unmatched-query case — 7 pass total.
- task-viewer-milestone-filter-model.test.ts: added archived alias resolution case — 3 pass.
- mcp-drafts.test.ts: added milestone-ID filtering for active and Draft paths, and active/archived ID distinction with reused titles — 5 pass.
- Regression: board-render, board-loading, cli-search-command, cli-task-milestone — 23 pass. bunx tsc --noEmit pass; biome check pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Milestone filters now resolve numeric IDs (0), canonical IDs (m-0), case variants, and titles consistently in CLI task list, the interactive task list, and MCP task_list active and Draft paths, while preserving exact/partial/typo title matching including punctuation-sensitive titles.

Shared identity-aware matching was implemented in milestone-filter.ts (MilestoneFilterValueResolver + createMilestoneFilterMatcher) and reused by Core query filters, task-search, the interactive viewer/board, and MCP Draft filtering; the CLI no longer pre-seeds a normalized filter value. Archived milestones resolve as aliases without entering the picker.

Verified by 20 milestone-filter unit tests, 7 CLI tests (including the issue #819 ID round trip), 3 model tests, 5 MCP draft tests, 23 board/search regression tests, typecheck, and biome.
<!-- SECTION:FINAL_SUMMARY:END -->

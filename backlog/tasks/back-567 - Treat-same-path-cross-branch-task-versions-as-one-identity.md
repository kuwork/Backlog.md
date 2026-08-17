---
id: BACK-567
title: Treat same-path cross-branch task versions as one identity
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-07-30 17:11'
updated_date: '2026-08-17 04:18'
labels:
  - cli
dependencies: []
references:
  - src/core/task-identity-index.ts
  - src/core/task-loader.ts
  - src/core/backlog.ts
  - src/git/operations.ts
  - src/utils/task-path.ts
  - src/server/index.ts
  - src/test/task-identity-index.test.ts
actual_start: '2026-08-17 04:04'
actual_end: '2026-08-17 04:18'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One task can exist in several git branches at the same file path (e.g. backlog/tasks/task-42 - Login.md). Today the CLI folds display choice, lifecycle state, collision detection, and ID occupancy into separate hand-rolled maps, and a tie in timestamps can free a live task's ID depending on scan order.

This change introduces ONE shared task identity: canonical ID + normalized repository-relative logical path. Same ID at the same path across branches = one task's versions, working copy wins. Same ID at different paths, both active = ambiguous, error instead of guessing. A live variant keeps the ID occupied; when every variant is archived the ID becomes reusable. CLI, MCP, browser, statistics, lifecycle, and allocation all resolve through the same identity rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep 'BACK-557' and git show 928d85c as implementation reference.
- [x] #2 Build a shared TaskIdentityIndex keyed by canonical ID + normalized repository-relative logical path, replacing the fork's ID-keyed Map + resolveTaskConflict + buildLatestStateMap.
- [x] #3 Same canonical ID at the same normalized path across local and branch versions resolves as one identity with the working copy authoritative.
- [x] #4 Same canonical ID at distinct live paths fails closed (AmbiguousTaskIdError) consistently across CLI, MCP, browser, statistics, lifecycle, and allocation.
- [x] #5 A live variant keeps the ID occupied; all-archived identities are hidden and their ID reusable; equal-timestamp resolution is deterministic and scan-order independent (fixes the live-ID release race in fork backlog.ts:915-980).
- [x] #6 Reuse the existing fork normalizeTaskId (src/utils/task-path.ts) as the canonical-ID base instead of porting a separate task-id.ts; parse UTC dates with getStoredUtcTimestamp.
- [x] #7 Keep the fork's cross-branch-tasks.ts data flow (getLatestTaskStatesForIds, recent-branches-only semantics) intact; only the identity/merge layer is replaced.
- [x] #8 Server handleGetTask converges on core.getTask identity resolution and returns 409 on ambiguity.
- [x] #9 Focused tests cover the identity proof matrix (same-path merge, distinct-path collision, padded IDs, all-archived reuse, direct getTask) plus existing board-loading assertions; bunx tsc --noEmit and biome pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 0 - Precondition check (done)

- 0.1 Confirm fork normalizeTaskId / normalizeTaskIdentity (src/utils/task-path.ts:37-56) provide padding/prefix-insensitive canonical IDs; no separate task-id.ts needed. UTC parsing stays on getStoredUtcTimestamp; cross-branch-tasks.ts data flow stays intact.

### Phase 1 - TaskIdentityIndex core (AC #2, #5)

- 1.1 Add src/core/task-identity-index.ts: group records by canonicalTaskId + normalizeRecordPath (repository-relative logical task path, nested/custom backlog dirs normalized).
- 1.2 Deterministic winner: working copy first, then most_recent, then most_progressed; distinct live paths throw AmbiguousTaskIdError.
- 1.3 Expose getTasks / getOccupiedIds / resolve projections; monotone occupancy: any live variant occupies the ID, all-archived identities hide and free the ID.
- 1.4 Verify: unit tests for same-path merge, distinct-path collision, padded IDs, all-archived reuse, equal-timestamp determinism.

### Phase 2 - task-loader identity-aware hydration (AC #3, #6)

- 2.1 Normalize logical task paths when collecting branch records so hydrated versions attach to the indexed path.
- 2.2 Pick hydration candidates per identity (one candidate per canonical ID + logical path) so includeCompleted and statistics cannot omit same-spelling distinct-path identities.
- 2.3 Verify: includeCompleted / statistics tests return both same-spelling distinct-path identities.

### Phase 3 - backlog.ts rework (AC #4, #6)

- 3.1 Remove buildLatestStateMap / filterTasksByStateSnapshots and the separate ID-keyed maps + resolveTaskConflict.
- 3.2 getTask resolves through identityIndex.resolve with centralized coalesced fingerprint refresh (no stale prior load); loadLocalTaskForMutation rejects branch-only tasks.
- 3.3 Allocation and lifecycle use getOccupiedIds, fixing the equal-timestamp live-ID release race (backlog.ts:915-980).
- 3.4 Keep cross-branch-tasks.ts getLatestTaskStatesForIds (recent-branches-only) driving the TUI board filter.
- 3.5 Verify: board-loading assertions still pass; race regression (equal timestamps) covered.

### Phase 4 - Server convergence (AC #7)

- 4.1 handleGetTask converges on core.getTask and returns 409 on ambiguity; browser detail keeps local upsert behavior.
- 4.2 Verify: server task-detail tests pass.

### Phase 5 - Full verification (AC #9)

- 5.1 Run the identity proof matrix plus existing board-loading / Core / MCP / server / Web suites.
- 5.2 bunx tsc --noEmit and biome check on touched files; then finalize the task through the CLI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the shared task identity index in the fork.

### Phase 1 - TaskIdentityIndex core
- Added src/utils/task-path.ts canonicalTaskId (zero-padding-insensitive dotted-decimal grouping, ported from upstream semantics onto the fork's normalizeTaskId/extractTaskBody).
- Added src/core/task-identity-index.ts: groups records by canonicalTaskId + normalizeRecordPath (repository-relative logical path, lifecycle dirs normalized); deterministic winner (working copy first, then most_recent/most_progressed); distinct live paths fail closed (AmbiguousTaskIdError); getTasks/getOccupiedIds/resolve projections.

### Phase 2 - identity-aware hydration
- src/core/task-loader.ts: BranchTaskStateEntry carries the hydrated task; winners now reference their state entry so hydrated content lands on the indexed record.

### Phase 3 - backlog.ts rework
- loadTasks and loadAllTasksForStatistics build one TaskIdentityIndex (local working copy + completed + branch states) and project via getTasks(includeCompleted); removed buildLatestStateMap/filterTasksByStateSnapshots/getActiveAndCompletedIdsFromStateMap.
- getActiveAndCompletedTaskIds now derives occupied IDs from the index, making equal-timestamp resolution scan-order independent (the live-ID release race is gone).
- Core.getTask detects distinct live paths with the same canonical ID and throws AmbiguousTaskIdError.

### Phase 4 - server convergence
- src/server/index.ts handleGetTask resolves through core.getTask and returns 409 with candidates on ambiguity; added public GitOperations.getRepositoryRoot.

### Verification
- task-identity-index 7 pass; board-loading 10; local-branch-tasks 9; core/statistics/parallel/mcp 108 pass across 7 files; server suites 73 pass (one parallel-run disk-full flake re-passed solo); cli 19 pass; tui composer 11 pass; loading tests 11 pass.
- bunx tsc --noEmit pass; biome pass on touched files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Introduced one shared task identity keyed by canonical ID plus normalized repository-relative logical path. Local, branch, completed, and archive records share deterministic working-copy/lifecycle/display rules; distinct live paths fail closed with a 409 on the browser API; any live variant keeps the ID occupied, all-archived identities are reusable, and equal-timestamp resolution no longer depends on scan order.

Branch hydration attaches hydrated content to the indexed records, and Core.getTask plus the browser task detail route resolve through the same identity rules.

Verified by 7 new identity-index tests plus Core/server/statistics/board-loading/mcp/cli regressions, typecheck, and lint.
<!-- SECTION:FINAL_SUMMARY:END -->

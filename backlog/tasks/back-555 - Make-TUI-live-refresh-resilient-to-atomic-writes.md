---
id: BACK-555
title: Make TUI live refresh resilient to atomic writes
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-07-14 19:59'
updated_date: '2026-08-15 05:52'
labels:
  - tui
dependencies: []
references:
  - src/utils/task-watcher.ts
  - src/ui/unified-view.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/board.ts
  - src/utils/task-path.ts
priority: high
actual_start: '2026-08-15 05:19'
actual_end: '2026-08-15 05:35'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current fork's TUI live refresh has a race: CLI atomic writes (per-file autoCommit) emit a single filesystem event, and the watcher may consume it before the task file is stable and readable. No later event arrives, so the board stays stale until restart; a failed read can also be misjudged as a deletion. This repairs existing live refresh behavior; it is not a new feature. Scope is the current checkout only. Cross-branch and separate-worktree refresh are explicitly excluded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-547 and git show 9c29c4c as implementation reference.
- [x] #2 CLI atomic create, edit, status change, archive, and delete operations refresh the open board and list reliably without restart (including single-event partial writes).
- [x] #3 The watcher retries, debounces, or reconciles create/change events until the file parses stably or absence is confirmed, without infinite retries or duplicate publications.
- [x] #4 Selection stays valid when the selected task changes, moves status, archives, or deletes, and active filters reflect the reconciled state; configuration and status updates continue to refresh correctly.
- [x] #5 unified-view applies add/change/archive/delete state transitions through a single callback pipeline while keeping the fork's milestoneMode/milestoneEntities board wiring; task-viewer-with-search gains a live-update subscription option.
- [x] #6 src/utils/task-path.ts exports extractTaskIdFromFilename for reuse by the watcher.
- [x] #7 Real-filesystem tests cover single-event partial create and edit, archive/delete absence, retry recovery, callback deduplication, and bounded failure; integration tests cover unified-view callback behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rework src/utils/task-watcher.ts into a bounded reconciliation model: debounce events by normalized ID, require two stable readable reads, retry transient partial/missing content within a finite budget, suppress duplicate publications, cancel stale generations, and reconcile the directory when atomic writes expose only a temporary-file event; branch-only tasks are excluded from current-checkout reconciliation.
2. Rework the inline callbacks in src/ui/unified-view.ts (around :256-292) into an applyUnifiedTaskUpdate single callback pipeline, keeping selected task objects valid and publishing refreshed task/configuration snapshots to both the board and the active task list; preserve the milestoneMode/milestoneEntities wiring (around :419-420).
3. Add a live-update subscription option to src/ui/task-viewer-with-search.ts that rebuilds the search index and filters from the reconciled state; adapt the task-viewer handoff tests to the fork editor flow.
4. Add deterministic watcher tests (real filesystem reads with controlled single events: partial create/edit, temporary-file atomic create, archive/delete absence, deduplication suppression, bounded incomplete content, branch scope, fs.watch plus child-process CLI atomic edit) and unified-view callback integration coverage; run bunx tsc --noEmit, bun run check, and the relevant test files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented bounded task watcher reconciliation for the current checkout. Task events now debounce by normalized ID, require two stable usable reads, retry transient partial/missing content within a finite budget, suppress duplicate publications, cancel stale generations, and reconcile the directory when atomic writes expose only a temporary-file event. Branch-only tasks are excluded from current-checkout reconciliation.

Unified view now applies add, change, archive, and delete callbacks through one state transition (applyUnifiedTaskUpdate), keeps the selected task object valid (neighbor selection after removal), and publishes refreshed task and configuration snapshots to both the board and the active task list. The task list rebuilds its search index and filters from the reconciled state via subscribeUpdates; the fork's milestoneMode/milestoneEntities board wiring is preserved.

Coverage: deterministic watcher tests (partial create/edit, temporary-file atomic create, archive/delete absence, duplicate suppression, bounded incomplete content, malformed/unreadable retention, directory reconciliation, branch-only scope, real fs.watch + child CLI atomic edit), unified-view callback integration, and interactive PTY scenarios (live refresh in open board, next-neighbor selection on removal).

Validation: bunx tsc --noEmit; bunx biome check on changed files; bun test task-watcher + unified-view-loading (12 pass); board/unified-view regression (26 pass); board/task-viewer UI tests (21 + 13 pass); interactive PTY tests skip on Windows as designed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made TUI live refresh resilient to single-event atomic task writes with bounded stable reconciliation, confirmed file absence, deduplicated updates, unified board and task-list state via a single callback pipeline, and valid neighboring selection after removal. All acceptance criteria verified by deterministic watcher and unified-state tests, typecheck, Biome, and regression suites.
<!-- SECTION:FINAL_SUMMARY:END -->

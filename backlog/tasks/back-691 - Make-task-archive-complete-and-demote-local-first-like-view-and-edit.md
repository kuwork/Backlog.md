---
id: BACK-691
title: >-
  Make task archive, complete, and demote local-first and clean vacated
  dependency references
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-10 06:10'
updated_date: '2026-09-23 04:01'
labels:
  - cli
dependencies: []
references:
  - src/core/backlog.ts
  - src/cli.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/server/index.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/vacated-task-references.test.ts
  - src/test/dependency.test.ts
  - src/test/references.test.ts
modified_files:
  - src/core/backlog.ts
  - src/cli.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/server/index.ts
  - src/ui/board.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/vacated-task-references.test.ts
  - src/test/dependency.test.ts
  - src/test/references.test.ts
actual_start: '2026-09-23 02:59'
actual_end: '2026-09-23 03:48'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task archive, complete, and demote still resolve their CLI targets through the cross-branch corpus loader, so they can trigger a full store refresh for a target the working copy could resolve directly, and a branch-only target reports a different error than task view does. Align the three lifecycle commands with local working-copy resolution (fail-closed ambiguity included).

Separately, freeing a task ID leaves stale references behind: archiving only sanitizes active tasks, so records in backlog/completed keep pointing at the archived ID, and demoting cleans nothing at all - every dependent keeps naming the old ID while the freed number can be allocated to an unrelated new task, at which point the stale reference silently resolves to the wrong task. Archiving and demoting must clean dependencies and references naming the vacated ID across the working copy AND the completed corpus, and report which tasks were changed. Completing a task must not clean anything: a completed dependency is exactly what readiness reads. On demote, references are removed rather than rewritten to the new draft identity. The cleanup lives in core so every surface that archives or demotes inherits it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review both referenced changes as implementation reference: git log --oneline v1.50.1..v1.52.0 --grep BACK-626, git log --oneline v1.50.1..v1.52.0 --grep BACK-673, git show 988d27fe, and git show c4326c94
- [x] #2 task archive, complete, and demote resolve their targets through local working-copy resolution (includeCrossBranch: false) at the CLI preflight and inside the core mutations, with fail-closed AmbiguousTaskIdError preserved for all three commands
- [x] #3 Archiving or demoting a task removes its ID from the dependencies and references of every dependent in both the working copy and the completed corpus; the demote path behind task edit -s Draft performs the same cleanup; completing a task never removes references
- [x] #4 Both operations report which tasks had a reference removed instead of changing them silently, without changing the existing core return shapes (boolean / new draft id)
- [x] #5 Tests cover the misbinding regression (archive or demote, reallocate the freed ID, assert no dependent silently resolves to the new task), completed-corpus cleanup, demote cleanup, and complete-does-not-clean; the revert check shows exactly the new cases failing pre-fix
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Local-first lifecycle resolution

- 1.1 CLI archive/complete preflight resolves through loadTaskById(taskId, { includeCrossBranch: false }); branch-only misses report the same not-found line as task view; drop the now-unreachable cross-branch guards if the working-copy index cannot return them.
- 1.2 Core archiveTask/completeTask/demoteTask accept an optional TaskReadOptions argument and resolve their mutation target through loadWorkingCopyTask when local-only is requested.
- 1.3 AmbiguousTaskIdError stays fail-closed for all three commands.

### Phase 2 - Vacated-ID reference cleanup

- 2.1 Generalize sanitizeArchivedTaskLinks into a shared vacated-id cleanup that scans the active working copy AND the completed corpus, returning sanitized records for both.
- 2.2 archiveTask, demoteTask and demoteTaskWithUpdates run the cleanup; active dependents go through updateTasksBulk, completed dependents are rewritten in place via fs.saveTask (filePath preserved, no updateTask / no onStatusChange side effects).
- 2.3 completeTask stays untouched; ID recycling is unchanged; demote removes references instead of rewriting them to the draft identity.
- 2.4 Surfaces report the cleaned task IDs from core without changing the existing return shapes (boolean / new draft id): CLI prints one terse line, MCP and server include the cleaned ids additively, TUI/web reuse their existing message surfaces.

### Phase 3 - Tests and gates

- 3.1 Regression: reference a task, archive or demote it, allocate the freed ID to a new task, and assert no dependent silently resolves to the new task; plus completed-corpus cleanup, demote cleanup, and complete-does-not-clean cases.
- 3.2 Revert verification: the new regression cases fail against the pre-fix implementation.
- 3.3 bunx tsc --noEmit, bun run check . (per-file filtering for known baseline noise), scoped bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Core: sanitizeArchivedTaskLinks became sanitizeVacatedTaskLinks; collectVacatedIdCleanup scans the active working copy AND the completed corpus and returns sanitized records per corpus. Active dependents go through updateTasksBulk; completed dependents are rewritten in place with fs.saveTask (filePath preserved, so the record is not re-resolved and no onStatusChange fires) - the ContentStore patch on fs.saveTask publishes each write.
- archiveTask / demoteTask accept an optional TaskMutationOptions argument: includeCrossBranch=false resolves the mutation target through loadWorkingCopyTask (working-copy index, fail-closed AmbiguousTaskIdError); onVacatedIdCleanup reports the changed task IDs without changing the existing return shapes (boolean / new draft id). demoteTaskWithUpdates (task edit -s Draft) runs the same cleanup inside its lock span and sanitizes the demoted draft so a self-naming link does not ride into the draft; core.demoteTask re-sanitizes the saved draft for the same reason.
- completeTask stays untouched: a completed dependency is what readiness reads. commitWrittenFile gained an optional trailing alsoWrittenPaths list so the demote/archive commits cover the cleaned files. CLI archive/complete preflight resolves with includeCrossBranch: false and drops the now-unreachable cross-branch guards (a branch-only target reports the same not-found line as task view); CLI/MCP print one cleanup line, the server DELETE/demote responses carry an additive cleanedTaskIds field, and the TUI board/viewer footers append the cleaned IDs. Web toast rendering is not wired in this task; the data is available from the server responses.
- Tests: src/test/vacated-task-references.test.ts (7 cases) pins the misbinding regression (dependent moved to completed, archive the target, allocator reissues the ID, assert no surviving reference), completed-corpus cleanup, demote cleanup on both corpora, edit-path demote cleanup, complete-does-not-clean, fail-closed ambiguity, and local-only misses. dependency.test.ts / references.test.ts assertions that pinned the old leave-the-completed-corpus-alone behavior were updated to the new expectation.
- Revert verification (four targeted in-place reverts: local resolution, completed scan, demote cleanup, edit-path cleanup): exactly the completed-cleanup, demote, edit-path-demote and ambiguity cases fail while the active-cleanup, complete-no-clean and unknown-target guards stay green; both updated existing assertions fail too. Restored and re-verified green.
- Known pre-existing failures on HEAD, unrelated to this task: atomic-task-edit returns-HTTP-409 web endpoint case fails identically with pristine HEAD core/server files (404 from the getTask exists check), and bun run check . has baseline noise (task-path.ts formatting from BACK-686, assets.ts warnings) - the two formatting fixes landed in the BACK-686 history rewrite of this session, so check . is clean again.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task archive, complete, and demote now resolve targets local-first (working-copy index, fail-closed ambiguity) at both the CLI preflight and the core mutation boundary. Archiving and demoting - including the task edit -s Draft path - clean dependencies and references naming the vacated ID across the active working copy and the completed corpus, rewriting completed records in place, and report the cleaned task IDs through a callback so CLI/MCP print one line, server responses carry an additive cleanedTaskIds field and the TUI footers append the IDs, all without changing the existing core return shapes. Completing a task cleans nothing. Seven new regression cases plus two updated existing suites pin the behavior; the revert check shows exactly the new discriminating cases failing pre-fix.
<!-- SECTION:FINAL_SUMMARY:END -->

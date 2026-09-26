---
title: BACK-691 Make task archive, complete, and demote local-first and clean vacated dependency references
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - task-lifecycle
  - core
source_path: backlog/tasks/back-691 - Make-task-archive-complete-and-demote-local-first-like-view-and-edit.md
---

# BACK-691 Make task archive, complete, and demote local-first and clean vacated dependency references

Archive, complete, and demote resolved their targets through the cross-branch corpus loader, triggering full store refreshes for targets the working copy could resolve directly. Separately, freeing a task ID left stale dependencies/references pointing at it — dangerous once the freed number is reallocated to an unrelated task. This task makes all three commands local-first and cleans vacated-ID references across the working copy and the completed corpus.

## Summary

- Core: `sanitizeArchivedTaskLinks` became `sanitizeVacatedTaskLinks`; `collectVacatedIdCleanup` scans both the active working copy and the completed corpus; active dependents go through `updateTasksBulk`, completed dependents are rewritten in place via `fs.saveTask` (filePath preserved, no `onStatusChange` side effects)
- `archiveTask`/`demoteTask` accept optional `TaskMutationOptions`: `includeCrossBranch=false` resolves the target through the working-copy index with fail-closed `AmbiguousTaskIdError`; `onVacatedIdCleanup` reports changed task IDs without changing the existing return shapes (boolean / new draft id)
- `demoteTaskWithUpdates` (`task edit -s Draft`) runs the same cleanup inside its lock span and sanitizes the demoted draft so a self-naming link does not ride into the draft; on demote, references are removed rather than rewritten to the new draft identity
- `completeTask` cleans nothing — a completed dependency is exactly what readiness reads
- Surfaces: CLI archive/complete preflight resolves with `includeCrossBranch: false`; CLI/MCP print one cleanup line, server DELETE/demote responses carry an additive `cleanedTaskIds` field, TUI footers append the cleaned IDs; `commitWrittenFile` gained an `alsoWrittenPaths` list so commits cover the cleaned files
- Tests: `src/test/vacated-task-references.test.ts` (7 cases) pins the misbinding regression (archive/demote, reallocate the freed ID, assert no dependent silently resolves), completed-corpus cleanup, demote cleanup, edit-path demote, complete-does-not-clean, and fail-closed ambiguity; four targeted in-place reverts confirm exactly the discriminating cases fail pre-fix

## Acceptance Criteria

- Archive, complete, and demote resolve targets local-first at both the CLI preflight and the core mutation boundary, with fail-closed ambiguity preserved
- Archiving or demoting removes the vacated ID from dependencies and references of every dependent in both the working copy and the completed corpus
- Completing never removes references
- Cleaned task IDs are reported to every surface without changing existing core return shapes
- Regression tests cover the misbinding scenario and the revert check discriminates the fix

## Related Concepts

- [[concepts/task-lifecycle]] — archive/complete/demote semantics and vacated-ID cleanup
- [[concepts/task-identity]] — ID recycling and the fail-closed ambiguity guard
- [[concepts/core-architecture]] — where the shared cleanup lives so every surface inherits it

## Related Sources

- [[sources/back-538-duplicate-task-id-recovery]] — duplicate-ID recovery and fail-closed identity
- [[sources/back-567-cross-branch-task-identity]] — the cross-branch resolution these commands bypass
- [[sources/back-600-query-tasks-local-fast-path]] — the local-first resolution direction applied to reads
- [[sources/demote-to-draft-action]] — the demote action whose edit path now cleans references too

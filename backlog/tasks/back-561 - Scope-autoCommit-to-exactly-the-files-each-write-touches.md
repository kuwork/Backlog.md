---
id: BACK-561
title: Scope autoCommit to exactly the files each write touches
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-02 16:16'
updated_date: '2026-08-15 08:28'
labels: []
dependencies: []
references:
  - src/core/backlog.ts
  - src/git/operations.ts
  - src/file-system/operations.ts
  - src/core/content-store.ts
  - src/agent-instructions.ts
actual_start: '2026-08-15 07:50'
actual_end: '2026-08-15 08:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
autoCommit previously staged the entire backlog directory before each commit (stageBacklogDirectory) and, for task files, ran resetIndex + commitStagedChanges. That swept unrelated user-staged and untracked work into Backlog.md commits and cleared the shared index, discarding user staging.

Scope autoCommit to exactly the files each write touches: the new file plus any replaced or moved old paths. Preserve unrelated staged, unstaged, and untracked work across task, draft, document, decision, milestone, and agent-instruction auto-commits, and remove the index-clearing reset pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-563 and git show 048ce6f as implementation reference.
- [x] #2 autoCommit scopes each write to exactly the paths it touches (new file plus replaced/moved old paths), never staging the whole backlog directory.
- [x] #3 Unrelated user work — staged deletions, untracked files — is preserved across task, draft, document, decision, milestone, and agent-instruction auto-commits.
- [x] #4 The resetIndex/commitStagedChanges pipeline is removed: per-file commits no longer clear the shared index or sweep user-staged changes.
- [x] #5 updateTask returns the written file path; updateTasksBulk commits only the collected paths; archive/complete tasks commit both sides of the file move.
- [x] #6 Regression tests cover scoped commits for task create/update, draft promote/demote/archive (both single-shot and edit-with-updates variants), decisions, documents, and bulk updates.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/file-system/operations.ts: archiveDraft returns { sourcePath, targetPath } | null; demoteTask and promoteDraft accept an onMoved callback; saveDecision and saveDocument return { filepath, removedFilepaths } / { relativePath, removedFilepaths }.
2. src/git/operations.ts: addFiles iterates addFile; commitTaskChange requires a filePath and delegates to commitFiles; commitFiles splits paths across multiple repos and commits with --only using the staged paths from git diff --name-only -z --cached --no-renames (handles non-ASCII names and moved-from paths); delete resetIndex and commitStagedChanges; addAndCommitTaskFile stages only the task file and commits via commitFiles.
3. src/git/operations.ts stageFileMove: stage the old path's deletion with git rm --cached (git add --all on a missing path is a no-op) then add the new path, so moves commit both sides.
4. src/core/backlog.ts: updateTask returns the written file path (string | null); updateTasksBulk collects paths and commits them via addFiles + commitFiles; archiveTask and completeTask commit [from, to] plus sanitized-task paths; archiveDraft, promoteDraft, demoteTask (both single-shot and WithUpdates variants), createDecision, and createDocument go through a new private commitWrittenFile that stages the move/add and commits exactly those paths.
5. src/core/content-store.ts: update the saveDocument / saveDecision patch signatures to match the new fs return types.
6. src/agent-instructions.ts: commit the touched instruction files via commitFiles instead of commitChanges.
7. Tests: port upstream core-autocommit-scope, draft-lifecycle-autocommit-scope, and task-autocommit-index-scope suites (drop the legacy-path bulk case: fork getTaskPath validates the ID against the filename, so a mismatched legacy file is not found); adapt draft-promote/demote assertions to fork return types; fix filesystem.test.ts archiveDraft assertion for the new return shape.
8. Verify bunx tsc --noEmit, biome check, the scoped auto-commit suites, and auto-commit / filesystem / core / agent-instructions regression tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented.

Changes:
- src/file-system/operations.ts: archiveDraft returns { sourcePath, targetPath } | null; demoteTask and promoteDraft take an onMoved callback; saveDecision returns { filepath, removedFilepaths }; saveDocument returns { relativePath, removedFilepaths }.
- src/git/operations.ts: addFiles loops addFile; commitTaskChange requires filePath and delegates to commitFiles; commitFiles splits multi-repo path sets and commits with --only against the staged paths (git diff --name-only -z --cached --no-renames); resetIndex and commitStagedChanges removed; addAndCommitTaskFile no longer resets the index; stageFileMove stages the old path deletion with git rm --cached before adding the new path.
- src/core/backlog.ts: updateTask returns the written path; updateTasksBulk collects and commits only those paths; archiveTask/completeTask commit both move sides; archiveDraft/promoteDraft/demoteTask (single-shot and WithUpdates) plus createDecision/createDocument use the new commitWrittenFile helper.
- src/core/content-store.ts: saveDocument/saveDecision patch signatures updated.
- src/agent-instructions.ts: commitFiles(paths) instead of commitChanges().

Fork adaptations (upstream diff was not applied verbatim):
- No temporary-index CAS pipeline was ported: fork commitFiles keeps the git commit --only semantics, which is sufficient for exact-path commits and preserves user staging.
- git commit --only with staged paths from --no-renames output: fixes moved files committing only one side, non-ASCII (quotepath) filenames, and sources with no git history.
- stageFileMove uses git rm --cached because git add --all on a removed path is a no-op on this platform.
- Dropped the upstream 'legacy saved path' bulk case: fork getTaskPath validates the task ID against the filename, so a file renamed to a mismatched ID is not found (pre-existing fork semantics, not a regression).
- Draft promote/demote assertions adapted to fork return types (Task | false / string | null).

Tests:
- Ported upstream core-autocommit-scope (4 pass), draft-lifecycle-autocommit-scope (4 pass, 2 cases removed/adapted), task-autocommit-index-scope (3 pass): 13 pass.
- Regression: auto-commit 13 pass, filesystem 68 pass (archiveDraft assertion adapted), atomic-task-create 5 pass, symlink-backlog-root 6 pass, core + draft-lifecycle 49 pass, agent-instructions 13 pass.
- bunx tsc --noEmit pass; biome check pass.

\nFollow-up fix (same session):\n- src/core/backlog.ts: added updateDecision(decision, autoCommit) with its own `backlog: Update decision X` commit message; updateDecisionFromContent now routes through it instead of createDecision.\n- src/core/backlog.ts: createDocument gained an optional commitMessage parameter; updateDocumentFromInput passes `backlog: Update document X`. Previously both create and update commits read `Add decision/document`, so history could not distinguish creation from updates.\n- core-autocommit-scope.test.ts: 2 new cases assert Update messages for decision and document updates — 6 pass total. Regression: mcp-documents / core / documentation 59 pass; tsc and biome pass; end-to-end git log shows Add vs Update correctly.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scoped autoCommit to exactly the files each write touches across task create/update, draft promote/demote/archive, decisions, documents, milestone operations, and agent instructions, removing the stageBacklogDirectory whole-directory staging and the resetIndex/commitStagedChanges index-clearing pipeline. Unrelated user-staged and untracked work is now preserved.

fs layer reports moved/removed paths; git layer commits only staged paths via --only (multi-repo aware, non-ASCII safe, move-aware via --no-renames + git rm --cached); Core routes every auto-commit through commitWrittenFile or commitFiles.

Verified by 13 new scoped auto-commit tests and 150+ regression tests across auto-commit, filesystem, core, draft lifecycle, agent instructions, and symlink-root suites, plus typecheck and biome.

\nFollow-up: decision and document updates now commit with `backlog: Update decision X` / `backlog: Update document X` (added updateDecision; createDocument accepts a commit message), so commit history distinguishes creation from updates.
<!-- SECTION:FINAL_SUMMARY:END -->

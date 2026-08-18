---
title: BACK-561 Scope autoCommit to exactly the files each write touches
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - git
  - auto-commit
  - core
source_path: backlog/tasks/back-561 - Scope-autoCommit-to-exactly-the-files-each-write-touches.md
---

# BACK-561 Scope autoCommit to exactly the files each write touches

autoCommit now stages only the files each write touches (new file plus replaced/moved old paths) instead of the whole backlog directory, and no longer clears the shared git index.

## Summary

- `src/file-system/operations.ts`: `archiveDraft` returns `{ sourcePath, targetPath }`; `demoteTask` and `promoteDraft` accept an `onMoved` callback; `saveDecision`/`saveDocument` return removed file paths.
- `src/git/operations.ts`: added `addFiles` loop; `commitTaskChange` delegates to `commitFiles`; `commitFiles` splits multi-repo path sets and commits with `--only` against staged paths from `git diff --name-only -z --cached --no-renames`; removed `resetIndex`/`commitStagedChanges`; `stageFileMove` uses `git rm --cached` for the old path.
- `src/core/backlog.ts`: `updateTask` returns the written file path; `updateTasksBulk` collects paths and commits them; archive/complete commit both sides of the move; create/update of tasks, drafts, decisions, documents, and agent instructions route through a new `commitWrittenFile` helper.
- `src/core/content-store.ts`: updated `saveDocument`/`saveDecision` patch signatures.
- `src/agent-instructions.ts`: commits touched instruction files via `commitFiles(paths)`.
- Follow-up fix: added `updateDecision` and `createDocument` commit-message parameter so updates commit as `Update decision/document`.

## Implementation Notes

Fork adaptation: did not port the upstream temporary-index CAS pipeline; `git commit --only` semantics are sufficient for exact-path commits while preserving user staging. Dropped the upstream legacy-path bulk case because the fork validates task IDs against filenames.

## Related Concepts

- [[concepts/core-architecture]] — Core, FileSystem, and Git integration
- [[concepts/cli-entry]] — CLI commands that trigger autoCommit

## Related Sources

- [[sources/back-538-duplicate-task-id-recovery]] — Doctor duplicate ID recovery

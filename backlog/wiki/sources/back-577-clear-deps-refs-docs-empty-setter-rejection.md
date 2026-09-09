---
title: Add --clear-deps/--clear-refs/--clear-docs to task edit and reject empty list setter values
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - migration
  - cli
  - mcp
  - bug
source_path: backlog/tasks/back-577 - Add-clear-deps-clear-refs-clear-docs-to-task-edit-and-reject-empty-list-setter-values.md
---

# Add --clear-deps/--clear-refs/--clear-docs to task edit and reject empty list setter values

Fixed silent no-op edits: empty `--dep`/`--ref`/`--doc` values in `task edit` left the list unchanged while exiting 0 — a fake success. Added explicit `--clear-deps` / `--clear-refs` / `--clear-docs` flags to clear those lists, and made both task create and task edit reject empty setter values (edit errors point at the matching `--clear-*` flag). MCP `task_edit` now rejects arrays containing empty-string elements; only an explicit empty array `[]` clears a list. Consolidates three upstream tasks (BACK-572/586/618).

## Summary

- `src/cli.ts`: new `--clear-deps`/`--clear-refs`/`--clear-docs` options on `task edit`; shared validators `validateClearableListInput` and `validateTaskListFlags` reject empty setter values for both create and edit, reject clear-vs-setter conflicts, and are included in the interactive-TTY edit predicate so flagged edits apply directly instead of opening the wizard.
- `src/utils/task-edit-builder.ts`: `sanitizeClearableStringArray` rejects arrays containing empty-string elements; explicit `[]` clears the list; deps/refs/docs all route through it.
- `src/utils/task-builders.ts`: `parseClearableStringList` kept for CLI parsing.
- Deliberate divergence from upstream: the fork rejects empty setter values in edit (error points to `--clear-*`) instead of upstream's later `emptyClears` behavior where an explicit empty value equals clear — chosen to keep the fork's list-setter semantics consistent (documented in doc-10 CLI-4).
- MCP: `task_edit` rejects empty-string elements in references/documentation/dependencies arrays; explicit `[]` clears.
- Tests in `src/test/cli-dependency.test.ts`, `src/test/cli-refs-docs.test.ts`, `src/test/mcp-tasks.test.ts`, `src/test/mcp-refs-docs.test.ts` cover clear flags, empty-value rejection, setter/clear conflicts, create errors, and blank-only vs explicit-empty array semantics. Build succeeded to an alternate output path because `dist/backlog.exe` was locked by a running process.

## Acceptance Criteria

- `--clear-deps`/`--clear-refs`/`--clear-docs` each clear the corresponding list.
- task edit rejects empty `--dep`/`--depends-on`/`--ref`/`--doc` values and suggests the matching `--clear-*` flag; task create still rejects empty values.
- Clear flags cannot combine with setter flags for the same field; invalid input leaves the task unchanged.
- MCP `task_edit` rejects empty-string elements; explicit `[]` clears; shared validators used for deps/refs/docs.

## Related Concepts

- [[concepts/cli-entry]] — option definitions, help schema, and TTY predicate for task edit
- [[concepts/mcp-workflow]] — MCP task_edit shares the same validation helpers as the CLI
- [[concepts/task-lifecycle]] — dependencies/references/documentation fields on the task model

## Related Sources

- [[sources/back-578-task-edit-list-set-add-remove-flags]] — the follow-up that adds --add-*/--remove-* on top of these validators (same batch)
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — CLI-4 documents the empty-value-reject divergence from upstream
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — entries B3/B22 grouped this data-correctness cluster as one wave

---
title: Unify task edit --ref/--doc/--dep as set and add --add-* / --remove-* flags
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - migration
  - cli
  - task-editing
source_path: backlog/tasks/back-578 - Unify-task-edit-ref-doc-dep-as-set-and-add-add-and-remove-flags.md
---

# Unify task edit --ref/--doc/--dep as set and add --add-* / --remove-* flags

Unified task edit list-field semantics for references, documentation, and dependencies: `--ref`/`--doc`/`--depends-on`/`--dep` now replace the entire list (set semantics), while new `--add-ref`/`--add-doc`/`--add-depends-on`/`--add-dep` append to existing values. Set and add flags are mutually exclusive in the same command; `--clear-*` remains the explicit clear operation and `--remove-*` removes specific entries by value.

## Summary

- `src/cli.ts`: `--ref` maps to `references`, `--doc` to `documentation`, `--depends-on`/`--dep` to `dependencies` as set/replace operations on task edit; new `--add-*` options map to `addReferences`/`addDocumentation`/`addDependencies` for append semantics.
- `validateTaskListFlags` extended with per-flag blank-value and clear-conflict checks covering the new `--add-*` and existing `--remove-*` flags; mutual-exclusion validation prevents combining `--ref` with `--add-ref` (etc.) in the same command.
- New flags added to option definitions, help schema, and `hasEditFieldFlags` so a TTY with any set/add/remove/clear flag applies directly instead of opening the edit wizard.
- `--remove-ref`/`--remove-doc`/`--remove-dep` remove entries by value, accept repeated occurrences and comma-separated values, and reject blank values with non-zero exit leaving the task unchanged.
- Updated `src/guidelines/agent-guidelines.md` (set/add/remove examples) and `src/guidelines/cli-instructions/task-execution.md`.
- Regression tests in `src/test/cli-refs-docs.test.ts` and `src/test/cli-dependency.test.ts` cover set semantics, add semantics, remove semantics, repeated/comma forms, blank rejection, clear conflicts, set/add mutual exclusion, and the interactive-TTY path.

## Acceptance Criteria

- Remove flags delete by value and leave unrelated entries unchanged; all list flags accept repeated and comma-separated forms; blank remove values are rejected.
- `--clear-*` cannot combine with matching setter/add/remove flags; invalid input does not mutate the task.
- Set flags replace the list, add flags append, set/add are mutually exclusive; TTY predicate includes the new flags; help documents all twelve flags.

## Related Concepts

- [[concepts/cli-entry]] — task edit flag definitions and validation funnel
- [[concepts/task-lifecycle]] — the references/documentation/dependencies list fields

## Related Sources

- [[sources/back-577-clear-deps-refs-docs-empty-setter-rejection]] — introduced the shared validators this task extends (same batch)
- [[sources/back-556-task-edit-append-plan]] — the append-flag precedent (`--append-plan`) for additive edit flags
- [[sources/back-530-append-description]] — related set/append semantics on description

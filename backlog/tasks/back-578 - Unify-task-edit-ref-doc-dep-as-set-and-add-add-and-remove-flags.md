---
id: BACK-578
title: Unify task edit --ref/--doc/--dep as set and add --add-* / --remove-* flags
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-07 21:36'
updated_date: '2026-08-25 00:51'
labels:
  - cli
dependencies: []
references:
  - src/cli.ts
  - src/types/task-edit-args.ts
  - src/utils/task-edit-builder.ts
  - src/test/cli-refs-docs.test.ts
  - src/test/cli-dependency.test.ts
  - src/guidelines/agent-guidelines.md
actual_start: '2026-08-23 08:11'
actual_end: '2026-08-23 08:43'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CLI can clear references, documentation, and dependencies with --clear-refs, --clear-docs, and --clear-deps, and remove individual entries with --remove-ref, --remove-doc, and --remove-dep. In task edit, --ref, --doc, --depends-on, and --dep replace the entire list (set semantics), while new --add-ref, --add-doc, --add-depends-on, and --add-dep flags append to existing values. The set and add flags are mutually exclusive in the same command, while --clear-* remains the explicit way to clear a list and --remove-* removes specific values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 --remove-ref removes references by value and leaves unrelated references unchanged
- [x] #2 --remove-doc removes documentation by value and leaves unrelated documentation unchanged
- [x] #3 --remove-dep removes dependencies by value and leaves unrelated dependencies unchanged
- [x] #4 All three remove flags accept repeated occurrences and comma-separated values like other multi-value task edit flags
- [x] #5 Blank values for any remove flag are rejected with a non-zero exit and the task is left unchanged
- [x] #6 --clear-refs, --clear-docs, and --clear-deps cannot be combined with their matching setter, add, or remove flag, and invalid input does not mutate the task
- [x] #7 --ref, --doc, --depends-on, and --dep replace the entire list in task edit; --add-ref, --add-doc, --add-depends-on, and --add-dep append to existing values. Set and add flags are mutually exclusive
- [x] #8 The interactive-TTY edit wizard predicate includes the new --add-* flags so they apply directly instead of opening the wizard
- [x] #9 CLI help documents --ref, --doc, --depends-on, --dep, --add-ref, --add-doc, --add-depends-on, --add-dep, --remove-ref, --remove-doc, and --remove-dep
- [x] #10 Regression tests cover set semantics, add semantics, remove semantics, repeated and comma forms, blank rejection, clear conflicts, set/add mutual exclusion, and the interactive-TTY path
- [x] #11 bunx tsc --noEmit, bun run check ., scoped tests, and bun run build pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Route task edit --ref, --doc, and --depends-on/--dep to the references/documentation/dependencies model operations so they replace the whole list.
- Add --add-ref, --add-doc, --add-depends-on, and --add-dep options to task edit that map to addReferences/addDocumentation/addDependencies for append semantics.
- Add mutual-exclusion validation so set flags and add flags cannot be combined in the same command.
- Keep --remove-ref, --remove-doc, and --remove-dep for removing specific entries by value; keep --clear-refs, --clear-docs, and --clear-deps as explicit clear operations.
- Add the new --add-* flags to hasEditFieldFlags so an interactive TTY applies them directly instead of opening the edit wizard.
- Update help schema and option descriptions to document set, add, remove, and clear semantics.
- Update src/guidelines/agent-guidelines.md and src/guidelines/cli-instructions/task-execution.md to document set/add/remove/clear examples.
- Extend src/test/cli-refs-docs.test.ts and src/test/cli-dependency.test.ts with set semantics, add semantics, and set/add mutual-exclusion tests.
- Verify with bunx tsc --noEmit, bun run check ., scoped tests, and bun run build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Updated task edit in src/cli.ts so --ref maps to references, --doc maps to documentation, and --depends-on/--dep map to dependencies, making them set/replace-style on task edit. Added --add-ref, --add-doc, --add-depends-on, and --add-dep flags that map to addReferences, addDocumentation, and addDependencies for append semantics.
- Added the four new --add-* options to task edit option definitions, help schema, and hasEditFieldFlags so a TTY with any set/add/remove/clear flag applies directly instead of opening the edit wizard.
- Extended validateTaskListFlags with per-flag blank-value and clear-conflict checks for references, documentation, and dependencies (including the new --add-* and existing --remove-* flags).
- Added mutual-exclusion validation so --ref/--add-ref, --doc/--add-doc, and --depends-on/--dep/--add-depends-on/--add-dep cannot be combined in the same command.
- Updated help-schema optional entries and option descriptions for --ref, --doc, --depends-on, --dep, --add-ref, --add-doc, --add-depends-on, --add-dep, --remove-ref, --remove-doc, and --remove-dep.
- Updated src/guidelines/agent-guidelines.md to document set/add/remove references, documentation, and dependencies examples.
- Extended src/test/cli-refs-docs.test.ts with set semantics tests for --ref/--doc, add semantics tests for --add-ref/--add-doc, and mutual-exclusion assertions.
- Extended src/test/cli-dependency.test.ts with set semantics tests for --depends-on/--dep, add semantics tests for --add-depends-on/--add-dep, and mutual-exclusion assertions.
- Verified with bunx tsc --noEmit, bun run check ., scoped tests, and bun run build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unified task edit list fields for references, documentation, and dependencies: --ref/--doc/--depends-on/--dep now replace the entire list, while new --add-ref/--add-doc/--add-depends-on/--add-dep append to existing values. Preserved --clear-* as the explicit clear operation and --remove-* for removing specific entries. Added mutual-exclusion validation between set and add flags, updated help schema, agent guidelines, and regression tests to match the new semantics. Verified with tsc, biome, scoped tests, and build.
<!-- SECTION:FINAL_SUMMARY:END -->

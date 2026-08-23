---
id: BACK-577
title: >-
  Add --clear-deps/--clear-refs/--clear-docs to task edit and reject empty list
  setter values
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-23 06:08'
updated_date: '2026-08-23 07:17'
labels:
  - cli
  - mcp
dependencies: []
references:
  - src/cli.ts
  - src/utils/task-builders.ts
  - src/utils/task-edit-builder.ts
  - src/test/cli-dependency.test.ts
  - src/test/cli-refs-docs.test.ts
ordinal: 195400
actual_start: '2026-08-23 02:00'
actual_end: '2026-08-23 06:51'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Empty --dep, --ref, and --doc values currently no-op in task edit and leave the list unchanged, which looks like success but does nothing. Empty values in task create are also silently ignored today.

Add explicit --clear-deps, --clear-refs, and --clear-docs flags to task edit for clearing those lists. Reject empty setter values (--dep="", --ref="", --doc="") in both task create and task edit: create errors tell the user to omit the flag, and edit errors point to the matching --clear-* flag. Also reject arrays containing empty string elements in MCP task_edit; only an explicit empty array [] should clear the list. Consolidate validation and sanitization into shared helpers so CLI and MCP stay consistent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-572 and git show a20978d, b33ba6b, c9bbdbd as implementation reference.
- [x] #2 task edit --clear-deps/--clear-refs/--clear-docs each clear the corresponding list
- [x] #3 task edit rejects empty --dep/--depends-on/--ref/--doc values and suggests the matching --clear-* flag
- [x] #4 task create still rejects empty values for these flags
- [x] #5 clear flags cannot be combined with setter flags for the same field and invalid input leaves the task unchanged
- [x] #6 interactive-TTY edit wizard predicate includes the new flags
- [x] #7 MCP task_edit rejects empty string elements in references, documentation, and dependencies arrays; explicit empty arrays clear the list
- [x] #8 shared validateClearableListInput/validateTaskListFlags and sanitizeClearableStringArray are used for deps/refs/docs
- [x] #9 tests cover clear flags, empty-value rejection, conflict rejection, create errors, and MCP behavior
- [x] #10 bunx tsc --noEmit, bun run check ., scoped tests, and bun run build pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
- [x] #4 bunx tsc --noEmit passes
- [x] #5 bun run check . passes (pre-existing warnings only)
- [x] #6 bun test (scoped) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Implementation plan

- Add --clear-deps, --clear-refs, and --clear-docs options to task edit in src/cli.ts
- Add shared validators validateClearableListInput and validateTaskListFlags in src/cli.ts
- Add sanitizeClearableStringArray to src/utils/task-edit-builder.ts and parseClearableStringList to src/utils/task-builders.ts
- Update the task edit action to set each list to [] when the matching clear flag is supplied
- Reject empty --dep/--ref/--doc values in task create and task edit, with edit errors suggesting the matching --clear-* flag
- Update the interactive-TTY edit predicate and MCP task_edit to honor the new helpers
- Add tests covering clear flags, empty-value rejection, setter/clear conflicts, and MCP behavior
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation notes

- src/cli.ts: validateClearableListInput/validateTaskListFlags now reject empty setter values for both task create and task edit; edit errors point to --clear-deps/--clear-refs/--clear-docs. Help text updated. Task edit action only clears via clear flags.
- src/utils/task-edit-builder.ts: sanitizeClearableStringArray now rejects arrays containing empty string elements; explicit empty arrays clear the list.
- src/utils/task-builders.ts: parseClearableStringList kept for CLI parsing.
- Added tests in src/test/cli-dependency.test.ts, src/test/cli-refs-docs.test.ts, src/test/mcp-tasks.test.ts, and src/test/mcp-refs-docs.test.ts covering clear flags, empty-value rejection, setter/clear conflicts, and blank-only vs explicit-empty array semantics.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added --clear-deps/--clear-refs/--clear-docs flags to task edit and made shared validation reject empty setter values for --dep/--ref/--doc in both task create and task edit; edit errors suggest the matching --clear-* flag. MCP task_edit now rejects arrays containing empty string elements while still allowing explicit empty arrays [] to clear the list. Updated the interactive-TTY predicate and added CLI/MCP tests. Verified with bunx tsc --noEmit, bunx biome check, scoped tests, and a successful build to an alternate output path (dist/backlog.exe was locked by a running process during the normal build).
<!-- SECTION:FINAL_SUMMARY:END -->

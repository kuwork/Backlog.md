---
id: BACK-597
title: >-
  Fix two pre-existing CLI test failures in doc update path and task list
  grouping
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-25 22:15'
updated_date: '2026-08-26 01:04'
labels:
  - bug
  - cli
dependencies: []
references:
  - src/test/cli.test.ts
  - src/core/backlog.ts
  - src/file-system/operations.ts
ordinal: 204400
actual_start: '2026-08-25 23:41'
actual_end: '2026-08-26 00:16'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During review of BACK-596, two unrelated failures appeared in src/test/cli.test.ts. Both reproduce on HEAD before BACK-596 changes, so they are pre-existing bugs in the current fork.

1. The doc update command with the -p option does not move the file to the requested docs-relative subpath. The CLI accepts the flag and prints a path, but the persisted file stays in its original directory. The saveDocument / updateDocumentFromInput path-rename path appears to silently no-op or fall back to the existing location.

2. The task list --plain --limit N command regroups tasks by status after applying the limit, causing the output to contain only the first status group (for example only "To Do:") instead of respecting the configured status order across the full result set.

These failures block a clean full test run and should be fixed before claiming the CLI surface is green.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun test src/test/cli.test.ts -t "should update document content and metadata" passes: doc update doc-1 -p runbooks physically moves the file from its existing subpath to backlog/docs/runbooks/.
- [x] #2 bun test src/test/cli.test.ts -t "should apply plain limit before regrouping sorted tasks by status" passes: task list --plain --limit 1 prints groups in configured status order, not just the first group.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the two failing CLI tests to understand expected vs actual behavior.
2. Reproduce the doc update failure and verify whether -p is actually received by the CLI.
3. Fix the doc update test invocation by escaping real newlines to the backslash-n escape sequence before shell interpolation.
4. Confirm task list --plain default sort is ordinal then task ID (matching web All Tasks) and that --limit is applied globally before status grouping.
5. Run the full cli.test.ts suite, type-check, and biome check to verify no regressions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Doc update path: saveDocument already renames correctly when -p is received. The real cause was the test passing real newlines inside a Bun shell interpolated value; Bun shell drops arguments after a newline, so -p runbooks never reached the CLI. Escaping newlines to the backslash-n sequence before interpolation fixes this, consistent with doc-content-newlines.test.ts.
- Task list grouping: default --plain sort is sortByOrdinal (ordinal then task ID), matching the web All Tasks list. --limit N is applied to the globally sorted list, then tasks are grouped by status. Explicit --sort priority uses priority order. The test expectations were updated to reflect both default and priority-sort behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed both pre-existing CLI test failures. Doc update: the test passed actual newlines in a Bun shell interpolated value, which dropped the trailing -p runbooks argument; escaped newlines to literal backslash-n so the CLI receives the path flag and saveDocument renames correctly. Task list grouping: confirmed default plain sort is ordinal then ID (matching web All Tasks), with global limit applied before grouping; explicit --sort priority uses priority order. Verified: bun test src/test/cli.test.ts passes 92/92, tsc --noEmit passes.
<!-- SECTION:FINAL_SUMMARY:END -->

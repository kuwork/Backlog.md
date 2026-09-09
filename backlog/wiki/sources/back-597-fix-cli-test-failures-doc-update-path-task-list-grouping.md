---
title: BACK-597 Fix two pre-existing CLI test failures in doc update path and task list grouping
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - bug
  - cli
  - tests
source_path: backlog/tasks/back-597 - Fix-two-pre-existing-CLI-test-failures-in-doc-update-path-and-task-list-grouping.md
---

# BACK-597 Fix two pre-existing CLI test failures in doc update path and task list grouping

Two failures in `src/test/cli.test.ts` were found during BACK-596 review and reproduced on HEAD as pre-existing fork bugs: the `doc update -p` path-move assertion and the `task list --plain --limit` status-grouping assertion. Both turned out to be test-side defects rather than product bugs: Bun shell interpolation drops arguments after real newlines, and the grouping test assumed a different sort/limit order than the implemented (correct) behavior.

## Summary

- Doc update failure root cause: the test passed real newlines inside a Bun shell interpolated value; Bun shell drops arguments after a newline, so `-p runbooks` never reached the CLI. Fixed by escaping newlines to the literal backslash-n sequence before interpolation (same pattern as doc-content-newlines.test.ts); `saveDocument` itself already renamed correctly.
- Task list grouping: confirmed the default `--plain` sort is `sortByOrdinal` (ordinal then task ID), matching the web All Tasks list; `--limit N` is applied to the globally sorted list before grouping by status. Explicit `--sort priority` uses priority order.
- Test expectations updated to reflect both default (ordinal) and priority-sort behavior; no source changes needed.
- Verified `bun test src/test/cli.test.ts` passes 92/92 plus type-check and biome.

## Acceptance Criteria

- `doc update doc-1 -p runbooks` physically moves the file to `backlog/docs/runbooks/` in the test.
- `task list --plain --limit 1` prints groups in configured status order, not just the first group.

## Related Concepts

- [[concepts/cli-entry]] — CLI flag handling and plain-output grouping semantics for task list and doc update commands.
- [[concepts/task-lifecycle]] — Status grouping and ordinal sort order of task listings.

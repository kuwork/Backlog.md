---
title: Clear task dependencies through the CLI (draft-92)
created_date: '2026-09-08 17:00'
updated_date: '2026-09-08 17:00'
labels:
  - source
  - draft
  - cli
  - bug
source_path: backlog/drafts/draft-92 - Clear-task-dependencies-through-the-CLI.md
---

# Clear task dependencies through the CLI (draft-92)

Upstream GitHub issue #839: `task edit` silently ignored an empty dependency value, reported success without changing the task, and offered no supported way to remove dependencies. This draft adds `task edit --clear-deps` and rejects empty `--depends-on`/`--dep` values so no-op edits can no longer report false success. Migrated into the fork as BACK-577 (with --clear-refs/--clear-docs extended in the same task), Done.

## Summary

- `task edit --clear-deps` removes all dependencies, following the existing clear-* validation pattern; it cannot be combined with `--depends-on`/`--dep` and does not mutate the task on invalid input.
- Empty `--depends-on`/`--dep` values are rejected instead of reporting a successful no-op.
- PR #840 review follow-up fixed three defects: `--clear-deps` added to `hasEditFieldFlags()` in `src/cli.ts` (without it, a TTY `task edit X --clear-deps` opened the wizard and never cleared); each raw `--depends-on`/`--dep` occurrence is validated individually (so `--depends-on "" --dep TASK-1` no longer slips through); MCP `task_edit` treats a blank-only dependency array like `["   "]` as a no-op while explicit `[]` still clears, mirroring the labels convention in `buildTaskUpdateInput`.
- Coverage: CLI regression test drives the edit through a faked-TTY entry point without `--plain`, a CLI case for an empty value alongside a valid one, and an MCP test mirroring the blank-only labels test.
- Verified with `bun test src/test/cli-dependency.test.ts`, `bunx tsc --noEmit`, `bun run check .`, and full `bun test` (1880 passed, 5 skipped).

## Acceptance Criteria

- `task edit --clear-deps` removes all dependencies from an existing task.
- `--clear-deps` cannot be combined with `--depends-on`/`--dep` and does not mutate the task on invalid input.
- Empty `--depends-on`/`--dep` is rejected instead of reporting a successful no-op.
- CLI help and regression tests document and verify dependency clearing.

## Related Concepts

- [[concepts/cli-entry]] — the fix lives on the task edit CLI surface (flag validation, wizard bypass via hasEditFieldFlags)

## Related Sources

- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — CLI-4 section analyzes this draft (with --clear-refs/--clear-docs siblings) for migration as BACK-577
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — B3 entry classifies it A-class for migration

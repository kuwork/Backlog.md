---
title: BACK-606 Make CLI priority plain-output test prefix-agnostic
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - cli
  - tests
source_path: backlog/tasks/back-606 - Make-CLI-priority-plain-output-test-prefix-agnostic.md
---

# BACK-606 Make CLI priority plain-output test prefix-agnostic

The 'plain output includes priority indicators' test in `src/test/cli-priority-filtering.test.ts` hardcoded a `task-` ID prefix in its output guard and line-format regex. Projects configure their own task prefix (this repo uses `BACK-`), so the guard matched for unrelated reasons and the regex never matched real IDs — the test failed or passed vacuously depending on the run. This task replaced the hardcoded prefix with a prefix-agnostic pattern.

## Summary

- `cli config get` does not expose `taskPrefix`, so the fix derives no prefix from config; instead it introduces a shared prefix-agnostic `TASK_LINE_PATTERN` (any prefix, optional `[HIGH]`/`[MEDIUM]`/`[LOW]` indicator, optional `.NN` subtask suffix, `/m` flag) used by all guards and the line-format assertion.
- Replaced all hardcoded `task-` guards and the format regex in `src/test/cli-priority-filtering.test.ts`; removed vacuous guards.
- Scoped test 13/13 pass, repeated twice; full run confirms the plain-output failure absent with no new failures.

## Acceptance Criteria

- Line-format assertion matches real task IDs with optional priority indicator, in any project prefix.
- Test uses a prefix-agnostic task-line pattern instead of hardcoding `task-`.

## Related Concepts

- [[concepts/task-identity]] — Configurable task ID prefixes and how they surface in plain output.
- [[concepts/cli-entry]] — CLI plain-output line format under test.

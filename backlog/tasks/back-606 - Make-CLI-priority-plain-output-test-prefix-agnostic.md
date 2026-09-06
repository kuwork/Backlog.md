---
id: BACK-606
title: Make CLI priority plain-output test prefix-agnostic
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 06:57'
updated_date: '2026-09-06 07:17'
labels: []
dependencies: []
references:
  - src/test/cli-priority-filtering.test.ts
modified_files:
  - src/test/cli-priority-filtering.test.ts
ordinal: 211400
actual_start: '2026-09-06 06:59'
actual_end: '2026-09-06 07:17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 'plain output includes priority indicators' test in src/test/cli-priority-filtering.test.ts hardcodes a task- ID prefix in both its output guard and its line-format regex. Projects configure their own task prefix (this project uses BACK-), so the guard sometimes matches for unrelated reasons and the regex never matches real IDs, making the test fail or pass vacuously depending on the run. Make the guard and the regex derive from the actual task prefix reported by the CLI config so the test validates the intended plain-output format in any project.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Line-format assertion matches real task IDs with optional [HIGH]/[MEDIUM]/[LOW] indicator
- [x] #2 bun test src/test/cli-priority-filtering.test.ts passes repeatedly
- [x] #3 bunx tsc --noEmit and bun run check pass on touched files
- [x] #4 Test uses a prefix-agnostic task-line pattern instead of hardcoding a task- prefix
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace hardcoded task- prefix guards and regex in src/test/cli-priority-filtering.test.ts with a prefix-agnostic task-line pattern
2. Run bun test src/test/cli-priority-filtering.test.ts repeatedly, plus tsc and biome
3. Confirm in the next full bun test run that the plain-output failure disappears
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
cli config get does not expose taskPrefix, so the fix uses a prefix-agnostic TASK_LINE_PATTERN (with /m flag and optional subtask suffix .NN) shared by all guards and the format assertion. Scoped test 13/13 pass twice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the CLI priority plain-output test prefix-agnostic.

Changes:
- src/test/cli-priority-filtering.test.ts: added shared TASK_LINE_PATTERN (optional [HIGH]/[MEDIUM]/[LOW] indicator, any prefix, optional subtask suffix, /m flag); replaced all hardcoded task- guards and the format regex; removed vacuous guards

Verification:
- bun test src/test/cli-priority-filtering.test.ts → 13/13 pass, repeated twice
- bunx tsc --noEmit clean; bun run check clean
- Full bun test (full-test-605-607.log): 'plain output includes priority indicators' failure absent; no new failures introduced
<!-- SECTION:FINAL_SUMMARY:END -->

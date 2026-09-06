---
id: BACK-610
title: Raise bun test timeouts for CLI priority filtering tests
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 07:54'
updated_date: '2026-09-06 08:10'
labels: []
dependencies: []
references:
  - src/test/cli-priority-filtering.test.ts
ordinal: 215400
actual_start: '2026-09-06 07:54'
actual_end: '2026-09-06 08:10'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tests in src/test/cli-priority-filtering.test.ts each spawn one or more 'bun run cli' subprocesses against the real project. Under full-suite parallel load these subprocesses can exceed Bun's default 5000ms per-test timeout (observed as 5s timeout failures, e.g. the case-insensitive filtering test which spawns three CLIs at once), making results depend on machine load. Give the CLI-spawning tests an explicit per-test timeout (e.g. 15000-20000ms) so they only fail on real defects, not on scheduling noise.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every test that spawns the CLI carries an explicit per-test timeout well above single-invocation cost
- [x] #2 bun test src/test/cli-priority-filtering.test.ts passes repeatedly
- [x] #3 bunx tsc --noEmit and bun run check pass on touched files
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Give all CLI-spawning tests in src/test/cli-priority-filtering.test.ts an explicit 20000ms per-test timeout
2. Run the scoped test repeatedly plus tsc/biome
3. Confirm disappearance of the 5s timeout class in the next full bun test run
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stabilized CLI priority filtering tests against parallel-load timeouts.

Changes:
- src/test/cli-priority-filtering.test.ts: setDefaultTimeout(20000) at file top, matching the existing pattern in cli-dependency.test.ts. All tests in the file spawn 'bun run cli' subprocesses whose wall time under full-suite parallel load could exceed Bun's 5000ms default.

Verification:
- bun test src/test/cli-priority-filtering.test.ts → 13/13 pass
- bunx tsc --noEmit clean; bun run check clean
- Full bun test (full-test-609-611.log): no CLI priority timeout failures.
<!-- SECTION:FINAL_SUMMARY:END -->

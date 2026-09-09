---
title: BACK-610 Raise bun test timeouts for CLI priority filtering tests
created_date: '2026-09-06 08:10'
updated_date: '2026-09-06 08:10'
labels:
  - source
  - test
  - ci
  - cli
source_path: backlog/tasks/back-610 - Raise-bun-test-timeouts-for-CLI-priority-filtering-tests.md
---

# BACK-610 Raise bun test timeouts for CLI priority filtering tests

Every test in `src/test/cli-priority-filtering.test.ts` spawns one or more real `bun run cli` subprocesses, and under full-suite parallel load their wall time exceeded Bun's default 5000ms per-test timeout (observed on the case-insensitive filtering test which spawns three CLIs at once). `setDefaultTimeout(20000)` at file top makes the suite fail only on real defects, not scheduling noise.

## Summary

- `src/test/cli-priority-filtering.test.ts`: `setDefaultTimeout(20000)` at file top, matching the existing pattern in `cli-dependency.test.ts`
- Chosen value 20000ms, well above single-CLI-invocation cost; scoped run 13/13 pass
- Full suite (`full-test-609-611.log`): no CLI priority timeout failures
- Part of the same stabilization wave as BACK-609 and BACK-611 (shared full-test log)

## Acceptance Criteria

- Every test that spawns the CLI carries an explicit per-test timeout well above single-invocation cost
- `bun test src/test/cli-priority-filtering.test.ts` passes repeatedly
- `bunx tsc --noEmit` and `bun run check` pass on touched files

## Related Concepts

- [[concepts/ci-platform-contracts]] — setDefaultTimeout pattern for subprocess-spawning tests

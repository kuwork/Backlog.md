---
id: BACK-857
title: Keep branch task loading stable when disk cache writes fail
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-19 09:35'
updated_date: '2026-11-19 10:10'
labels: []
dependencies: []
references:
  - 'src/core/task-loader.ts:77-82'
  - 'src/core/task-loader.ts:628-684'
modified_files:
  - src/core/task-loader.ts
  - src/test/shared-branch-task-loader.test.ts
ordinal: 416004
actual_start: '2026-11-19 09:49'
actual_end: '2026-11-19 10:10'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On Windows, an EPERM while writing the commit-index JSON cache rejects the entire branch index load. The loader then drops its in-memory cache and leaves the active-branch fingerprint unset, so browser search polling rebuilds the same unchanged commits every few seconds. Disk persistence is only an optimization and must not make an otherwise successful Git index look incomplete.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A branch index built from Git remains usable and complete when its disk cache cannot be written
- [x] #2 Repeated loads of unchanged refs reuse the in-memory index even when the disk cache is unavailable
- [x] #3 Atomic cache temporary files do not collide across server processes
- [x] #4 Regression coverage proves cache-write failures do not cause repeated Git tree and history reads
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Isolate atomic cache temporary filenames by server process while preserving the content-addressed final cache paths.
2. Treat commit-index disk writes as best-effort, matching task-bundle writes: retain the successful in-memory Git index and report the branch load as complete when persistence fails.
3. Add regression coverage with an unavailable disk cache, proving unchanged refs reuse the in-memory index without repeated Git tree/history reads and still hydrate branch tasks.
4. Run focused loader tests, typecheck, and Biome checks; repeat the real-repository Core refresh probe to confirm a stable fingerprint and no repeated index builds.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The reproduced failure was an EPERM opening the shared commit-index .tmp file, which rejected the Git-built index, cleared its in-memory promise, and left the active-branch fingerprint unset. Cache temp files now include PID and timestamp, rename uses the shared Windows retry helper, and index persistence is best-effort like task-bundle persistence. Regression coverage uses a regular file as the cache root to force all disk writes to fail, then proves a second unchanged load reuses the in-memory index and parsed task.

Validation:
- bun test src/test/shared-branch-task-loader.test.ts: 30 pass, 0 fail, 113 assertions.
- bunx tsc --noEmit: passed.
- bun run check .: exit 0; only 14 pre-existing graph/duckdb warnings and one info.
- Real-repository Core probe with the original cache location: three consecutive refreshTasksForTaskRead calls all returned changed=false, retained a non-null stable fingerprint, and kept 8 commit indexes in memory.
- git diff --check: passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed repeated idle cross-branch reindexing when Windows cache writes fail.

Changes:
- Isolated atomic cache temp files by process and timestamp.
- Reused the shared replaceFile retry helper for Windows lock conflicts.
- Kept successful Git indexes in memory when disk persistence fails, allowing stable branch fingerprints.
- Added regression coverage for unavailable disk caches and unchanged-ref reuse.

Verification:
- 30 focused loader tests passed.
- Typecheck and Biome passed.
- Three real-repository refreshes stayed unchanged with 8 cached commit indexes.
<!-- SECTION:FINAL_SUMMARY:END -->

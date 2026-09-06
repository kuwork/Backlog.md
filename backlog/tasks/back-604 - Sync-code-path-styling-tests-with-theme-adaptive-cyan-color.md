---
id: BACK-604
title: Sync code-path styling tests with theme-adaptive cyan color
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 06:37'
updated_date: '2026-09-06 06:52'
labels: []
dependencies: []
references:
  - src/test/code-path.test.ts
  - src/ui/code-path.ts
modified_files:
  - src/test/code-path.test.ts
ordinal: 209400
actual_start: '2026-09-06 06:38'
actual_end: '2026-09-06 06:50'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-518 changed the TUI code-path styling utility so detected paths render in cyan instead of gray as part of theme-adaptive rendering, and later theme-adaptive work kept that behavior. src/test/code-path.test.ts was never updated, so six tests still assert the pre-BACK-518 gray styling tags and fail deterministically in every full test run. Update the test expectations to match the current intended theme-adaptive behavior (cyan styling tags). Do not revert the source styling: gray would contradict the theme-adaptive rendering requirement established by BACK-518 and preserved by later tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 styleCodePath tests expect {cyan-fg} tags
- [x] #2 transformCodePaths tests expect {cyan-fg} tags in extracted and in-place styled paths
- [x] #3 bun test src/test/code-path.test.ts passes
- [x] #4 bunx tsc --noEmit and bun run check pass on touched files
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update src/test/code-path.test.ts expectations from gray-fg to cyan-fg (styleCodePath and transformCodePaths suites)
2. Run scoped test (bun test src/test/code-path.test.ts), tsc --noEmit, biome check on touched files
3. Run full bun test and confirm the six code-path failures no longer appear
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated src/test/code-path.test.ts expectations gray-fg→cyan-fg (16 tag assertions + 1 test title) to match BACK-518 theme-adaptive behavior. Scoped test 21/21 pass, tsc --noEmit clean, biome check clean. Full bun test running to confirm disappearance in full run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Synced code-path styling tests with the theme-adaptive cyan color established by BACK-518 and preserved by later theme-adaptive work.

Changes:
- src/test/code-path.test.ts: 16 assertions {gray-fg} → {cyan-fg} across styleCodePath and transformCodePaths suites
- Renamed test title 'should wrap path in gray styling tags' → cyan
- No source changes; BACK-518+ theme-adaptive behavior untouched.

Verification:
- bun test src/test/code-path.test.ts → 21/21 pass
- bunx tsc --noEmit → clean
- bun run check src/test/code-path.test.ts → no errors
- Full bun test (full-test-604.log): 2045 pass / 13 fail (602 baseline was 20 fail); all six code-path failures and both heading failures (BACK-603) absent; remaining 13 are known unrelated debt items and flaky timing tests; no new failures introduced.
<!-- SECTION:FINAL_SUMMARY:END -->

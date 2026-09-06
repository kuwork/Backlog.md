---
id: BACK-603
title: Sync heading component tests with theme-adaptive level-3 color
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 06:18'
updated_date: '2026-09-06 06:39'
labels: []
dependencies: []
references:
  - src/test/heading.test.ts
  - src/ui/heading.ts
modified_files:
  - src/test/heading.test.ts
ordinal: 208400
actual_start: '2026-09-06 06:23'
actual_end: '2026-09-06 06:34'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-518 changed the TUI heading component so level-3 headings render in gray instead of white as part of theme-adaptive rendering, and later theme-adaptive work (e.g. BACK-565) kept that behavior. src/test/heading.test.ts was never updated, so two tests still assert the pre-BACK-518 white color and fail deterministically in every full test run. Update the test expectations to match the current intended theme-adaptive behavior (gray for level 3). Do not revert the source colors: white would contradict the theme-adaptive rendering requirement established by BACK-518 and preserved by later tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 getHeadingStyle(3) test expects color gray
- [x] #2 formatHeading level-3 test expects {gray-fg} tags
- [x] #3 bun test src/test/heading.test.ts passes
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
1. Update src/test/heading.test.ts level-3 expectations from white to gray (getHeadingStyle color, formatHeading tags)
2. Run scoped test (bun test src/test/heading.test.ts), tsc --noEmit, biome check on touched files
3. Run full bun test and confirm the two heading failures no longer appear
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated src/test/heading.test.ts level-3 expectations white→gray to match BACK-518 theme-adaptive behavior. Scoped test 11/11 pass, tsc --noEmit clean, biome check clean. Full bun test running to confirm disappearance in full run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Synced heading component tests with the theme-adaptive level-3 color established by BACK-518 and preserved by later theme-adaptive work.

Changes:
- src/test/heading.test.ts: level-3 getHeadingStyle expectation white → gray
- src/test/heading.test.ts: level-3 formatHeading expectation {white-fg} → {gray-fg}
- No source changes; BACK-518+ theme-adaptive behavior untouched.

Verification:
- bun test src/test/heading.test.ts → 11/11 pass
- bunx tsc --noEmit → clean
- bun run check src/test/heading.test.ts → no errors
- Full bun test (full-test-603.log): 2039 pass / 19 fail; both heading failures no longer appear; remaining failures all belong to previously identified unrelated debt/flaky items; no new failures introduced.
<!-- SECTION:FINAL_SUMMARY:END -->

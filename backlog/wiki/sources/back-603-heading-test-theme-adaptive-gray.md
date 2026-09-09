---
title: BACK-603 Sync heading component tests with theme-adaptive level-3 color
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - tui
  - tests
source_path: backlog/tasks/back-603 - Sync-heading-component-tests-with-theme-adaptive-level-3-color.md
---

# BACK-603 Sync heading component tests with theme-adaptive level-3 color

BACK-518 changed the TUI heading component so level-3 headings render in gray instead of white as part of theme-adaptive rendering, and later theme-adaptive work preserved that behavior, but `src/test/heading.test.ts` was never updated. Two tests kept asserting the pre-BACK-518 white color and failed deterministically in every full run. This task synced the test expectations to the intended behavior without touching source colors.

## Summary

- `src/test/heading.test.ts`: level-3 `getHeadingStyle(3)` expectation changed white → gray, and level-3 `formatHeading` expectation changed `{white-fg}` → `{gray-fg}`.
- Deliberately no source changes: white would contradict the theme-adaptive rendering requirement established by BACK-518 and preserved by later tasks.
- Scoped test 11/11 pass; full run confirms both heading failures no longer appear (2039 pass / 19 fail, remaining failures all known unrelated debt/flaky items).

## Acceptance Criteria

- `getHeadingStyle(3)` test expects color gray; `formatHeading` level-3 test expects `{gray-fg}` tags.
- `bun test src/test/heading.test.ts` passes; tsc and biome clean on touched files.

## Related Concepts

- [[concepts/tui-theme-adaptive]] — The theme-adaptive color contract (level-3 = gray) the tests were synced to.
- [[concepts/cli-tui]] — TUI heading component rendering under test.

## Related Sources

- [[sources/back-518-tui-theme-adaptive]] — The task that established the gray level-3 heading behavior.
- [[sources/back-565-tui-theme-adaptive-scroll]] — Later theme-adaptive work that preserved the behavior.

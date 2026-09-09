---
title: BACK-604 Sync code-path styling tests with theme-adaptive cyan color
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - tui
  - tests
source_path: backlog/tasks/back-604 - Sync-code-path-styling-tests-with-theme-adaptive-cyan-color.md
---

# BACK-604 Sync code-path styling tests with theme-adaptive cyan color

BACK-518 changed the TUI code-path styling utility so detected paths render in cyan instead of gray, but `src/test/code-path.test.ts` was never updated: six tests still asserted the pre-BACK-518 gray styling tags and failed deterministically in every full run. This task synced the expectations to the intended theme-adaptive behavior without reverting source styling.

## Summary

- `src/test/code-path.test.ts`: 16 assertions changed `{gray-fg}` → `{cyan-fg}` across the `styleCodePath` and `transformCodePaths` suites, and the test title "should wrap path in gray styling tags" renamed to cyan.
- No source changes; BACK-518+ theme-adaptive behavior untouched (gray would contradict the established rendering requirement).
- Scoped test 21/21 pass; full run shows all six code-path failures and both heading failures (BACK-603) absent (2045 pass / 13 fail vs 20 fail baseline).

## Acceptance Criteria

- `styleCodePath` and `transformCodePaths` tests expect `{cyan-fg}` tags in extracted and in-place styled paths.
- `bun test src/test/code-path.test.ts` passes; tsc and biome clean on touched files.

## Related Concepts

- [[concepts/tui-theme-adaptive]] — The theme-adaptive styling contract (code paths = cyan) the tests were synced to.
- [[concepts/cli-tui]] — TUI code-path detection and styling utilities under test.

## Related Sources

- [[sources/back-518-tui-theme-adaptive]] — The task that established the cyan code-path styling.
- [[sources/back-603-heading-test-theme-adaptive-gray]] — Sibling test-sync task from the same cleanup wave.

---
id: BACK-607
title: Wrap task-details documentation tests with I18nProvider and MemoryRouter
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 06:57'
updated_date: '2026-09-06 07:17'
labels: []
dependencies: []
references:
  - src/test/web-task-details-modal-documentation.test.tsx
  - src/test/web-task-details-modal-final-summary.test.tsx
  - src/web/contexts/I18nContext.tsx
modified_files:
  - src/test/web-task-details-modal-documentation.test.tsx
ordinal: 212400
actual_start: '2026-09-06 07:02'
actual_end: '2026-09-06 07:17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The two 'Web task popup documentation display' tests in src/test/web-task-details-modal-documentation.test.tsx render TaskDetailsModal inside only a ThemeProvider. Since web i18n support landed, TaskDetailsModal requires an I18nProvider (and a router context for its navigation hook), so both tests throw during render and fail deterministically in every full test run. Wrap the rendered element in I18nProvider and MemoryRouter, matching the provider composition already used by the sibling final-summary modal tests. Test assertions stay unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both documentation display tests render with I18nProvider and MemoryRouter and pass
- [x] #2 bun test src/test/web-task-details-modal-documentation.test.tsx passes
- [x] #3 bunx tsc --noEmit and bun run check pass on touched files
- [x] #4 Empty-state test asserts the always-visible documentation section renders its empty placeholder, matching the BACK-479 editing UI
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Wrap TaskDetailsModal renders in src/test/web-task-details-modal-documentation.test.tsx with MemoryRouter + I18nProvider + ThemeProvider, matching the sibling final-summary test
2. Run bun test src/test/web-task-details-modal-documentation.test.tsx, plus tsc and biome
3. Confirm in the next full bun test run that both documentation display failures disappear
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Investigation: the second test expected the Documentation section to be hidden when empty, but BACK-479 deliberately made it always-visible (add form + empty placeholder, same as References section). Updating the stale empty-state assertion to match current intended behavior; first test assertions unchanged.

Wrapped both renders in MemoryRouter + I18nProvider + ThemeProvider via a shared renderModal helper, matching the sibling final-summary test. Empty-state assertion updated: BACK-479 made the Documentation section always-visible with an add form and empty placeholder, so the test now asserts the placeholder instead of absence. Scoped tests 2/2 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the two Web task popup documentation display tests.

Changes:
- src/test/web-task-details-modal-documentation.test.tsx: renders now wrapped in MemoryRouter + I18nProvider + ThemeProvider via a shared renderModal helper (TaskDetailsModal requires i18n and router contexts since web i18n support)
- Empty-state assertion updated: BACK-479 intentionally made the Documentation section always-visible with an add form and empty placeholder (same pattern as References), so the test now asserts the placeholder renders instead of the section being hidden

Verification:
- bun test src/test/web-task-details-modal-documentation.test.tsx → 2/2 pass
- bunx tsc --noEmit clean; bun run check clean
- Full bun test (full-test-605-607.log): both documentation display failures absent; no new failures introduced
<!-- SECTION:FINAL_SUMMARY:END -->

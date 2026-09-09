---
title: BACK-607 Wrap task-details documentation tests with I18nProvider and MemoryRouter
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - web-ui
  - tests
source_path: backlog/tasks/back-607 - Wrap-task-details-documentation-tests-with-I18nProvider-and-MemoryRouter.md
---

# BACK-607 Wrap task-details documentation tests with I18nProvider and MemoryRouter

Since web i18n support landed, `TaskDetailsModal` requires an `I18nProvider` and a router context, but the two 'Web task popup documentation display' tests in `src/test/web-task-details-modal-documentation.test.tsx` rendered inside only a `ThemeProvider`, so both threw during render and failed deterministically. This task wrapped the renders in the same provider composition as the sibling final-summary tests and updated one stale empty-state assertion.

## Summary

- Both renders in `src/test/web-task-details-modal-documentation.test.tsx` now wrap `TaskDetailsModal` in `MemoryRouter` + `I18nProvider` + `ThemeProvider` via a shared `renderModal` helper, matching `web-task-details-modal-final-summary.test.tsx`; test assertions otherwise unchanged.
- Investigation finding: the second test expected the Documentation section to be hidden when empty, but BACK-479 deliberately made it always-visible (add form + empty placeholder, same pattern as References). The stale assertion now checks the placeholder renders instead of the section being absent.
- Scoped tests 2/2 pass; full run confirms both documentation display failures absent with no new failures.

## Acceptance Criteria

- Both documentation display tests render with I18nProvider and MemoryRouter and pass.
- Empty-state test asserts the always-visible documentation section renders its empty placeholder, matching the BACK-479 editing UI.

## Related Concepts

- [[concepts/web-ui-i18n]] — I18nProvider as a hard requirement for rendering web components since web i18n landed.
- [[concepts/web-ui-features]] — TaskDetailsModal provider dependencies (i18n + router) and the always-visible Documentation section.

## Related Sources

- [[sources/back-604-code-path-test-theme-adaptive-cyan]] — Sibling deterministic-test-repair task from the same full-suite cleanup wave.

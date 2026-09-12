---
id: BACK-627
title: Fix back arrow leaving stale history entry after drill-down in web UI
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-12 21:52'
updated_date: '2026-09-12 22:06'
labels:
  - web-ui
dependencies: []
ordinal: 228400
actual_start: '2026-09-12 21:53'
actual_end: '2026-09-12 21:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the web UI, opening a task modal and drilling down into a dependency task leaves the browser history out of sync when going back via the top-left back arrow.

Root cause: handleBack in src/web/App.tsx navigates to the parent task URL with a history PUSH instead of a POP. Sequence: open BACK-614 (history [bg, 614]), drill into dependency BACK-511 (history [bg, 614, 511], stack [614]), click back arrow -> history becomes [bg, 614, 511, 614]. The drilled-down /task/511 entry is never consumed, so closing afterwards (X/backdrop calls navigate(-1)) lands back on /task/511 and reopens the child modal instead of closing to the background page.

Fix: make handleBack pop the current entry (navigate(-1)) so each modal level consumes exactly one history entry, matching the invariant documented in handleCloseModal (App.tsx:632-635).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking the back arrow after drill-down pops exactly one history entry (no duplicate /task/<child> entry remains)
- [x] #2 After going back via the arrow, closing via X/backdrop/Escape returns to the background page in one step
- [x] #3 Repeated drill-down/back sequences keep history stack and modal taskHistory aligned 1:1
- [x] #4 bunx tsc --noEmit passes and bun run check . passes for touched files
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fix applied in src/web/App.tsx handleBack: replaced push of parent task URL with navigate(-1) pop. The parent entry is already the previous history entry (each drill-down pushes exactly one entry and appends one taskHistory item, keeping a 1:1 invariant), so popping aligns history with the modal stack. Verified state sequences: bg->614->511 drill then arrow->pop to 614 then X->single navigate(-1) back to bg; direct-load tab edge case (no backgroundLocation) still falls back to navigate(/, replace). Validation: bunx tsc --noEmit passes; bun run check (only pre-existing warnings in src/core/assets.ts, untouched); bun test src/web 84/84 pass; bun run build succeeds.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed web UI modal navigation: the top-left back arrow after a dependency drill-down now pops the current history entry (navigate(-1)) instead of pushing the parent task URL.

Why: the push left the drilled-down /task/<child> entry in the browser history stack, so the next close (X/backdrop/Escape via handleCloseModal's navigate(-1)) landed back on the child task and reopened its modal instead of returning to the background page — the user had to press close once per drilled level.

Changes:
- src/web/App.tsx handleBack: pop instead of push; behavior now identical to the browser back button path

Verification:
- bunx tsc --noEmit
- bun run check (no new findings)
- bun test src/web (84 pass)
- bun run build
<!-- SECTION:FINAL_SUMMARY:END -->

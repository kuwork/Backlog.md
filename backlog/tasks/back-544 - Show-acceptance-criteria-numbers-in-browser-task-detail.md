---
id: BACK-544
title: Show acceptance criteria numbers in browser task detail
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-02 18:35'
updated_date: '2026-08-07 00:11'
labels:
  - web-ui
dependencies: []
references:
  - src/web/components/TaskDetailsModal.tsx
  - src/test/web-task-details-modal-acceptance-criteria.test.tsx
priority: low
actual_start: '2026-08-06 23:52'
actual_end: '2026-08-07 00:04'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Show the existing acceptance-criteria index/number in the Web UI task detail preview. Only modify the browser task detail modal rendering; do not change the storage format, parser output, task schema, board cards, or list cards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.47.1..v1.48.0 --grep BACK-517 and git show <commit> as implementation reference.
- [x] #2 Browser task detail preview shows acceptance criteria with their existing indexes/numbers
- [x] #3 Board and list task cards remain unchanged and do not show acceptance-criteria numbers
- [x] #4 Markdown storage format, parser output, and task schema are unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect `src/web/components/TaskDetailsModal.tsx` acceptance-criteria rendering and analogous tests in `src/test/web-task-details-modal-*.tsx`.
2. Update only the task detail preview to display existing `acceptanceCriteriaItems` indexes.
3. Add or update focused tests for detail rendering where practical.
4. Run `bunx tsc --noEmit`, `bun run check .` on touched files, and scoped tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reference commit adds a `#${c.index}` span inside the acceptance-criteria preview list item in `TaskDetailsModal.tsx`.
- Adds focused SSR tests covering numbered detail rendering and a board-card guard.
- Applied the same change to current fork; tests adapted to include `I18nProvider` and `MemoryRouter` required by the current fork component tree.
- Biome configuration ignores `.tsx` files, so lint/format checks do not apply to the touched files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the migration task by adding existing acceptance-criteria index labels to the Web UI task detail preview only.

Changes:
- `src/web/components/TaskDetailsModal.tsx`: wrapped the checkbox and `#${c.index}` span in a tight `gap-1` flex container so the index sits immediately beside the checkbox, while the criterion text remains separated by the outer `gap-2`.
- `src/test/web-task-details-modal-acceptance-criteria.test.tsx`: added SSR coverage verifying numbered AC rendering in the task detail modal and confirming board/list cards do not expose AC details.

Validation:
- `bun test src/test/web-task-details-modal-acceptance-criteria.test.tsx`: passed (2 tests).
- `bun test src/test/web-task-details-modal-acceptance-criteria.test.tsx src/test/web-task-details-modal-documentation.test.tsx src/test/web-task-details-modal-final-summary.test.tsx`: 15 pass, 2 pre-existing failures in documentation test (unrelated I18nProvider setup).
- `bunx tsc --noEmit`: passed.
- `bun run check .`: 3 pre-existing warnings in `src/core/assets.ts` only; touched `.tsx` files are ignored by Biome configuration, so no lint/format issues were introduced.
- Full `bun test` suite was started but timed out before completion; scoped tests for the touched component pass.

No storage, parser, schema, editor, board/list card, or server behavior changed.
<!-- SECTION:FINAL_SUMMARY:END -->

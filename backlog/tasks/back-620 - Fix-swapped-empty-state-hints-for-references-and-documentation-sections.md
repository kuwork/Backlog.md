---
id: BACK-620
title: Fix swapped empty-state hints for references and documentation sections
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-07 21:07'
updated_date: '2026-09-07 21:15'
labels: []
dependencies: []
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/test/web-task-details-modal-documentation.test.tsx
ordinal: 223400
actual_start: '2026-09-07 21:09'
actual_end: '2026-09-07 21:15'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the web UI task details modal (which also serves as the edit page and the new-task create page), the empty-state hints for the References and Documentation sections are swapped. The References section shows the 'No documents' hint when empty, and the Documentation section shows the 'No references' hint. The remove-button titles for items in both sections are swapped as well.

Why: users see a misleading message in the wrong section, which is confusing when a task has no references or no documentation.

Known locations:
- src/web/components/TaskDetailsModal.tsx:1261 — References section renders t.taskDetails.noDocumentation (should be noReferences)
- src/web/components/TaskDetailsModal.tsx:1338 — Documentation section renders t.taskDetails.noReferences (should be noDocumentation)
- src/web/components/TaskDetailsModal.tsx:1250 / :1327 — remove-button titles use removeDocumentation / removeReference swapped
- Locale keys live in src/web/locales/{en,zh-CN,zh-TW,ja}.ts (keys themselves are correct; usage is swapped)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 References section shows the references-specific empty hint when there are no references
- [x] #2 Documentation section shows the documentation-specific empty hint when there is no documentation
- [x] #3 Remove-button hover titles match the section they appear in
- [x] #4 Behavior verified in all supported locales (en, zh-CN, zh-TW, ja)
- [x] #5 bunx tsc --noEmit and bun test pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create feature branch tasks/back-620-fix-swapped-empty-hints
2. Swap noDocumentation/noReferences empty-state hints and removeDocumentation/removeReference titles in TaskDetailsModal.tsx references & documentation sections
3. Add/adjust web component tests asserting the correct hint per section across locales
4. Run bunx tsc --noEmit, bun run check ., and scoped bun test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Swapped the four usages in TaskDetailsModal.tsx (references section now uses noReferences/removeReference; documentation section uses noDocumentation/removeDocumentation). Rewrote web-task-details-modal-documentation.test.tsx: fixed the assertion that encoded the bug, added a references-empty test, and added a per-locale (en/zh-CN/zh-TW/ja) test that fails on swap.

Validation: bunx tsc --noEmit passes; bun run check . exits 0 (3 pre-existing non-null-assertion warnings in unrelated files); scoped bun test src/test/web-task-details-modal-documentation.test.tsx passes 7/7. Full suite skipped per user decision.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed swapped empty-state hints and remove-button titles between the References and Documentation sections of the web task details modal (also used for edit/create).

Changes:
- src/web/components/TaskDetailsModal.tsx: References section now renders noReferences / removeReference; Documentation section renders noDocumentation / removeDocumentation
- src/test/web-task-details-modal-documentation.test.tsx: replaced the assertion that encoded the bug, added a references-empty test and a per-locale (en, zh-CN, zh-TW, ja) swap-detection test

Verification:
- bun test src/test/web-task-details-modal-documentation.test.tsx (7 pass)
- bunx tsc --noEmit
- bun run check . (exit 0)
<!-- SECTION:FINAL_SUMMARY:END -->

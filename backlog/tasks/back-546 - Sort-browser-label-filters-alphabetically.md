---
id: BACK-546
title: Sort browser label filters alphabetically
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-09 06:09'
updated_date: '2026-08-07 04:33'
labels:
  - web-ui
dependencies: []
references:
  - src/utils/label-filter.ts
  - src/web/components/LabelFilterDropdown.tsx
  - src/test/label-filter.test.ts
  - src/test/web-task-list-labels-menu.test.tsx
priority: medium
actual_start: '2026-08-07 01:50'
actual_end: '2026-08-07 02:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Web UI All Tasks Labels dropdown currently lists labels in the order they were first seen from configuration and tasks. Present the available labels in predictable lexicographic order so users can scan and select them easily.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.47.1..v1.48.0 --grep BACK-529 and git show <commit> as implementation reference.
- [x] #2 The All Tasks Labels dropdown renders available labels in alphabetical/lexicographic order regardless of task creation order.
- [x] #3 Label sorting is case-insensitive and deterministic for configured labels and labels discovered from tasks.
- [x] #4 A Web UI regression test covers unordered input labels rendering alphabetically in the Labels dropdown.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update src/utils/label-filter.ts so collectAvailableLabels returns de-duplicated labels sorted case-insensitively while preserving first-seen casing.
2. Keep sorting locale-independent and deterministic for canonically equivalent Unicode forms (NFC/NFD).
3. Add focused unit and Web UI regression tests that feed labels in non-alphabetical order and assert the dropdown renders them sorted.
4. Run scoped label-filter and web-task-list-labels-menu tests, plus TypeScript, Biome, and build checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented locale-independent alphabetical sorting in collectAvailableLabels (src/utils/label-filter.ts). Added compareCodeUnits helper and sort de-duplicated labels by lowercase NFD keys, falling back to raw code units for tie-breaking. Updated existing label-filter test to assert sorted order and added tests for accented labels and NFC/NFD equivalence. Added web-task-list-labels-menu regression test verifying the dropdown renders [Alpha, beta, delta, zeta] from unordered [zeta, Alpha] plus task labels.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed BACK-546 by migrating the BACK-529 label filter sort behavior to the current fork.

Modified files:
- src/utils/label-filter.ts
- src/test/label-filter.test.ts
- src/test/web-task-list-labels-menu.test.tsx

Verification:
- bun test src/test/label-filter.test.ts src/test/web-task-list-labels-menu.test.tsx: 11 pass, 0 fail
- bunx tsc --noEmit: clean
- bunx biome check <modified files>: clean
- bun run check .: reported 3 pre-existing warnings in src/core/assets.ts, unrelated to this change
- bun run build: failed with EPERM moving dist/backlog.exe (environment/locked binary), unrelated to this change
<!-- SECTION:FINAL_SUMMARY:END -->

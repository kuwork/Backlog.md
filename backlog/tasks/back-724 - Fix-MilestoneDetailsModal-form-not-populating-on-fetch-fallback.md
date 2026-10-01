---
id: BACK-724
title: Fix MilestoneDetailsModal form not populating on fetch fallback
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 05:08'
updated_date: '2026-10-01 05:49'
labels:
  - web-ui
dependencies: []
ordinal: 294400
actual_start: '2026-10-01 05:08'
actual_end: '2026-10-01 05:48'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MilestoneDetailsModal reset effect (deps [isOpen, milestoneId]) never re-runs when the fallback fetchMilestone resolves, so opening the modal without a resolved milestone prop leaves all form fields blank. The biome-ignore suppressing useExhaustiveDependencies exists because adding activeMilestone to deps would clobber in-progress edits on parent data refresh. Approved approach: adopt TaskDetailsModal's dirty-preservation pattern - extract the shared preserveDirtyRefreshValue helper, keep a form baseline ref, let the reset effect react to the full milestone object, and only overwrite fields the user has not edited. Remove the biome-ignore if the deps become complete.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening the milestone modal via the fetch-fallback path populates name/description/dates once the fetch resolves
- [x] #2 In-progress edits survive a parent data refresh of the same milestone
- [x] #3 biome check, tsc, and relevant tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read TaskDetailsModal dirty-preservation pattern (preserveDirtyRefreshValue, formBaselineRef, sameOpenModalRefresh) and MilestoneDetailsModal reset effect
2. Extract preserveDirtyRefreshValue (and areJsonEqual if needed) into a shared module
3. Rewrite MilestoneDetailsModal reset effect: react to the full activeMilestone object, baseline-guarded field updates so dirty edits survive refresh, remove the biome-ignore
4. Update TaskDetailsModal to import the shared helper
5. Verify: biome check, tsc, milestone/task modal tests
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented TaskDetailsModal-style dirty preservation: extracted preserveDirtyRefreshValue/areJsonEqual into shared src/web/utils/form-refresh.ts; MilestoneDetailsModal reset effect now reuses the existing baseline useMemo, re-runs on the full milestone object (fallback fetch populates late), and only overwrites non-dirty fields on same-record refresh; biome-ignore removed. Added regression tests in src/test/web-milestone-modal-refresh.test.tsx (fallback populate + dirty preservation). Gave the name input id=milestone-details-modal-name. biome/tsc/scoped tests green.
<!-- SECTION:NOTES:END -->

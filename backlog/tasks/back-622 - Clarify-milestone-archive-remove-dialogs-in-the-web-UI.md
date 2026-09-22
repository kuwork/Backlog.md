---
id: BACK-622
title: Clarify milestone archive/remove dialogs in the web UI
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-07 23:49'
updated_date: '2026-09-08 05:48'
labels: []
dependencies: []
ordinal: 225400
actual_start: '2026-09-07 23:33'
actual_end: '2026-09-07 23:50'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The milestone archive action used a native window.confirm and the remove dialog copy was ambiguous. Add a proper archive confirmation dialog and rewrite both dialogs' copy so users clearly understand: remove moves the milestone file to the archive AND adjusts the milestone field of associated tasks (clear or reassign); archive only moves the file and never modifies task files.

Scope (web UI):
- MilestonesPage: replace window.confirm for archive with a styled confirmation modal (consistent with the remove modal); update remove dialog description
- MilestoneDetailsModal: same archive confirmation modal; same remove dialog description
- i18n (en/zh-CN/zh-TW/ja): remove redundant question sentences from both descriptions (the modal title already names the action); rename the clear option label from "Leave tasks unassigned" to "Clear the milestone field on tasks"; use future tense ("Task files will not be modified") in the archive description
- Update web component tests to match the new copy
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Archive shows a styled confirmation modal on both the milestones page and the details modal, in all 4 locales
- [x] #2 Remove and archive dialog copy states file movement and task-file effects without repeating the milestone name as a question
- [x] #3 bun test web milestone suites pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. i18n (en/zh-CN/zh-TW/ja): remove the redundant question sentences from milestones.removeDescription and milestones.archiveDescription (plain strings, no label); rename leaveUnassigned to "Clear the milestone field on tasks"; rewrite archiveDescription in future tense ("Task files will not be modified; tasks will keep their reference to this milestone.")
2. MilestonesPage: replace the archive window.confirm with a styled confirmation modal (archivingBucket state, blue Archive button) mirroring the remove modal; render removeDescription/archiveDescription without label interpolation
3. MilestoneDetailsModal: same archive confirmation modal (showArchive state) wired to the existing handleArchive; render removeDescription without label interpolation
4. Tests: update web-milestones-page-search assertions to the new copy ("Remove Milestone", "Clear the milestone field on tasks")
5. Verify: bunx tsc --noEmit, bun run check ., scoped web milestone test suites
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Worked from user review feedback on the BACK-619 milestone documentation UI: the remove dialog copy was ambiguous about file movement (both remove and archive move the file to the archive; only remove touches tasks) and the archive action used a native window.confirm.

Decisions:
- Both dialogs drop the repeated question sentence ("Remove milestone X?") because the modal title already names the action; descriptions now state behavior directly
- Archive keeps its description focused on the guarantee users care about: task files will not be modified
- The clear option label avoids "unassigned" wording (the tasks bucket is "unassigned" in the UI, but the operation is literally emptying the milestone field on task files)
- archiveDescription/removeDescription became plain strings (label no longer interpolated)

Validation: bunx tsc --noEmit clean; bun run check . exit 0 (3 pre-existing core/assets.ts warnings); web milestone suites 25 pass / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented archive/remove dialog clarification for milestones (web UI).

Changes:
- Replaced window.confirm archive flow with a styled confirmation modal in MilestonesPage and MilestoneDetailsModal
- Removed redundant question sentences from both dialogs' descriptions in all 4 locales (title bar already names the action)
- Renamed the clear option label: "Leave tasks unassigned" -> "Clear the milestone field on tasks" (with the matching localized label in the other three locales)
- Archive description now uses future tense: "Task files will not be modified; tasks will keep their reference to this milestone."

Verification:
- bunx tsc --noEmit clean
- bun test web-milestones-page-search / web-milestones-page-unassigned-filter / web-milestone-timestamps: 25 pass, 0 fail
<!-- SECTION:FINAL_SUMMARY:END -->

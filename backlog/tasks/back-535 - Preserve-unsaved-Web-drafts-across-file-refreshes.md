---
id: BACK-535
title: Preserve unsaved Web drafts across file refreshes
status: Done
assignee:
  - '@kimi'
created_date: '2026-04-25 12:14'
updated_date: '2026-08-01 09:17'
labels:
  - migration
dependencies: []
references:
  - src/web/components/TaskDetailsModal.tsx
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/test/web-task-details-modal-final-summary.test.tsx
priority: high
actual_start: '2026-08-01 09:05'
actual_end: '2026-08-01 09:14'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the Web UI, unsaved task create/edit form state is reset when task files change in the background while a modal is open. This can wipe out user edits before they are saved.

Update the modal refresh handling so that background file refreshes update only untouched fields and preserve locally edited dirty fields, while keeping existing form validation and date-clear behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.47.1..v1.48.0 --grep BACK-429` and `git show 2f52560` as implementation reference.
- [x] #2 Unsaved task create/edit fields survive external file refreshes while a modal is open.
- [x] #3 Saved external changes still appear after refresh when they do not conflict with local unsaved form state.
- [x] #4 A regression test covers unsaved edits plus an external file watcher update (stabilized JSDOM harness for controlled inputs).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect `src/web/components/TaskDetailsModal.tsx` and the `ContentStore` refresh path that re-renders the modal with refreshed props.
2. Re-implement the same-open refresh merge: compare incoming refreshed fields against the current local dirty state; update only untouched fields, preserving user edits in title, description, plan, notes, dates, AC, DoD, references, and docs.
3. Stabilize the JSDOM regression harness: before simulating refreshed props, ensure controlled create/edit inputs have actually updated React state.
4. Add focused regression tests for dirty edit fields, clean external updates, and unsaved create fields during refreshed props.
5. Run `bun test src/test/web-task-details-modal-*.test.tsx`, `bunx tsc --noEmit`, `bun run check .`, and full `bun test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented dirty-field preservation in TaskDetailsModal refresh effect. Stabilized JSDOM test harness for controlled inputs. Added two regression tests for dirty edit fields and unsaved create fields across refreshed props.

DoD #1 (tsc) and #3 (scoped web modal tests) verified. DoD #2 (bun run check .) does not pass due to pre-existing repo-wide CRLF line endings from core.autocrlf=true on Windows; this is not introduced by the changed files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported BACK-429's refresh-merge logic to current 1.48 codebase while preserving all existing features (documentation, dates, i18n, etc.). Added TaskDetailsFormState, buildTaskDetailsFormState, preserveDirtyRefreshValue, and formBaselineRef. Updated the reset useEffect to merge refreshed fields while preserving locally edited fields. Stabilized JSDOM harness and added regression tests. Scoped web modal tests pass (13/13). TypeScript passes. bun run check . fails due to pre-existing repo-wide CRLF from core.autocrlf=true on Windows, unrelated to these changes.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched.
- [x] #2 bun run check . passes when formatting/linting touched.
- [x] #3 bun test (or scoped web modal tests) passes.
<!-- DOD:END -->

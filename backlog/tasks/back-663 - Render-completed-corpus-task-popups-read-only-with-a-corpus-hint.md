---
id: BACK-663
title: Render completed-corpus task popups read-only with a corpus hint
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-19 07:50'
updated_date: '2026-09-19 08:04'
labels: []
dependencies:
  - BACK-662
references:
  - 'src/web/components/TaskDetailsModal.tsx:178'
  - 'src/web/components/TaskDetailsModal.tsx:1305'
  - 'src/web/App.tsx:535'
  - 'src/web/utils/search-results.ts:109'
  - 'src/web/locales/en.ts:192'
ordinal: 249400
actual_start: '2026-09-19 07:50'
actual_end: '2026-09-19 08:04'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-662 widened the search corpus to backlog/completed and gave the search dialog a way to open one of those records through the preloadedTask navigation payload. That popup is still built as an editable board record: read-only gating is keyed only on task.branch (src/web/components/TaskDetailsModal.tsx:178), and a completed record arrives with source "completed" and no branch, so nothing locks it down. The Edit button, the inline status/priority/assignee/label/dependency/reference/date edits, comment add and delete, and the AC and DoD toggles are all live against a record that is not part of the board corpus and has no refresh path back into the popup. The reader also gets no signal that the popup is a reading surface rather than a working one.

Scope is the web popup only: give a completed-corpus record the same read-only treatment the cross-branch popup already has, under the title bar, with wording that names the completed archive instead of a branch. Cross-branch behavior, active board tasks, and the CLI/MCP/API contract stay as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A task whose source is "completed" opens read-only: no Edit button, no status/priority/assignee/label/dependency/reference/date inline edits, no comment add or delete, and no acceptance-criteria or definition-of-done toggles
- [x] #2 The read-only hint renders in the same slot the cross-branch banner uses, directly under the popup title bar, with wording that names the completed archive rather than a branch
- [x] #3 Cross-branch tasks keep their branch-specific hint and stay read-only
- [x] #4 Active board tasks open editable exactly as before
- [x] #5 The new hint string exists in all four web locales (en, zh-CN, zh-TW, ja)
- [x] #6 Tests cover the read-only completed popup and an active-task control case; each new test is confirmed red with the change reverted before commit
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. TaskDetailsModal.tsx - split the read-only gate from the branch reason. Keep isFromOtherBranch = Boolean(task?.branch) as the branch-specific fact; add isCompletedCorpus = task?.source === "completed" and isReadOnly = isFromOtherBranch || isCompletedCorpus. Every guard clause, action-button condition, disabled prop, and the opacity-60 cursor-not-allowed styling switches to isReadOnly, so the completed popup gets exactly the cross-branch lock-down rather than a second hand-rolled one.
2. TaskDetailsModal.tsx banner - keep the single slot that already sits directly under the title bar, render it when isReadOnly, and pick the message by reason: completed corpus renders the new taskDetails.completedCorpusHint, a cross-branch record keeps crossBranchHint(task.branch).
3. Locales - add completedCorpusHint to en.ts, zh-CN.ts, zh-TW.ts and ja.ts. TranslationDict is derived from en via src/web/locales/types.ts, so tsc fails until all four carry the key.
4. Tests - extend src/test/web-completed-task-modal.test.tsx: the completed popup shows the read-only hint and offers no Edit button; a control case serves an active task on the board corpus and asserts that popup still renders the Edit button and no hint.
5. Gates - bunx tsc --noEmit, bun run check ., scoped bun test --timeout 240000 on the completed-popup, search-dialog-completed, and task-deep-link suites. Revert-verify: turning the modal gate back to branch-only must turn the new cases red.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Gate: isFromOtherBranch keeps naming the branch reason, and isReadOnly = isFromOtherBranch || task.source === "completed" is what every guard clause, action-button condition, disabled prop, and opacity-60 cursor-not-allowed class now reads. The completed popup therefore inherits the cross-branch lock-down instead of a second hand-rolled one.

Hint: the banner stays a single slot directly under the title bar; it renders when isReadOnly and picks its wording by reason (completedCorpusHint vs crossBranchHint). Stale comments that still said "cross-branch" where the gate had widened were rewritten.

Locales: completedCorpusHint added to en, zh-CN, zh-TW and ja. TranslationDict is derived from en (src/web/locales/types.ts), so tsc fails until all four carry the key.

Verification: bunx tsc --noEmit clean; bun run check . clean (3 pre-existing assets.ts warnings); 172 tests across all 29 src/test/web-*.test.tsx green, including the 8 modal suites. Revert probes run one half at a time: (A) isReadOnly back to branch-only turned "locks the popup down and names the completed archive under the title bar" red; (B) reverting the banner to always crossBranchHint turned the same case red with "Read-only: This task exists in the  branch" (empty branch), which is the exact symptom the popup had before this task.

Real browser: headless Chrome over CDP against the source server on port 6456 (locale zh-CN). Searched "cli setup core project" with completed=true, clicked the BACK-1 row, and the popup at /task/1/cli-setup-core-project-bun-typescript-git-linters rendered the localized read-only hint - "read-only: this task lives in the completed archive, so it is view-only here" - with zero action buttons (no edit, save, archive or add-comment control), matching the cross-branch banner's amber treatment.

Known shared limitation left in place: in preview mode the acceptance-criteria checkboxes come from AcceptanceCriteriaEditor with disableToggle={isCreateMode}, so on a read-only popup they still look clickable and the toggle silently no-ops through the isReadOnly guard. Cross-branch popups behave the same way today, so changing it would have altered that popup too; it is a one-line follow-up if the user wants both to disable the control outright.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The task popup now treats a backlog/completed record the way it already treated a cross-branch one: read-only, with a hint directly under the title bar.

Changes:
- src/web/components/TaskDetailsModal.tsx - split the gate into isFromOtherBranch (why) and isReadOnly = isFromOtherBranch || source === "completed" (what). Every guard, action button, disabled prop and read-only styling reads isReadOnly; the banner picks completedCorpusHint or crossBranchHint by reason.
- src/web/locales/{en,zh-CN,zh-TW,ja}.ts - new completedCorpusHint string in all four dictionaries (the localized form of "this task lives in the completed archive, so it is view-only here").

Verification:
- bunx tsc --noEmit, bun run check . (3 pre-existing warnings)
- 172 tests across all 29 src/test/web-*.test.tsx suites
- revert-verified one half at a time; reverting the banner alone reproduces the old symptom ("Read-only: This task exists in the  branch")
- headless Chrome over CDP on the source server: BACK-1 opened from the completed-enabled search shows the new hint, no Edit/Save/Archive/comment actions
<!-- SECTION:FINAL_SUMMARY:END -->

---
title: BACK-622 Clarify milestone archive/remove dialogs in the web UI
created_date: '2026-09-08 05:48'
updated_date: '2026-09-08 05:48'
labels:
  - source
  - web-ui
  - milestones
  - i18n
source_path: backlog/tasks/back-622 - Clarify-milestone-archive-remove-dialogs-in-the-web-UI.md
---

# BACK-622 Clarify milestone archive/remove dialogs in the web UI

The milestone archive action used a native `window.confirm` and the remove dialog copy was ambiguous about the actual file/task effects. Users could not clearly tell that both remove and archive move the milestone file to the archive, while only remove touches task files. This task replaces the native confirm with a styled modal and rewrites both dialogs' copy across all 4 locales, stemming from user review feedback on the BACK-619 milestone documentation UI.

## Summary

- `MilestonesPage.tsx`: archive `window.confirm` replaced with a styled confirmation modal (`archivingBucket` state, blue Archive button) mirroring the remove modal; `MilestoneDetailsModal.tsx`: same modal (`showArchive` state) wired to the existing handleArchive
- Copy decisions: both dialogs drop the redundant question sentence ('Remove milestone X?') because the modal title already names the action; archive description focuses on the key guarantee in future tense — 'Task files will not be modified; tasks will keep their reference to this milestone.'
- Clear option label renamed 'Leave tasks unassigned' → 'Clear the milestone field on tasks' (清空任务的里程碑字段) — 'unassigned' is a UI bucket name, but the operation literally empties the milestone field on task files
- `removeDescription`/`archiveDescription` became plain strings (label no longer interpolated)
- i18n updated in en/zh-CN/zh-TW/ja; tests updated to the new copy ('Remove Milestone', 'Clear the milestone field on tasks'); web milestone suites 25 pass / 0 fail

## Acceptance Criteria

- Archive shows a styled confirmation modal on both the milestones page and details modal, in all 4 locales
- Remove and archive dialog copy states file movement and task-file effects without repeating the milestone name as a question
- Web milestone test suites pass

## Related Concepts

- [[concepts/milestones]] — archive vs remove semantics (file movement vs task-field adjustments)
- [[concepts/web-ui-i18n]] — four-locale copy rewrite and label-vs-bucket wording precision

## Related Sources

- [[sources/back-619-milestone-documentation-field]] — the review feedback on whose UI this copy clarification followed

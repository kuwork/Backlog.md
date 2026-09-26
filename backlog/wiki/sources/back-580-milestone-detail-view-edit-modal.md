---
title: Add milestone detail view and redesign milestone edit modal (modeled on task detail/edit page)
created_date: '2026-09-08 16:55'
updated_date: '2026-09-26 14:00'
labels:
  - source
  - web-ui
  - api
  - milestones
  - i18n
source_path: backlog/tasks/back-580 - Add-milestone-detail-view-and-redesign-milestone-edit-modal-modeled-on-task-detail-edit-page.md
---

# Add milestone detail view and redesign milestone edit modal (modeled on task detail/edit page)

Gave Web UI milestones a full detail view (`/milestone/:id`, background-location routing like task details) and redesigned the add/edit modal on the mature `TaskDetailsModal` reference implementation (preview/edit modes, `PasteAwareMDEditor` description editing, MermaidMarkdown preview, dirty checking, Ctrl/Cmd+S, inline date saving). Before this, milestones had only a card list and simple modals, and the description could not be edited from the Web at all.

## Summary

- Backend: `handleUpdateMilestone` in `src/server/index.ts` now passes `description` through to `MilestoneHandlers.editMilestone` (`undefined` = unchanged, mirroring create); SPA fallback covers `/milestone/:id` and subpaths; new server tests in `src/test/server-search-endpoint.test.ts` verify PUT persists description to the `## Description` section and omission leaves it untouched.
- Frontend: new `MilestoneDetailsModal.tsx` — one shared component for preview/edit modes (entered via the Edit button in the detail title bar), max-w-5xl; MermaidMarkdown description with empty placeholder; five date fields editable inline in BOTH modes (due/planned as `type=date`, actual as `datetime-local`, via `storedUtcToDateTimeLocal`/`formatStoredUtcDateForDisplay`); bottom task list reusing `MilestoneTaskRow` + sortable header showing ALL tasks.
- `MilestoneAddModal.tsx` extracted with a `PasteAwareMDEditor` description field and `promoteAssets` (`POST /api/assets/promote`) before save; shared `src/web/utils/temp-assets.ts` extracted from TaskDetailsModal.
- Header actions mirror the task modal: Cancel/Save (edit) and Cancel/Create (Add) live in the Modal header top-right with task-modal button styles; Add form lost its bottom button row.
- Dirty-state parity with task details: Esc/Cancel/X confirm when the description is dirty, plus an `onClickCapture` link interceptor (ported from `TaskDetailsModal.confirmNavigationAwayFromEdits`) guarding Board/List header links and task/draft links in the description.
- Card Edit button became a Detail button navigating to `/milestone/:id`; the legacy card edit modal, its state/handlers, `findDuplicateMilestone`, and the `editTitle` locale key were removed.
- Archive button got a dedicated `archiving` state so inline meta saves no longer flash the archiving label.
- Robustness fix: the rename cascade in `editMilestone` swallowed the identity and reason of a failing task — it now reports the failed task ID, the underlying lock/error reason, and rollback failures (`src/mcp/tools/milestones/handlers.ts`). Root trigger found in testing: renaming hit a fail-fast task lock held by another process (BACK-571); rollback restored the milestone file with no data loss.
- i18n: new `t.milestones.*` strings in all four locales (en, zh-CN, zh-TW, ja).
- Verification: full bun test 2161 pass / 0 fail / 14 skip; tsc and biome clean; binary rebuilt and smoke-tested.

## Acceptance Criteria

- Clicking a milestone card title opens `/milestone/:id` with title, rendered description, five dates, progress, and the full task list; preview/edit share one component with task-modal parity (dirty check, Ctrl/Cmd+S, Esc suppression).
- Edit modal contains PasteAwareMDEditor + five date fields; saving calls promoteAssets then PUT; description persists to `## Description`; clipboard-image paste uploads and renders.
- en/zh-CN/zh-TW/ja locale strings present; bun test, tsc, and biome all pass.

## Related Concepts

- [[concepts/milestones]] — milestone model, task cascade, and archive semantics
- [[concepts/web-ui-features]] — detail-view routing pattern and card actions
- [[concepts/paste-as-markdown]] — PasteAwareMDEditor editing with clipboard-image promote
- [[concepts/asset-management]] — temp-assets extraction and promote flow
- [[concepts/date-fields]] — the five milestone date fields with local/UTC conversions
- [[concepts/web-ui-i18n]] — four-locale string additions

## Related Sources

- [[sources/back-515-milestone-update-fix]] — prior milestone web API fix
- [[sources/m-6-new-milestones-ui]] — the milestone this work rolls up under (same batch)

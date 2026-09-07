---
id: BACK-580
title: >-
  Add milestone detail view and redesign milestone edit modal (modeled on task
  detail/edit page)
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-07 03:23'
updated_date: '2026-09-07 07:34'
labels:
  - web-ui
  - api
  - milestones
dependencies: []
references:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/MilestonesPage.tsx
  - src/server/index.ts
ordinal: 218400
actual_start: '2026-09-07 06:04'
actual_end: '2026-09-07 07:34'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Background: In the Web UI, milestones only have a card list (MilestonesPage.tsx) and simple add/edit modals (MilestonesPage.tsx:1084-1244). There is no detail view, and the description cannot be edited from the Web at all. The task detail/edit flow already has a mature reference implementation: TaskDetailsModal.tsx (preview/edit/create modes, PasteAwareMDEditor rich-text editing, MermaidMarkdown preview, dirty checking, Ctrl+S, inline date saving).

## Design

### 1. New milestone detail view
Use the same full-screen modal + routing approach as task details (background-location pattern, singular route /milestone/:id, registered in App.tsx following the /task/:id handleOpenTask wiring; the server SPA fallback must also cover /milestone/:id, see src/server/index.ts:434).

Layout (preview mode, modeled on TaskDetailsModal and the target screenshot):
- Top: milestone title bar with action buttons (Edit, Board, List, Archive, Remove — reuse the five existing card actions)
- Left column: description section rendered with MermaidMarkdown (mermaid, image lightbox, wikilink navigation); show a placeholder when the description is empty
- Right column metadata: due date, planned start/end (date), actual start/end (datetime, converted via storedUtcToDateTimeLocal / formatStoredUtcDateForDisplay), task count and completion progress %
- Bottom: task list for the milestone, reusing MilestoneTaskRow + the sortable table header (MilestonesPage.tsx:548,814), showing ALL tasks (not just 10), with rows clickable to open task details

Entry point: clicking a milestone card title opens the detail view; keep the existing Board/List quick actions on cards.

### 2. Redesign the milestone edit modal
Upgrade the existing Add modal to a wide modal modeled on the task edit page (max-w-5xl):
- Left column (2/3): name field + new description field edited with PasteAwareMDEditor (paste-to-Markdown, clipboard image upload to /api/assets/temp)
- Right column (1/3): the five date fields (due/planned use type=date, actual uses type=datetime-local), same width as the task modal sidebar
- Call promoteAssets (POST /api/assets/promote) before saving
- Adopt the TaskDetailsModal mode machine: preview/edit switching, isDirty check, disable Esc/background close while editing, Ctrl/Cmd+S quick save
- The detail view and editor share one component via preview/edit modes (edit is entered from the Edit button in the detail title bar)

### 3. Small backend change
- src/server/index.ts handleUpdateMilestone (:1947-1983): read description from the body and pass it through to MilestoneHandlers.editMilestone (filesystem.updateMilestone already accepts a description parameter and the MCP handler already supports it — only the server layer is missing it)
- src/web/lib/api.ts updateMilestone: add description to the payload
- Create side (handleCreateMilestone) already supports description; just add the description field to the Add modal

### 4. i18n
Add the new t.milestones.* strings (detail title, description label, empty-description placeholder, etc.) to all four locale files under src/web/locales: en, zh-CN, zh-TW, ja.

## Mid-course UI refinements (requested during implementation)
1. Card action button is Detail (not Edit): the milestone card's old Edit button becomes a Detail button that navigates to /milestone/:id; the legacy card edit modal and its dead state/handlers are removed from MilestonesPage (editing is unified in the detail view's edit mode).
2. Right sidebar mirrors the task modal: the milestone name input (with renameHint) sits at the top of the right column, above the progress card, styled like the task Title field; the five date fields are editable inline in BOTH preview and edit modes (save on change / blur via PUT, like TaskDetailsModal.handleInlineMetaUpdate). The name saves on blur (Enter blurs); empty names revert.
3. Header actions mirror the task modal: Cancel/Save (edit mode) and Cancel/Create (Add modal) live in the Modal header top-right via the actions slot, with the task-modal button styles (X icon for cancel, checkmark icon for save/create, focus rings, disabled states). The Add form no longer has a bottom button row.
4. Dirty-state protection parity with task details: Esc/Cancel/X already confirm when the description is dirty; additionally, clicking any link that leaves the milestone (Board/List header links, task/draft links in the description, markdown anchors) must confirm before navigation (onClickCapture interceptor like TaskDetailsModal.confirmNavigationAwayFromEdits).
5. Archive button label fix: the Archive button must show an 'archiving...' label only while an actual archive is in flight (dedicated archiving state), not during any generic save (inline meta saves no longer flash the archive label).

## Reusable components
- PasteAwareMDEditor / MermaidMarkdown (rich-text editing and preview)
- TaskDetailsModal mode machine, dirty check, Ctrl+S, Esc suppression, confirmNavigationAwayFromEdits
- MilestoneTaskRow, renderBucketTableHeader (task table)
- Modal, SectionHeader (can be extracted to a shared component)
- utils/date-display.ts date conversions

## Robustness fix found during testing
The rename cascade in MilestoneHandlers.editMilestone swallowed the identity and reason of the failing task. The error now reports the failed task ID and underlying lock/error reason, plus rollback failures (src/mcp/tools/milestones/handlers.ts).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Clicking a milestone card title opens the /milestone/:id detail view showing title, rendered description, five dates, progress, and the full task list
- [ ] #2 Detail view and editor share one component; the Edit button enters edit mode; preview/edit switching, dirty check, Ctrl/Cmd+S, and Esc suppression behave the same as task details
- [ ] #3 The edit modal contains a PasteAwareMDEditor description field and the five date fields; saving calls promoteAssets then PUT /api/milestones/:id, and list + detail refresh immediately
- [ ] #4 PUT /api/milestones/:id passes description through and persists it to the markdown ## Description section; the Add modal also supports description
- [ ] #5 Pasting a clipboard image while editing uploads it and it renders in the detail view
- [ ] #6 en/zh-CN/zh-TW/ja locale strings are all present
- [ ] #7 bun test, bunx tsc --noEmit, and bun run check . all pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. [done] Backend: handleUpdateMilestone passes description through; SPA fallback covers /milestone/:id; server tests for PUT description persistence and read-back (src/test/server-search-endpoint.test.ts)
2. [done] Frontend: MilestoneDetailsModal (shared preview/edit, max-w-5xl) + /milestone/:id background route + card Detail button + MilestoneAddModal extracted with PasteAwareMDEditor description + api.ts description payload + 4-locale i18n
3. [done] Mid-course refinements: card Edit->Detail with legacy edit modal removed; name input moved to right sidebar top with inline save; dates editable inline in preview+edit; header Cancel/Save/Create buttons restyled to task-modal style in top-right; dirty-navigation protection for all leaving links; archive-button label isolated to actual archiving
4. [done] Robustness: rename cascade error now names the failed task and reason (handlers.ts)
5. [done] Verification: bun test full suite 2161 pass / 0 fail, tsc clean, biome clean; binary rebuilt
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Backend agent (parallel split A) done: handleUpdateMilestone now passes description through to editMilestone (undefined = unchanged, mirroring create); SPA fallback covers /milestone/:id and subpaths; 2 new tests in src/test/server-search-endpoint.test.ts (PUT persists description to ## Description section and reads back via GET; omitting description leaves it untouched). 21/21 tests pass, tsc clean, biome clean. Frontend agent (split B: MilestoneDetailsModal + routing + i18n) still running.

Frontend agent (split B) done: new MilestoneDetailsModal.tsx (preview/edit modes, MermaidMarkdown description, PasteAwareMDEditor editing, promoteAssets save flow, MilestoneTaskRow table) + MilestoneAddModal.tsx extracted (useTheme-safe conditional mount) + shared src/web/utils/temp-assets.ts (extracted from TaskDetailsModal, 4 tests) + App.tsx /milestone/:id background route + api.ts updateMilestone description param + 4 locales. Full suite: 2162 pass at that point.

Mid-course refinements implemented: (1) card Edit button replaced by Detail button navigating to /milestone/:id; legacy card edit modal, its state/handlers, findDuplicateMilestone, and the editTitle locale key removed; MilestoneAddModal widened to max-w-5xl with 3-column grid so the right dates column matches the task modal sidebar width. (2) Name input moved to top of the right sidebar (task-Title style, renameHint kept) with inline save on blur; five date fields editable inline in BOTH preview and edit modes (save on change, date + datetime-local conversions); isDirty now tracks description only; saveMeta helper mirrors TaskDetailsModal.handleInlineMetaUpdate. (3) Add modal Cancel/Create moved from form bottom to Modal header actions with task-modal styling (X/checkmark icons, focus rings); edit-mode Cancel/Save restyled to match. (4) Dirty-navigation protection: onClickCapture link interceptor on the content grid (ported from TaskDetailsModal.confirmNavigationAwayFromEdits), Board/List header links guarded, task/draft links in description confirm before navigating away. (5) Archive button got a dedicated archiving state so inline saves no longer flash the archiving label.

Bug found during manual testing: renaming a milestone failed its task cascade because another process held a task lock (fail-fast by design, retries:0); rollback restored the milestone file, no data loss. Fixed the swallowed error context: editMilestone cascade error now reports the failed task ID and underlying reason plus rollback failures (src/mcp/tools/milestones/handlers.ts); cli-milestone-management tests 14/14 pass.

Verification: full bun test 2161 pass / 0 fail / 14 skip; bunx tsc --noEmit clean; bun run check . clean (3 pre-existing warnings in src/core/assets.ts). Binary rebuilt (dist/backlog.exe) and smoke-tested: GET /milestone/:id returns SPA, GET /api/milestones includes description.
<!-- SECTION:NOTES:END -->

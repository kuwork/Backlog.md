---
id: BACK-850
title: Support drag-and-drop document moves in the web UI
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-17 15:05'
updated_date: '2026-11-18 03:11'
labels: []
dependencies: []
modified_files:
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/ko.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/web-side-navigation-docs-drag.test.tsx
ordinal: 409004
actual_start: '2026-11-17 17:43'
actual_end: '2026-11-18 03:11'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web UI did not provide a way to change a document folder by dragging. Users need an intuitive way to move documents within the document tree and return them to the doc root. Dragging must start from a dedicated handle shown on hover so it does not conflict with opening documents or other existing actions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hovering a document row reveals the drag handle, moving the pointer away hides it, and existing click behavior remains unchanged.
- [x] #2 Only pressing and moving the drag handle starts dragging. Valid folder rows and the Docs title show recognizable drop-target feedback.
- [x] #3 Dropping a document on a folder moves it into that folder, updates the interface promptly, and preserves the new location after a page reload.
- [x] #4 Dropping a document on the Docs title moves it to the doc root, updates the interface promptly, and preserves the new location after a page reload.
- [x] #5 Dropping a document on an invalid target or cancelling the drag leaves its original location unchanged.
- [x] #6 Automated tests cover the hover handle, folder drops, root drops, and invalid drops.
- [x] #7 For long document titles or narrow sidebars, the drag handle floats at the right edge of the sidebar and remains usable without changing file names or sidebar width settings.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a dedicated hover drag handle to document file rows in SideNavigation. Only the handle starts native HTML5 drag, and dataTransfer carries the document ID and current path while preserving link clicks, expansion, and sorting.
2. Add shared drop-target state and visual feedback to folder rows and the Documents title. Accept only document drags, use the folder node path as the target, and use an empty path for the doc root. Clear state on dragend, drop, and invalid targets, and skip same-folder updates.
3. Read the latest document content with apiClient.fetchDoc and call updateDoc with the original content and target path. Reuse the existing refresh and documents-updated broadcast on success, and preserve the tree while showing an error on failure.
4. Add localized handle, drop-target, and move-failure messages for all five interface languages without changing document creation, sorting, or collapse behavior.
5. Add web drag tests for the hover handle, handle-only drag start, folder moves, root moves, same-folder and invalid drops, refresh, and failure handling. Run the relevant bun test, bunx tsc --noEmit, and bun run check . commands.
6. Allow long document links to shrink and keep the drag handle absolutely positioned with a floating background at the row right edge. Cover narrow sidebars with a regression test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Only the dedicated handle starts native HTML5 drag. dataTransfer uses application/x-backlog-document to carry the document ID and current path. Folder rows and the Docs title accept drops, while same-folder, invalid, and cancelled drops are no-ops. Moving reads the latest body with fetchDoc and updates only the directory through updateDoc. Success uses the existing refresh and documents-updated broadcast; failure preserves the tree and shows an error. Long document links can shrink while the handle floats at the row right edge with an opaque background. Validation: 13 sidebar tests passed; bunx tsc --noEmit passed; bun run check . passed with pre-existing warnings only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented document drag-and-drop to folders and the Docs root. Only the hover handle starts dragging, document content is preserved, and long-title or narrow-sidebar layouts keep the handle floating at the right edge without changing file names or sidebar widths.

Verification: 13 sidebar tests passed; bunx tsc --noEmit passed; bun run check . passed.
<!-- SECTION:FINAL_SUMMARY:END -->

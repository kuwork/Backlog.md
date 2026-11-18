---
id: BACK-851
title: Support drag and drop folder moves in the web UI
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-18 03:37'
updated_date: '2026-11-18 15:36'
labels:
  - web-ui
dependencies: []
references:
  - 'src/web/components/SideNavigation.tsx:89-180'
  - 'src/web/lib/api.ts:921-954'
  - 'src/web/lib/api.ts:1210-1229'
  - 'src/server/index.ts:922-938'
  - 'src/server/index.ts:2535-2583'
modified_files:
  - src/file-system/operations.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/web/locales/ko.ts
  - src/test/web-side-navigation-docs-drag.test.tsx
  - src/test/server-docs-folder-move.test.ts
  - src/test/server-content-broadcast.test.ts
ordinal: 410004
actual_start: '2026-11-18 07:16'
actual_end: '2026-11-18 11:17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web document tree already supports dragging individual documents, but folders cannot yet be moved to change their hierarchy. Existing APIs can only update one document path and create directories. This task implements folder drag-and-drop interactions in the web UI together with a directory-level move API, ensuring that nested documents and empty directories are migrated intact and that invalid targets and failures are handled. Scope includes frontend, backend, and automated tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hovering a folder shows a drag handle and moving the pointer away hides it; only the handle initiates dragging, without interfering with folder clicks, expand/collapse, or the action menu.
- [x] #2 While dragging a folder, valid folders and the Docs header show recognizable drop feedback, while invalid targets provide no drop feedback.
- [x] #3 Dropping a folder into another folder moves its directory and all nested contents, including empty folders; the document tree updates promptly and the new location persists after a page refresh.
- [x] #4 Dropping a folder onto the Docs header moves it to the doc root; the document tree updates promptly and the new location persists after a page refresh.
- [x] #5 Dropping into the current parent does not trigger a modification; invalid targets, canceled drags, and moves into itself or a descendant leave the original location unchanged.
- [x] #6 Provide a directory-level move API rather than simulating moves through individual documents; reject path traversal, missing source directories, and target conflicts with clear error statuses.
- [x] #7 After a successful move, use the existing document-tree refresh and documents-updated broadcast; on failure, preserve the original tree and show an error without producing a partial move.
- [x] #8 With long folder names or a narrow sidebar, the drag handle floats on the right side of the sidebar and remains usable without changing folder names or sidebar-width settings.
- [x] #9 Automated tests cover the directory-move API, folder drops, root drops, self/descendant drops, invalid drops, canceled drags, failure handling, and refresh persistence.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. After approval, create the tasks/back-851-folder-drag-move branch from the current HEAD while preserving unrelated workspace changes.
2. Add FileSystem.moveDocsFolder(sourcePath, targetParentPath), reusing document path normalization. Validate the source directory, target parent, duplicate target names, and directory types; treat the same parent as a no-op; reject moves into itself or a descendant; and use one rename to atomically move the entire directory while preserving nested documents, empty directories, and file contents.
3. Add PATCH /api/docs/folder with { sourcePath, targetParentPath }; an empty target parent means the doc root. Return { success, path }, distinguishing 400 invalid paths or move relationships, 404 missing source or target parent, 409 target conflicts, and other server errors. Explicitly broadcast documents-updated after success so empty-folder moves notify other clients; do not simulate the move through per-document updates.
4. Add a directory-move method to apiClient. In SideNavigation, add a dedicated MIME type, drag state, and hover handle for folders, with only the handle initiating dragging. Use separate primary and floating controls to avoid nested buttons, preserve expand/collapse, ordering, and action-menu behavior, and keep the handle floating on the right for long names and narrow sidebars.
5. Unify document and folder drop handling: show feedback on valid folders and the Docs header; use the folder path for folder drops and an empty path for Docs-header drops. Exclude same-parent, self, and descendant targets in the client and validate again on the server. Clear state on drop or dragend, call onRefreshData after success, preserve the original tree and show an error on failure, and add strings for all five UI languages.
6. Expand automated tests: cover nested and empty-directory moves, root moves, same-parent moves, self/descendant rejection, missing sources and target parents, target conflicts, traversal, file contents, and tree persistence on the server; cover empty-folder moves in broadcast tests; and cover handles, handle-only dragging, valid and invalid targets, cancellation, failures, refresh calls, long names, narrow sidebars, and existing document-drag regressions on the web.
7. Run the relevant bun test, bunx tsc --noEmit, and bun run check . commands. Smoke-test folder moves, root moves, error feedback, and existing document dragging in the local web service, then update task acceptance, modified files, and verification records.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implemented
- Added atomic directory moves through PATCH /api/docs/folder using one rename, including docs-root containment, same-parent no-op, self/descendant rejection, missing-path handling, conflict detection, and documents-updated broadcast for empty folders.
- Added the web client folder-move API and folder drag handles with a dedicated MIME type, folder and Docs-root drop targets, invalid-target suppression, drag cleanup, refresh, and error feedback.
- Scoped hover controls to each folder row so parent hover no longer opens every descendant menu. Preserved expand/collapse and action buttons, kept handles usable with long names and narrow sidebars, and closed the document action dropdown when the pointer leaves its control area.
- Added English, Simplified Chinese, Traditional Chinese, Japanese, and Korean strings.

## Automated verification
- bun test src/test/server-docs-folder-move.test.ts: 9 passed, 0 failed, 54 assertions.
- bun test src/test/web-side-navigation-docs-drag.test.tsx src/test/server-content-broadcast.test.ts src/test/web-side-navigation-docs-sort.test.tsx: 30 passed, 0 failed, 126 assertions. This includes 17 web drag/dropdown tests, 7 broadcast tests, and 6 existing sorting tests.
- bunx tsc --noEmit: passed.
- bun run check .: passed with no errors; 14 pre-existing warnings and 1 info remain.

## Browser smoke
- Served the latest bundle 3127aa207ee7c48e at http://localhost:6420 and verified the loaded document tree.
- Verified single-row hover controls and dropdown close-on-leave in the real page.
- Moved differentiation into migration and back to the Docs root. The migration count changed 12 to 13 to 12, nested contents remained intact, and the final root location persisted after refresh.
- Forced one PATCH /api/docs/folder response to fail with a 500 test stub; the page displayed the error and preserved the tree.
- Regressed existing document dragging by moving Testing Style Guide into differentiation and back to the root. Restored all smoke-test data and reverted the document metadata side effect.

## Build note
- The default Windows .building cache path still raises EPERM, so the same fingerprint was built successfully through an explicit staging directory without changing build-web.ts. The running service logs confirm bundle cache hit @ 3127aa207ee7c48e (4 files).
- No commit has been created.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented folder drag-and-drop moves in the web UI with an atomic directory-level PATCH API, path and conflict validation, documents-updated broadcasts, localized feedback, single-row hover controls, and dropdown close-on-leave behavior.

Verification:
- 39 tests passed, 0 failed, with 180 assertions across folder moves, web dragging, broadcasts, and sorting regressions.
- bunx tsc --noEmit passed.
- bun run check . passed with only pre-existing warnings.
- Browser smoke passed for folder/root moves, refresh persistence, failure feedback, menu behavior, and existing document dragging; all test data was restored.
<!-- SECTION:FINAL_SUMMARY:END -->

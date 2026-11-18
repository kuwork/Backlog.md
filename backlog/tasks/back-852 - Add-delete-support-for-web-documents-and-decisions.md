---
id: BACK-852
title: Add delete support for web documents and decisions
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-18 15:51'
updated_date: '2026-11-18 16:39'
labels:
  - web-ui
dependencies: []
references:
  - src/web/components/SideNavigation.tsx
  - src/web/lib/api.ts
  - src/web/locales/en.ts
  - src/server/index.ts
  - src/file-system/operations.ts
modified_files:
  - src/file-system/operations.ts
  - src/server/index.ts
  - src/web/lib/api.ts
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/ko.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/web-side-navigation-delete.test.tsx
  - src/test/server-docs-decisions-delete.test.ts
ordinal: 411004
actual_start: '2026-11-18 15:55'
actual_end: '2026-11-18 16:39'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web users currently have no way to delete documents or decisions; the CLI has no doc delete / decision delete subcommand either. Deletion is a distinct need from archival: users want to permanently remove a file or a whole folder from the web UI, with a confirmation step so a mis-click cannot destroy content.

Interaction rules: folders are deleted from the + dropdown menu (next to Create file / Create folder); individual files get a hover delete button on their row; both must ask for confirmation before deleting, never delete directly.

Data model note: documents have a recursive folder tree (folders are relative paths under docsDir), so file and folder deletion both apply. Decisions are a flat list with no folder concept, so only file deletion applies to decisions.

Scope: web UI plus the server routes and file-system primitives it needs. CLI and MCP delete commands are out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hovering a document file in the side navigation reveals a delete button; activating it opens a confirmation prompt and removes the underlying document only after the user confirms.
- [x] #2 Cancelling the confirmation leaves the document or decision untouched.
- [x] #3 The + dropdown on each document folder contains a delete-folder action; confirming it removes the folder and all files beneath it. The root documents + has no delete action because the docs root is not a deletable folder.
- [x] #4 Hovering a decision in the side navigation reveals a delete button; confirming removes that decision.
- [x] #5 Server exposes DELETE endpoints for a document file, a docs folder, and a decision file, each succeeding only when the target exists.
- [x] #6 Delete endpoints reject path traversal (absolute paths and parent-dir segments) and return a clear error for a missing target.
- [x] #7 After a delete the UI refreshes and no longer lists the removed item; if the deleted item was open, the view falls back to the list.
- [x] #8 All five locale files carry the new delete action, folder-delete menu item, and confirmation copy.
- [x] #9 Tests cover the hover and + dropdown interactions with confirmation, plus the DELETE endpoints including traversal and not-found cases.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. File layer (src/file-system/operations.ts): add deleteDocument(idOrPath), deleteDecision(id), deleteDocsFolder(folderPath). Locate doc files via listDocuments() -> Document.path (docs can live in subfolders); decisions via listDecisions() -> path. Reuse normalizeDocumentRelativePath and a shared isPathInsideDir containment guard; refuse the docs root; import rm for recursive folder delete.
2. Server (src/server/index.ts): register DELETE /api/docs/:id, DELETE /api/decisions/:id, DELETE /api/docs/folder (body.path) with handlers modeled on handleDeleteMemo (404 when missing, 204 on success, broadcastDataUpdated('documents'/'decisions'), 409 on ambiguous id). Bun gives the literal /api/docs/folder route priority over /api/docs/:id.
3. Web API (src/web/lib/api.ts): add deleteDoc(id), deleteDecision(id), deleteDocsFolder(path) following deleteMemo.
4. Web UI (src/web/components/SideNavigation.tsx): add a Trash icon; add a red delete-folder item to DocActionDropdown on folder nodes only (root + has no deletable folder); add a hover delete button to DocTreeItem file rows beside the drag handle; wrap decision rows in a group/file container with a hover delete button; confirm via window.confirm, then onRefreshData() and navigate back to the list when the deleted item was open (exact route-id comparison).
5. i18n: add nav delete keys (deleteDocument, deleteFolder, deleteDecision, confirmDeleteDocument, confirmDeleteFolder, confirmDeleteDecision, failedToDelete) to all 5 locale files; en.ts is the dict source of truth.
6. Tests: new web-side-navigation-delete.test.tsx for hover buttons, + menu folder delete, confirm/cancel behavior, refresh and error display; new server-docs-decisions-delete.test.ts for the three DELETE endpoints including 404 and path-traversal rejection.
7. Verify: bunx tsc --noEmit, bun test on the two new files (--timeout 30000), bunx biome check --write on touched files, plus drag/folder-move regression suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: added FileSystem.deleteDocument/deleteDecision/deleteDocsFolder (shared isPathInsideDir containment guard; rejects docs root and traversal), three DELETE server routes with 204 + scoped broadcast (409 on ambiguous id), web apiClient delete helpers, and SideNavigation UI (hover trash on doc/decision rows, folder delete in + dropdown, window.confirm on all paths, shared runDelete with exact route-id navigation fallback). Decisions remain flat (file-only delete). i18n keys added to all 5 locales.

Validation: bunx tsc --noEmit clean; bunx biome check --write clean on 11 touched files; new tests web-side-navigation-delete.test.tsx (5/5) and server-docs-decisions-delete.test.ts (9/9 when run in isolation). Regression: web-side-navigation-docs-drag (17/17) and server-docs-folder-move (9/9) pass individually. Running many server test files in one process intermittently hits 'socket connection was closed unexpectedly' (environmental startup flake, not an assertion failure).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added web UI delete for documents and decisions.

- Document files: hover trash button; folder deletion: red item in the + dropdown. Decisions: hover trash button (flat namespace, no folders).
- Every delete goes through window.confirm with an explicit message; cancel leaves data untouched; failures surface an inline alert.
- After a successful delete the side navigation refreshes; if the deleted item was open, the view navigates back to the list.
- Backend: new FileSystem delete primitives with path-containment guards, and DELETE /api/docs/:id, /api/docs/folder, /api/decisions/:id returning 204 with scoped refresh broadcasts.
- i18n keys added to en, ja, ko, zh-CN, zh-TW.

Verification: bunx tsc --noEmit clean; biome clean; new web (5) + server (9) tests pass; drag/folder-move regression suites pass.
<!-- SECTION:FINAL_SUMMARY:END -->

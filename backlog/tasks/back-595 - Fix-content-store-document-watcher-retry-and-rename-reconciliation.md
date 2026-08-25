---
id: BACK-595
title: Fix content-store document watcher retry and rename reconciliation
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-09 13:49'
updated_date: '2026-08-25 08:35'
labels:
  - server
dependencies: []
references:
  - src/core/content-store.ts
  - src/test/content-store.test.ts
  - src/utils/document-id.ts
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/web/components/TaskDetailsModal.tsx
modified_files:
  - src/core/content-store.ts
  - src/test/content-store.test.ts
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/web/components/TaskDetailsModal.tsx
actual_start: '2026-08-25 05:37'
actual_end: '2026-08-25 08:31'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The ContentStore document watcher has identity-handling and event-handling defects that cause document events to be lost or leave stale entries in the store and web UI.

A file named doc-1.md derives the filename id with the .md extension, so the watcher validator never matches the frontmatter id doc-1 and the event is silently lost.

Padded filenames such as doc-0001 - Title.md with unpadded frontmatter id doc-1 fail raw-string comparison, so rename and delete events cannot reconcile the correct store entry and may leave stale or duplicate entries.

The document watcher exhausts inline retry attempts instead of deferring rechecks when the file is temporarily unreadable or not yet stable, causing events to fall back to full refreshes unnecessarily.

Store-side updates look up documents by raw id rather than by path. This is fragile when filename padding differs from the frontmatter id, and it does not handle cases where the saved path and the id no longer align.

Deleting a folder that contains documents does not trigger a store refresh, so the web UI continues to display documents that no longer exist on disk.

The web title input placeholders for documents, decisions, and tasks currently render in the same color as filled-in text, making them indistinguishable from actual titles.

This task is to fix these defects so that document watcher events settle correctly, store-side operations are path-based, folder-level changes are reflected in the UI, and title input placeholders appear as dim hint text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-613 and git show a2c6746 as implementation reference.
- [x] #2 A watched file named doc-1.md settles and publishes without exhausting retryRead attempts.
- [x] #3 Rename/delete reconciliation for zero-padded filenames (e.g., doc-0001 - Title.md with frontmatter doc-1) finds the correct store entry via document identity equality and path addressing.
- [x] #4 Tests cover untitled filenames, padded/unpadded identity mismatches, and padding-equivalent siblings.
- [x] #5 Rename + respell drops the replaced entry without leaving a stale equivalent behind.
- [x] #6 A document moved into or renamed within a subfolder reconciles by its docs-relative path.
- [x] #7 A concurrent refresh does not resurrect a document dropped by the watcher when equivalent IDs are involved.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Watcher identity derivation
- 1.1 Add documentFilenameId() helper in src/core/content-store.ts to derive doc-N from both doc-N.md and doc-N - Title.md, returning null for non-addressable names.
- 1.2 Add watchedDocumentPath() helper to normalize the docs-relative path for a watcher event, returning null when it cannot be expressed.
- 1.3 Replace the watcher prefix/split checks with the new helpers and fall back to refreshDocumentsFromDisk() when derivation fails.

### Phase 2 - Identity-aware comparison and path-based publish/remove
- 2.1 Import and use documentIdsEqual from src/utils/document-id.ts for filename-vs-frontmatter checks in the watcher validator and in refreshDocumentsFromDisk.
- 2.2 Change removeWatchedDocument() to locate the document by normalized relative path only, removing the identity fallback.
- 2.3 Make publishWatchedDocument() return a strandedEquivalent boolean: drop the entry at the replaced path when the frontmatter ID respelled, then detect whether another path holds an equivalent ID and trigger a full refresh.
- 2.4 Track deletion versions so mergeDocuments() can avoid resurrecting a document that was dropped while a refresh was in flight.

### Phase 3 - Deferred recheck and aligned version naming
- 3.1 Add DeferredRecheck interface and deferredRechecks map; add reconcileOrSchedule, scheduleDeferredRecheck, armDeferredRecheck, cancelDeferredRecheck, and clearDeferredRechecks helpers.
- 3.2 Switch the document watcher from inline retryRead to reconcileOrSchedule; keep task/decision/wiki watchers on retryRead.
- 3.3 Rename document version maps and methods to contentItemGenerations/contentItemVersions with nextContentItemGeneration/nextContentItemVersion and deletedDocumentGenerations.

### Phase 4 - Path-based store update and folder deletion
- 4.1 Patch saveDocument wrapper to pass result.relativePath through handleDocumentWrite to updateDocumentFromDisk.
- 4.2 Change updateDocumentFromDisk to read the file by relative path, parse it, inject path, and publish via publishWatchedDocument instead of looking up by raw id.
- 4.3 Change createDocumentWatcher non-.md branch to trigger refreshDocumentsFromDisk() on rename events so deleting a folder removes the documents inside.

### Phase 5 - Tests and verification
- 5.1 Add red-then-green tests in src/test/content-store.test.ts for doc-1.md settle, padded/unpadded load+delete, padding-equivalent siblings, rename+respell, subfolder rename/move, concurrent-refresh resurrection, and folder deletion.
- 5.2 Run bunx tsc --noEmit, bun run check ., and bun test src/test/content-store.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added documentFilenameId() and watchedDocumentPath() helpers to derive the document id and docs-relative path from a watched filename.
Replaced the watcher base.startsWith("doc-") / base.split(" - ") logic with the new helpers; non-addressable names fall back to refreshDocumentsFromDisk().
Imported documentIdsEqual and used it for filename-vs-frontmatter matching in the watcher validator and in refreshDocumentsFromDisk().
Changed removeWatchedDocument() to locate store entries by document path only, removing the identity-equivalence fallback.
Added dropWatchedDocument() to version deletions so mergeDocuments() can avoid resurrecting a dropped document during a concurrent refresh.
Changed publishWatchedDocument() to return a strandedEquivalent boolean: it drops the entry at the replaced path when the frontmatter ID changes and triggers a full refresh when another path holds an equivalent ID.
Switched the document watcher to deferredRechecks/reconcileOrSchedule while task/decision/wiki watchers keep retryRead.
Renamed document version maps to contentItemGenerations/contentItemVersions and added nextContentItemGeneration/nextContentItemVersion/isContentItemGenerationCurrent; deletedDocumentVersions renamed to deletedDocumentGenerations.
Changed patchFilesystem saveDocument wrapper to pass result.relativePath through handleDocumentWrite to updateDocumentFromDisk, which now reads the file by path and injects path before publishing instead of using filesystem.loadDocument(id).
Changed createDocumentWatcher to trigger refreshDocumentsFromDisk() on non-.md rename events so deleting a folder removes the documents inside and the web UI updates.
Fixed placeholder text color for document/decision/task title inputs in web components so placeholder text is dim (gray-400/500) instead of matching the input text color.
Added regression tests for folder deletion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed ContentStore document watcher identity handling and followed up with watcher/UX polish. doc-1.md files without a title segment now derive correct ids; padded filenames reconcile via documentIdsEqual; rename events publish by path with strandedEquivalent fallback; store removal uses path-only lookup; version tracking uses contentItemGenerations/contentItemVersions with nextContentItemGeneration/nextContentItemVersion and deletedDocumentGenerations; document watcher uses deferredRechecks/reconcileOrSchedule while task/decision/wiki watchers keep retryRead; updateDocumentFromDisk reads by saved relativePath; folder deletion triggers refreshDocumentsFromDisk for non-md rename events; added regression tests with 16/16 passing; fixed placeholder text color for document/decision/task title inputs; tsc --noEmit passes; biome check clean except pre-existing assets.ts warnings.
<!-- SECTION:FINAL_SUMMARY:END -->

---
title: BACK-595 Fix content-store document watcher retry and rename reconciliation
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - server
  - web-ui
  - bug
source_path: backlog/tasks/back-595 - Fix-content-store-document-watcher-retry-and-rename-reconciliation.md
---

# BACK-595 Fix content-store document watcher retry and rename reconciliation

The ContentStore document watcher lost events and left stale entries: `doc-1.md` derived an id with the `.md` extension so the validator never matched, padded filenames (doc-0001) failed raw-string comparison, inline retry exhaustion forced full refreshes, store updates looked up by raw id, and folder deletion never refreshed the store. All fixed with identity-aware, path-based reconciliation.

## Summary

- `src/core/content-store.ts`: new `documentFilenameId()` derives doc-N from `doc-N.md` and `doc-N - Title.md` (null for non-addressable names); `watchedDocumentPath()` normalizes the docs-relative path; non-addressable names fall back to `refreshDocumentsFromDisk()`.
- Imported `documentIdsEqual` from `src/utils/document-id.ts` for filename-vs-frontmatter matching in the watcher validator and refresh.
- `removeWatchedDocument()` locates entries by normalized relative path only (identity fallback removed); `publishWatchedDocument()` returns `strandedEquivalent` — drops the entry at the replaced path when the frontmatter ID respells and triggers a full refresh when another path holds an equivalent ID.
- Version tracking renamed to `contentItemGenerations`/`contentItemVersions` with `nextContentItemGeneration`/`nextContentItemVersion` and `deletedDocumentGenerations`; `dropWatchedDocument()` versions deletions so `mergeDocuments()` cannot resurrect a dropped document during a concurrent refresh.
- Document watcher switched to `deferredRechecks`/`reconcileOrSchedule` (deferred recheck instead of inline retryRead); task/decision/wiki watchers keep retryRead.
- Store-side update is path-based: the patched `saveDocument` wrapper passes `result.relativePath` through `handleDocumentWrite` to `updateDocumentFromDisk`, which reads by path and injects it before publishing.
- Folder deletion: `createDocumentWatcher` triggers `refreshDocumentsFromDisk()` on non-.md rename events.
- Web polish: title input placeholders in DocumentationDetail, DecisionDetail, TaskDetailsModal render dim (gray-400/500) instead of matching input text color.
- Tests: red-then-green regressions in `src/test/content-store.test.ts`, 16/16 passing.

## Acceptance Criteria

- doc-1.md settles without exhausting retries; padded/unpadded identity reconciliation via documentIdsEqual and path addressing; rename+respell leaves no stale equivalent; subfolder moves reconcile by docs-relative path; concurrent refresh cannot resurrect dropped documents; folder deletion refreshes the store.

## Related Concepts

- [[concepts/core-architecture]] — ContentStore watcher/merge/version architecture
- [[concepts/web-server]] — file watching feeding the web UI
- [[concepts/task-identity]] — document id/padding identity rules shared with task identity

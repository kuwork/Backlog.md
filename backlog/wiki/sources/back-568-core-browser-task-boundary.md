---
title: BACK-568 Make Core the sole browser task boundary
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - server
  - web-ui
  - core
source_path: backlog/tasks/back-568 - Make-Core-the-sole-browser-task-boundary.md
---

# BACK-568 Make Core the sole browser task boundary

Made Core the single boundary for browser task reads/writes, eliminating duplicate filesystem reads and full-corpus refreshes after reorder operations.

## Summary

- `src/server/index.ts`: `handleUpdateTask` and create-task parent resolution now resolve through `core.getTask` instead of double-reading the filesystem; `AmbiguousTaskIdError` surfaces as `409`.
- `tasks-updated` WebSocket broadcasts are debounced (75ms) so batch updates publish once; timer cleared on `stop()`.
- `handleReorderTask` returns `changedTasks`; `src/web/lib/api.ts` type updated; `App.tsx` applies `applyReorderedTasks` atomic merge; `Board.tsx` applies the payload without a full refresh.
- `src/core/task-identity-index.ts` extended with `withWorkingCopyCorpus`, `withRecord`, `getFingerprint`.
- `src/core/content-store.ts` keeps a lightweight `TaskCorpusSnapshot` (activeTasks/completedTasks separation + indexed resolution) with `resolveTaskForRead`/`resolveTaskForMutation` bridging to Core; no upstream publication-owner machinery ported.
- Latent gap fixed: `FileSystem.findTaskFilePaths` detects same-ID collisions at distinct task file paths, so `Core.getTask` ambiguity detection is effective.

## Implementation Notes

Fork ContentStore is a deep rewrite without the upstream publication-owner/batchTaskUpdates system, so the corpus snapshot was kept lightweight and bridges to existing Core semantics.

## Related Concepts

- [[concepts/core-architecture]] — Core and ContentStore
- [[concepts/web-server]] — Server WebSocket and handler architecture
- [[concepts/task-identity]] — Task identity index

## Related Sources

- [[sources/back-567-cross-branch-task-identity]] — Shared task identity

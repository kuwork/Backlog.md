---
title: BACK-703 Incremental rebuild and hot-update sync (Graph Service)
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - graph
  - kuzu
  - web-ui
source_path: backlog/tasks/back-703 - Incremental-rebuild-and-hot-update-sync-core-notify-hook-watcher-Graph-Service.md
---

# BACK-703 Incremental rebuild and hot-update sync (Graph Service)

Phase 1 sync engine from doc-014 on top of BACK-702: keep the graph live as the corpus changes. It adds an incremental rebuild engine, an injectable core notify hook, a debounced hot-update pipeline, and an in-process Graph Service serving `/api/graph` to the Web UI.

## Summary

- Incremental engine (`src/graph/incremental.ts`): `computeChangeSet` diffs per-file hash caches; `applyChangeSet` splits affected records into same-id in-place updates (`updateNodes` preserves edges) vs delete+insert (demote/promote), drops stale nodes by cached filePath, then rebuilds exactly the edges touching affected ids; `RecordCache` means untouched files are never re-read
- `GraphStore` grew `updateNodes`, `deleteNodesByFilePath`, `deleteEdgesTouching`, `getAllNodes`/`getAllEdges`, implemented for both kuzu and memory backends
- Core notify hook: public injectable `FileSystem.onFilesChanged` (null = no-op) emitted at every mutation-layer file exit — saveTask, drafts, archive/complete renames, promote/demote unlinks, milestone writes; batch operations emit per write and the consumer dedupes, so CLI/TUI/Web/MCP needed zero changes
- GraphService: `graph.kuzu.lock` O_EXCL single-holder lock with stale-pid takeover; notify() + `node:fs` watch on the four whitelisted dirs converge on one pending Set with 150ms debounce and serialized sync; 5-minute stat-scan reconciliation as the third consistency layer
- Server: eager fire-and-forget start on boot (lock loss never blocks), `GET /api/graph` returns `{status, backend, nodes, edges, reports, nodeCount}` with `building` during first import and 503 when another process holds the lock; updates pushed over the existing WebSocket channel (`graph-updated`), not SSE
- Validation (`src/graph/validation.ts`): millisecond count checks after cold start; lazy DFS cycle detection off the critical path; `isReady`/`isBlocked` delegated to `readiness.ts`, never re-implemented in Cypher
- Tests: 11 new in `graph-sync.test.ts` plus a real-repo Node+kuzu E2E (744 nodes / 125 edges)

## Acceptance Criteria

- Cache-diff change sets, batched inserts, edges built after nodes; same-id moves preserve edges while demote/promote rebuild under the new id
- Injectable no-op notify hook in the core mutation layer reporting every changed path
- Single dedup + debounce + lock pipeline; `graphChanged` broadcast after each sync
- Single-holder lock, in-process hosting, `/api/graph` payload with building/503 semantics
- Fast count validation, lazy cycles, readiness.ts stays the single readiness source

## Related Concepts

- [[concepts/web-server]] — hosts the in-process Graph Service and `/api/graph`
- [[concepts/task-lifecycle]] — mutations (complete/archive/demote/promote) that drive the notify hook

## Related Sources

- [[sources/back-702-kuzu-graph-foundation]] — schema, fingerprint and store this task syncs incrementally (same batch)
- [[sources/back-704-graph-view-web-ui]] — the visualization page consuming `/api/graph` (same batch)

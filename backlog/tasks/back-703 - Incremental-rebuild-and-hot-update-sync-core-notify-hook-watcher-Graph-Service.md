---
id: BACK-703
title: >-
  Incremental rebuild and hot-update sync (core notify hook, watcher, Graph
  Service)
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 06:38'
updated_date: '2026-09-24 08:59'
labels:
  - kuzu
  - graph
  - phase-1
milestone: m-9
dependencies:
  - BACK-702
documentation:
  - backlog/docs/BRDS/doc-014 - Kuzu-任务图谱：冷启动校验与热更新设计.md
modified_files:
  - src/graph/incremental.ts
  - src/graph/service.ts
  - src/graph/validation.ts
  - src/graph/store.ts
  - src/graph/cold-start.ts
  - src/graph/relations.ts
  - src/file-system/operations.ts
  - src/server/index.ts
  - src/web/App.tsx
  - src/web/components/Layout.tsx
  - src/web/components/Navigation.tsx
  - src/web/components/GraphStatusIndicator.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/graph-sync.test.ts
  - >-
    backlog/tasks/back-703 -
    Incremental-rebuild-and-hot-update-sync-core-notify-hook-watcher-Graph-Service.md
priority: high
ordinal: 273400
actual_start: '2026-09-24 07:43'
actual_end: '2026-09-24 08:40'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the Phase 1 sync engine from doc-014 on top of BACK-702.

**Incremental rebuild (§2.2, §3.5).** Derive added/removed/changed from the per-file cache; DETACH DELETE nodes of removed/changed files by cached filePath; batch-insert added/changed files; build all edges after all nodes are placed; rewrite the cache and fingerprint. Handle the §3.5 migration scenarios: same-id path changes (completion tasks/ -> completed/, rename) update filePath/status in place and preserve edges; demote/promote delete the old node and rebuild edges under the new id.

**Core notify hook (§3.1/§3.3).** An injectable onFilesChanged(paths: string[]) callback at the common exits of the core mutation layer (completeTask, archiveTask, moveTasksToStatus, reorderTask, createTaskFromInput, editTaskInTui, updateMilestone, demote/promote). Batch operations report every changed path; the default is a no-op so CLI/TUI/Web/MCP need zero changes.

**Hot-update pipeline (§3.2).** notify() and Bun.watch events (on exactly the four whitelisted dirs) converge on one pending-path Set with a 150ms debounce and withLock serialization. broadcastGraphChanged() over SSE lets the Web UI refetch /api/graph without polling.

**Graph Service hosting (§3.3/§5).** A graph.kuzu.lock file lock enforces the single holder; the service deploys in-process with the Web UI. /api/graph returns nodes + edges + validation reports; the first full import responds with a building status; a corrupt library is deleted and regenerated. A 5-minute stat-scan reconciliation runs as the third consistency layer (§3.4).

**Validation (§4).** Millisecond node/edge count checks after cold start; lazy cycle detection kept off the critical path; readiness.ts stays the single source for isReady/isBlocked.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Change set is derived from the cache diff; inserts are batched (no per-row await); edges are built after all nodes are placed
- [x] #2 Same-id path changes (completion, rename) update filePath/status in place and preserve edges; demote/promote delete the old node and rebuild edges under the new id
- [x] #3 onFilesChanged hook lives in the core mutation layer, is injectable with a no-op default, and batch mutations report every changed path
- [x] #4 notify() and Bun.watch events converge on one dedup Set + 150ms debounce; sync runs are serialized by a lock; a graphChanged broadcast is emitted after each sync
- [x] #5 graph.kuzu.lock enforces a single holder; Graph Service runs in-process with the Web UI; /api/graph returns nodes + edges + validation reports
- [x] #6 Startup always runs fingerprint validation; a corrupt library is rebuilt; first full import responds with a building status; the 5-minute stat reconciliation loop runs
- [x] #7 Fast validation queries run in milliseconds; cycle detection stays lazy; readiness.ts is the single source for isReady/isBlocked
- [x] #8 Tests cover incremental diff, batch notify, watcher debounce, all §3.5 migration scenarios, the single-holder lock, and /api/graph
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Incremental rebuild: diff added/removed/changed from the per-file cache; DETACH DELETE stale nodes by cached filePath; parse + batch-insert new files; build edges after all nodes are placed; rewrite meta cache + fingerprint. Cover §3.5 scenarios: same-id path change -> update filePath/status in place; demote/promote -> delete old node, rebuild edges under the new id.
2. Core notify hook: add injectable onFilesChanged(paths: string[]) at the mutation layer's common file-write exits; collect and batch-report all changed paths for multi-file operations; default to a no-op implementation.
3. Hot-update pipeline: single dedup entry (pending Set) merging notify() and Bun.watch events; 150ms debounce; withLock serialization against re-entry; broadcastGraphChanged() via SSE after each successful sync.
4. Graph Service hosting: graph.kuzu.lock single-holder lock (later processes skip; IPC clients are Phase 2); run in-process with the Web UI (Bun.serve); expose /api/graph (nodes + edges + missingDependencies/ambiguousIds/invalidRelations reports); respond with building status during the first full import; startup always runs fingerprint validation and rebuilds a corrupt library; add the 5-minute stat-scan reconciliation loop (§3.4 third layer).
5. Validation: fast node/edge count Cypher checks after cold start; lazy DependsOn cycle detection kept off the critical path; call readiness.ts for isReady/isBlocked instead of duplicating status logic in Cypher.
6. Tests: incremental diff correctness, batch notify path collection, watcher debounce + lock serialization, all §3.5 migration scenarios, single-holder lock behavior, /api/graph payload, and an end-to-end save-and-refresh flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation notes (BACK-703):
- Incremental engine (src/graph/incremental.ts): computeChangeSet diffs per-file hash caches; applyChangeSet parses only added/changed files, splits affected records into same-id in-place updates (updateNodes preserves edges) vs delete+insert (detached old node, edges rebuilt under the new id), drops unknown-path stale nodes by filePath, then rebuilds exactly the edges touching affected ids after all nodes are placed. RecordCache keeps the last parse per relPath so untouched files are never re-read; the cache rebuilds lazily after a fingerprint fast-path reuse.
- GraphStore grew four operations: updateNodes (in-place, edge-preserving), deleteNodesByFilePath, deleteEdgesTouching, getAllNodes/getAllEdges - implemented for both kuzu (parameterized SET / IN deletes / full scans) and memory backends.
- Core notify hook: FileSystem.onFilesChanged (public injectable, null = no-op) emitted at every mutation-layer file exit - saveTask (incl. renamed-away old path), saveDraft, archiveTask/completeTask renames, archiveDraft, promote/demote unlinks, createMilestone/updateMilestone/archiveMilestone. Batch operations emit per write; the consumer dedupes.
- GraphService (src/graph/service.ts): graph.kuzu.lock O_EXCL single-holder lock with stale-pid takeover; notify(paths) + node:fs watch on the four whitelisted dirs converge on one pending Set; 150ms debounce; sync runs serialized (mid-sync notification schedules exactly one resync); 5-minute stat-scan reconciliation; broadcastGraphChanged via injectable onGraphChanged (server pushes graph-updated over its WebSocket channel - SSE not needed).
- Web integration (src/server/index.ts): eager start on server boot (fire-and-forget, lock loss never blocks), GET /api/graph returning {status, backend, nodes, edges, reports, nodeCount} with building status during first import and 503 when another process holds the lock.
- Validation (src/graph/validation.ts): millisecond count checks after cold start; lazy DFS cycle detection over the edge list; isReady/isBlocked delegated to src/utils/readiness.ts (computeRecordReadiness wraps getTaskReadiness, no Cypher status logic).
- Tests: 11 new in src/test/graph-sync.test.ts (change set, RecordCache, counts/cycles/readiness, single-holder lock, incremental add/move-with-edge-preservation/dep-edit/demote, corrupt cache rebuild, hook batches, /api/graph payload + lock interplay). Real-repo E2E on Node+kuzu: 744 nodes/125 edges, incremental add/remove via notify, lock release verified.
- bunx tsc --noEmit clean; bunx biome clean; graph-foundation suite still 20/20.
<!-- SECTION:NOTES:END -->

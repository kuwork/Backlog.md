---
title: doc-14 Kuzu 任务图谱：冷启动校验与热更新设计
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - graph
  - kuzu
  - design
source_path: backlog/docs/BRDS/doc-14 - Kuzu-任务图谱：冷启动校验与热更新设计.md
---

# doc-14 Kuzu 任务图谱：冷启动校验与热更新设计

Design doc (v1, archived copy of `KUZU-GRAPH-SYNC.md`) for embedding a KuzuDB task graph into Backlog.md: Markdown files stay the single source of truth and `graph.kuzu` is a disposable derived cache, held exclusively by one long-lived Graph Service. Phase 1 covers `tasks/`, `drafts/`, `milestones/`, `completed/` (archive excluded); phase 3 (doc-15) adds wiki/docs/decisions.

## Summary

- Core principles: writers only ever write Markdown (never the DB); Kuzu is single-process embedded so one Graph Service owns `graph.kuzu` (others talk IPC); fail-safe direction is always full rebuild; fail-closed relation resolution aligned with `src/utils/readiness.ts` — dangling dependency IDs go to `missingDependencies`, never silently dropped
- Schema: single `FileNode` table with **project-relative path as primary key** (not `Task(id)`) so rename/move is just delete+insert with no identity drift; three semantic edge tables `ParentOf` / `BelongsToMilestone` / `DependsOn`; cross-type parent edges (draft under task) are legal because demotion keeps `parentTaskId`
- Schema versioning via a `Meta` table row (`SCHEMA_VERSION` in `src/graph/store.ts`, bump the constant, no migration code); `CREATE TABLE IF NOT EXISTS` is a silent no-op on stale shapes, so version mismatch → enumerate tables via `show_tables()`, drop REL before NODE, rebuild; no version row means stale
- Cold start: Merkle-style per-file fingerprint sidecar `graph.kuzu.meta.json` (size+mtime reuse cached hash, changed files re-read); fast path skips even gray-matter parsing; `PARSER_VERSION` mixed into the fingerprint forces rebuild on parser/schema changes; git-checkout-friendly since git doesn't rewrite unchanged files
- Incremental rebuild derives added/removed/changed from the fingerprint diff, `DETACH DELETE`s stale nodes, batch-inserts (never per-row await MERGE), and builds all edges only after every node lands
- Hot update: one `notify(paths)` hook sunk into the core mutation layer covers CLI/TUI/Web/MCP (they all write via `core.*` functions); editors/git fall back to `Bun.watch`; both paths converge on one debounced (150ms), lock-serialized sync entry; three-layer consistency = notify → watcher → periodic/cold-start reconciliation
- Special migrations: demote/promote generate new IDs (old ID vacated; core cleans inbound references but keeps the demoted draft's own `dependencies` and `parentTaskId`); task completion is same-ID directory move detected as "same id migration" — delete old node, add new, rebuild edges in the same batch
- Validation: fast node/edge count checks post-startup, cycle detection as a lazy recursive Cypher query, `missingDependencies`/`ambiguousIds` report shipped with `/api/graph` so the frontend renders dangling deps as gray dashed lines; readiness semantics reused from `readiness.ts`, never re-implemented in graph queries

## Acceptance Criteria

- Not applicable (design document); phase plan: phase 1 fingerprint cold-start + notify/watch hot update co-located with Web UI, phase 2 IPC hardening + 10k-task bulk-import benchmarks, phase 3 (done) wiki/decisions/docs per doc-15 with `schemaVersion` 2.

## Related Concepts

- [[concepts/core-architecture]] — the core mutation layer is the single notify hook point for all four entry surfaces
- [[concepts/task-identity]] — path-PK vs task-ID identity split, ambiguous-ID fail-closed handling
- [[concepts/task-lifecycle]] — demote/promote/complete semantics (vacated IDs, reference cleanup) the graph mirrors
- [[concepts/web-server]] — Web UI co-hosts the Graph Service in-process and receives `graphChanged` broadcasts

## Related Sources

- [[sources/doc-15-wiki-knowledge-graph-relation-design]] — phase-3 extension adding knowledge files, Tag nodes, and three mechanical edge tables
- [[sources/m-9-kuzu-task-graph-phase-1]] — the milestone scoping phase-1 delivery of this design

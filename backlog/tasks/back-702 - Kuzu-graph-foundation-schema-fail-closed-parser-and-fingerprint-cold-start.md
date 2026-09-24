---
id: BACK-702
title: 'Kuzu graph foundation: schema, fail-closed parser, and fingerprint cold start'
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 06:37'
updated_date: '2026-09-24 07:45'
labels:
  - kuzu
  - graph
  - phase-1
milestone: m-9
dependencies: []
documentation:
  - backlog/docs/BRDS/doc-014 - Kuzu-任务图谱：冷启动校验与热更新设计.md
modified_files:
  - .gitignore
  - package.json
  - bun.lock
  - src/graph/store.ts
  - src/graph/scanner.ts
  - src/graph/parser.ts
  - src/graph/relations.ts
  - src/graph/fingerprint.ts
  - src/graph/import.ts
  - src/graph/cold-start.ts
  - src/test/graph-foundation.test.ts
priority: high
ordinal: 271400
actual_start: '2026-09-24 07:01'
actual_end: '2026-09-24 14:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the Phase 1 foundation from doc-014.

**Graph model (§1).** A single Task node table (id, title, kind: task|draft|milestone, status, filePath), three REL tables (ParentOf, BelongsToMilestone, DependsOn), and a Meta table. A whitelist scanner covers only backlog/tasks, backlog/drafts, backlog/milestones, backlog/completed - archive is excluded and no **/*.md glob is allowed. Frontmatter is parsed per file with gray-matter.

**Fail-closed relation resolution (§1.3/§1.4).** Cross-kind ParentOf edges are legal. Dangling or ambiguous parentTaskId/milestone/dependency references produce invalidRelations / missingDependencies / ambiguousIds report entries instead of being silently dropped. Files missing an id are skipped with a warning; nodes always enter the graph.

**Full import.** Nodes are batch-inserted (COPY FROM or multi-value MERGE, never per-row await); all edges are built only after all nodes are placed.

**Cold-start fingerprint validation (§2.1).** A Merkle-style per-file hash cache lives in the sidecar graph.kuzu.meta.json ({parserVersion, files: {relPath: {size, mtimeMs, hash}}}); the aggregate fingerprint is sha256(PARSER_VERSION + sorted relPath|hash list). On startup: stat-scan whitelisted dirs without reading contents, reuse cached hashes when size+mtime are unchanged, rehash only changed files. Fingerprint match -> reuse the graph immediately (no gray-matter parsing); mismatch -> incremental/full rebuild. PARSER_VERSION is mixed in so parser/schema upgrades force a rebuild; a missing or corrupt cache triggers a full rebuild and rewrites the cache.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Schema DDL matches doc-014 §1.2 (one Task node table, three REL tables, Meta table)
- [x] #2 Whitelist scan covers tasks/drafts/milestones/completed only; archive and non-md assets are never touched
- [x] #3 Dangling or ambiguous references are recorded in missingDependencies/ambiguousIds/invalidRelations reports, and nodes still enter the graph
- [x] #4 A file without frontmatter id is skipped with a warning and does not poison the import
- [x] #5 Cold-start fast path is stat-only and reuses the graph when the aggregate fingerprint matches
- [x] #6 PARSER_VERSION is mixed into the fingerprint; a missing or corrupt meta cache triggers a full rebuild and rewrites the cache
- [x] #7 size+mtime are compared together; git checkout of untouched files keeps the cache warm
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the kuzu npm dependency and create the src/graph/ module skeleton; verify the native binding loads on Windows (fallback per §5: CI prebuilt artifacts or a :memory: degraded mode).
2. Define the schema DDL from §1.2: single Task node table, REL tables ParentOf/BelongsToMilestone/DependsOn, Meta table.
3. Implement the whitelist directory scanner over tasks/drafts/milestones/completed (archive excluded).
4. Implement the gray-matter parser producing one ParsedRecord per file; skip files without frontmatter id with a warning.
5. Implement fail-closed relation resolution (§1.3/§1.4) producing missingDependencies/ambiguousIds/invalidRelations reports; nodes always enter the graph.
6. Implement full import: batch-insert nodes (COPY FROM or multi-value MERGE, never per-row await), then build all edges after all nodes are placed.
7. Implement the fingerprint sidecar graph.kuzu.meta.json: per-file {size, mtimeMs, hash} plus aggregate sha256(PARSER_VERSION + sorted relPath|hash).
8. Implement cold start: load cache -> stat-only scan -> reuse/rehash per-file hashes -> compare aggregate fingerprint -> match: reuse graph; mismatch/corrupt: rebuild and rewrite cache.
9. Unit tests: parser edge cases, fail-closed reports, fingerprint hit/miss/corrupt-cache, git-checkout-friendliness (untouched files keep mtime and stay cache-warm).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation notes (BACK-702):
- kuzu@0.11.3 installed; native binding loads fine under Node but SEGFAULTS under Bun 1.3.14 on this machine (dlopen crash) - exactly the doc-014 §5 Windows risk. Mitigation: GraphStore abstraction with two backends; the native KuzuGraphStore is opt-in (BACKLOG_GRAPH_BACKEND=kuzu or explicit option, e.g. a Node-hosted service), the default is the pure-JS MemoryGraphStore (the doc's :memory: degraded mode). Memory stores are process singletons keyed by project root so the fast path has a warm graph to reuse.
- Kuzu SQL shapes validated end-to-end via a Node smoke run (tmp/smoke-kuzu.cjs): DDL, multi-value parameterized CREATE batches (chunked 100 rows, no per-row await), COPY FROM CSV for rel tables, count/getNode/getMeta queries.
- Data files live under backlog/: backlog/graph.kuzu (DB) and backlog/graph.kuzu.meta.json (fingerprint sidecar).
- Relations are fail-closed per §1.3/§1.4: cross-kind ParentOf legal, milestone hierarchy rejected, dependency targets restricted to task/draft, ambiguous ids produce no edges, all reports surfaced.
- Cold start: stat-only scan -> size+mmt rehash gate -> aggregate sha256(PARSER_VERSION + sorted relPath|hash) -> reuse or rebuild; correctness derives from content hashes so a touch with identical content still reuses.
- 18 tests in src/test/graph-foundation.test.ts (scanner/parser/relations/fingerprint/cold-start/memory store); bunx tsc --noEmit clean; bunx biome check clean. Full-suite run deferred to the post-BACK-703 gate per plan.
<!-- SECTION:NOTES:END -->

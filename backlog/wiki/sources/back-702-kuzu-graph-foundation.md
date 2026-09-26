---
title: BACK-702 Kuzu graph foundation — schema, fail-closed parser, fingerprint cold start
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - graph
  - kuzu
source_path: backlog/tasks/back-702 - Kuzu-graph-foundation-schema-fail-closed-parser-and-fingerprint-cold-start.md
---

# BACK-702 Kuzu graph foundation — schema, fail-closed parser, fingerprint cold start

Phase 1 of the doc-014 design: stand up a dependency graph over the backlog corpus. This task built the `src/graph/` module — schema, whitelist scanner, fail-closed relation resolution, batched import, and a fingerprint-based cold-start fast path that skips all parsing when nothing changed.

## Summary

- Schema per doc-014 §1.2: one `Task` node table (id, title, kind, status, filePath), three REL tables (`ParentOf`, `BelongsToMilestone`, `DependsOn`), and a `Meta` table; data files live under `backlog/` (`graph.kuzu` + `graph.kuzu.meta.json` sidecar)
- Whitelist scanner covers only `backlog/tasks`, `drafts`, `milestones`, `completed` — archive excluded, no `**/*.md` glob; per-file gray-matter parsing, files missing an id are skipped with a warning
- Fail-closed relations: dangling/ambiguous `parentTaskId`/`milestone`/dependency references produce `missingDependencies` / `ambiguousIds` / `invalidRelations` reports instead of being dropped; nodes always enter the graph; cross-kind `ParentOf` is legal, milestone hierarchy and non-task dependency targets are rejected
- Full import batch-inserts nodes (multi-value parameterized CREATE, chunked 100 rows; COPY FROM for rel tables), then builds all edges only after every node is placed
- Cold start: stat-only scan, reuse cached per-file hashes when size+mtime match, aggregate fingerprint = sha256(PARSER_VERSION + sorted relPath|hash); a match reuses the graph with zero parsing, a mismatch/corrupt cache rebuilds; PARSER_VERSION mixed in so parser upgrades force a rebuild
- Key decision: the kuzu 0.11.3 native binding SEGFAULTS under Bun 1.3.14 on Windows (the doc-014 §5 risk), so `GraphStore` is an abstraction with two backends — opt-in native `KuzuGraphStore` (`BACKLOG_GRAPH_BACKEND=kuzu`) and the default pure-JS `MemoryGraphStore` (the doc's degraded mode), with process singletons keyed by project root
- 18 tests in `src/test/graph-foundation.test.ts`; Kuzu SQL shapes validated end-to-end through a Node smoke run since Bun cannot load the binding

## Acceptance Criteria

- Schema DDL matches doc-014 §1.2; whitelist scan touches only the four directories
- Dangling/ambiguous references are reported and nodes still enter the graph
- Cold-start fast path is stat-only and reuses the graph on fingerprint match
- size+mtime compared together so `git checkout` of untouched files keeps the cache warm

## Related Concepts

- [[concepts/task-identity]] — canonical ids the fail-closed relation resolution keys on
- [[concepts/markdown-pipeline]] — gray-matter frontmatter parsing the scanner builds on

## Related Sources

- [[sources/back-599-gray-matter-no-cache-parse-wrapper]] — the no-cache gray-matter wrapper reused by the parser
- [[sources/back-596-fail-closed-document-decision-identity]] — earlier fail-closed identity precedent this graph mirrors
- [[sources/back-703-graph-incremental-sync]] — Phase 1 sync engine built directly on this foundation (same batch)

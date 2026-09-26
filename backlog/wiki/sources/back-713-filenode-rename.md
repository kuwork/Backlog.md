---
title: BACK-713 Rename graph node table Task(id) to FileNode(path PK)
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - graph
  - kuzu
  - refactor
source_path: backlog/tasks/back-713 - Rename-graph-node-table-Taskid-to-FileNodepath-PK.md
---

# BACK-713 Rename graph node table Task(id) to FileNode(path PK)

Design change per doc-014 §1.2: the graph node table becomes `FileNode(path PRIMARY KEY, id, type, title, status, updatedDate)` so the file path is the single node identity and the task ID is demoted to a property — file move/rename/archive collapse into one same-id migration operation.

## Summary

- Schema: `FileNode` with path PK; REL tables bind FileNode endpoints; `GraphNode.kind` → `type` plus `updatedDate`; unused `updateNodes`/`deleteNodesByFilePath` removed; every CRUD call and edge endpoint is the file path
- Two-phase import: parse everything to build the id→path map first, then create nodes by path and translate ID references into edges (fail-closed reporting preserved); same-id migration (rename, complete, demote, promote, archive) = delete old path + create new path + rebuild affected edges
- Self-describing schema versioning: `SCHEMA_VERSION` written into the graph's own `Meta` table; `init()` wipes and rebuilds a file recording any other version, and `clear()` drops the tables it finds via `CALL show_tables()` (rel tables first — a node table can't be dropped while referenced) instead of naming them — any future DDL change is a one-constant bump with no migration code and no list of retired table names
- Kuzu 0.11.3 behaviors measured, not assumed: `CREATE TABLE IF NOT EXISTS` silently no-ops on a stale file (leaving rel tables bound to old endpoints), `COPY` into such a table doesn't throw, `MATCH` on a missing Meta table throws Binder exception (hence a caught read)
- External API unchanged: `getPayload` translates paths back to task ids, so `/api/graph` and the web graph view needed zero frontend changes; `PARSER_VERSION` bumped to 2 so existing caches rebuild
- Verified by compiling `store.ts` for Node and driving the real store (Bun can't load the binding): pre-versioning file wiped to FileNode, current-version file reused intact, later-version file wiped, fresh file stamped; graph-foundation 30 pass, graph-sync 19 pass
- Known gap: `KuzuGraphStore` still has no automated test — the binding cannot load inside Bun and a test would need a real node binary

## Acceptance Criteria

- FileNode DDL with path PK; edges translate references through an id→path map; fail-closed reports preserved
- Same-id migrations for demote/promote/archive/rename covered by regression tests
- `/api/graph` and the web view unchanged; PARSER_VERSION bump rebuilds old caches

## Related Concepts

- [[concepts/task-identity]] — id vs path identity split this refactor settles inside the graph

## Related Sources

- [[sources/back-702-kuzu-graph-foundation]] — original Task(id) schema being renamed (same batch)
- [[sources/back-703-graph-incremental-sync]] — incremental engine adapted to path-keyed migration (same batch)
- [[sources/back-714-knowledge-graph-ingest]] — phase-3 ingestion built on the FileNode schema (same batch)

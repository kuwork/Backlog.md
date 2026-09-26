---
id: BACK-713
title: Rename graph node table Task(id) to FileNode(path PK)
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-26 06:27'
updated_date: '2026-09-26 07:33'
labels:
  - graph
  - refactor
dependencies: []
documentation:
  - backlog/docs/BRDS/doc-14 - Kuzu-任务图谱：冷启动校验与热更新设计.md
modified_files:
  - src/graph/store.ts
  - src/graph/fingerprint.ts
  - src/graph/parser.ts
  - src/graph/relations.ts
  - src/graph/import.ts
  - src/graph/incremental.ts
  - src/graph/service.ts
  - src/graph/validation.ts
  - src/test/graph-foundation.test.ts
  - src/test/graph-sync.test.ts
  - backlog/docs/BRDS/doc-014 - Kuzu-任务图谱：冷启动校验与热更新设计.md
priority: high
ordinal: 283400
actual_start: '2026-09-26 06:35'
actual_end: '2026-09-26 06:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design change (see backlog/docs/BRDS/doc-014 §1.2): the graph node table changes from Task(id PRIMARY KEY, kind, filePath) to FileNode(path PRIMARY KEY, id, type, title, status, updatedDate).

Motivation: stop maintaining two identities (id + filePath). The file path becomes the single identity of a node; the task ID is demoted to a property of task files. File move/rename/archive all collapse into one operation: same-id migration = delete old node, create new node, rebuild edges.

Scope note: this task still covers only the four task directories (tasks/drafts/milestones/completed). wiki/docs/decisions are phase-3 follow-up work (design in doc-15), but the schema must be built as FileNode now so the phase-3 type enum has room to grow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Schema DDL is CREATE NODE TABLE FileNode (path STRING PRIMARY KEY, id STRING, type STRING, title STRING, status STRING, updatedDate STRING); REL tables ParentOf/BelongsToMilestone/DependsOn bind FileNode endpoints
- [x] #2 Edge building first establishes an id->path map; dependencies/parentTaskId/milestone references are translated to path primary keys; unresolvable targets stay fail-closed and are recorded in missingDependencies/invalidRelations
- [x] #3 File move/rename/archive (including tasks->completed) uses same-id migration: delete old node, create new node, rebuild edges at end of batch; regression tests cover demote/promote/archive/rename scenarios
- [x] #4 External API (/api/graph and the web graph view) keeps task id as the node key; internal queries use FileNode (e.g. MATCH (n:FileNode {id: $id})); zero frontend changes
- [x] #5 PARSER_VERSION is bumped so existing graph.kuzu caches rebuild automatically; the existing behavior that graph.kuzu can always be deleted and rebuilt is preserved
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update src/graph/store.ts: switch DDL to the FileNode schema; all CRUD uses path as primary key (including DETACH DELETE by path and edge deletion by path); rename GraphNode.kind to type and add updatedDate
2. Update src/graph/import.ts and relations.ts: two-phase import — parse everything to build the id->path map first, then create nodes by path and translate ID references into edges; milestone matching by title stays unchanged
3. Update src/graph/incremental.ts and cold-start.ts: when applying change sets, compare ids between added/removed to detect same-id migrations (migration = delete old + create new + rebuild edges); bump PARSER_VERSION
4. Update src/graph/validation.ts: switch validation queries to FileNode; report structure unchanged
5. Check the graph endpoint in src/server/index.ts: confirm the returned JSON shape (id/type/status) is unchanged or add a mapping layer; src/web graph components must not change
6. Update and add tests: store CRUD, id->path edge resolution, same-id migration for demote/promote/archive/rename, fail-closed dangling dependencies; run scoped bun test + bunx tsc --noEmit + bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Schema version instead of a list of old table names

`backlog.kuzu` now describes its own schema. `SCHEMA_VERSION` and `SCHEMA_VERSION_KEY` sit next to
`SCHEMA_DDL` in `src/graph/store.ts`; `KuzuGraphStore.init` reads the version out of the file's own
`Meta` table and wipes + recreates when it does not match (`isCurrentSchema`). Any future DDL change
- a renamed table, an added column, a different primary key - is handled by bumping that one
constant: no migration code, and no list of retired table names to maintain.

Measured against kuzu 0.11.3 rather than assumed:

- `CREATE TABLE IF NOT EXISTS` is a silent no-op for a name that already exists, so a file from an
  older build keeps its old table *and* its relationship tables still bound to the old endpoints.
- `COPY` into such a stale rel table does not throw either; the rows land where nothing reads them.
- `CALL show_tables()` returns name + type (NODE/REL) and also works on an empty file, so the wipe
  enumerates the tables instead of naming them - which is what makes a rename safe.
- `DROP TABLE` refuses to drop a node table that a relationship table still references, so the rel
  tables have to go first.
- `MATCH (m:Meta ...)` throws "Binder exception: Table Meta does not exist" on a fresh file, hence
  the caught read in `readSchemaVersion`.

A file with no version row counts as stale. That one rule covers both a fresh file (nothing to drop)
and the pre-rename `Task(id)` file, which is now wiped by the same path as any other version change.

Verified end to end by compiling the module with `bun build src/graph/store.ts --target=node
--external kuzu` and driving the real store from Node, since Bun cannot load the binding: a
pre-versioning file is wiped to FileNode; a file at the current version is reused with its rows
intact; a file stamped with a later version is wiped and rebuilt; a fresh file is stamped.

Two versions, two questions: `SCHEMA_VERSION` covers the shape of the graph (the DDL),
`PARSER_VERSION` covers what a file parses into. A schema bump forces a rebuild through the existing
guards as well - the wiped store is empty, and both the cold start and the first service reconcile
require a non-empty store before they take the fast path.

Known gap: `KuzuGraphStore` still has no automated test, because it cannot be loaded from Bun and a
test would need a real `node` binary. `graph-foundation.test.ts` covers `isCurrentSchema` and the
memory store; the statement sequence itself is only covered by the manual run described above.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rename the graph node table from Task(id) to FileNode(path) and let the cache file state the schema it was built with.

Changes:
- store.ts: the DDL is now FileNode(path PRIMARY KEY, id, type, title, status, updatedDate) with ParentOf/BelongsToMilestone/DependsOn bound to FileNode; GraphNode.kind becomes type, plus updatedDate; the unused updateNodes/deleteNodesByFilePath are gone; every CRUD call and edge endpoint is the file path.
- Schema version: SCHEMA_VERSION and SCHEMA_VERSION_KEY sit next to the DDL and are written into the graph's own Meta table. init() wipes and rebuilds a file that records any other version, and clear() drops the tables it finds (CALL show_tables, rel tables first) instead of naming them - which is what makes a future table rename or column change a one-constant bump.
- relations/import/incremental/cold-start: frontmatter ids are resolved to paths once, then edges are created against paths; a same-id migration (rename, complete, demote, promote, archive) is delete-old-path + create-new-path + rebuild the affected edges.
- service.ts: getPayload translates paths back to task ids, so /api/graph and the web graph view are unchanged (no frontend edits).
- PARSER_VERSION is 2, so existing graph.kuzu caches rebuild.

Verification:
- bunx tsc --noEmit clean; biome check clean on the touched files.
- bun test src/test/graph-foundation.test.ts -> 30 pass; bun test src/test/graph-sync.test.ts -> 19 pass.
- The kuzu 0.11.3 upgrade path was driven through the real store under Node (bun build src/graph/store.ts --target=node --external kuzu): a pre-versioning file is wiped to FileNode with its old rel tables gone; a file at the current version is reused with its rows intact; a file stamped with a later version is wiped and rebuilt; a fresh file is stamped.
- Known gap: KuzuGraphStore still has no automated test (the binding cannot load inside Bun and a test would need a real node binary), so the statement sequence is covered by that manual run only.
<!-- SECTION:FINAL_SUMMARY:END -->

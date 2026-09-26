---
id: BACK-714
title: >-
  Ingest wiki/docs/decisions into the graph (FileNode types, tags, provenance,
  wikilinks)
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-26 06:36'
updated_date: '2026-09-26 17:02'
labels:
  - graph
  - wiki
milestone: m-9
dependencies:
  - BACK-713
documentation:
  - backlog/docs/BRDS/doc-15 - Wiki-知识图谱关系设计（doc-14-第三期）.md
  - backlog/docs/BRDS/doc-14 - Kuzu-任务图谱：冷启动校验与热更新设计.md
modified_files:
  - src/graph/store.ts
  - src/graph/scanner.ts
  - src/graph/parser.ts
  - src/graph/relations.ts
  - src/graph/validation.ts
  - src/graph/import.ts
  - src/graph/incremental.ts
  - src/graph/cold-start.ts
  - src/graph/service.ts
  - src/graph/fingerprint.ts
  - src/server/index.ts
  - src/test/graph-foundation.test.ts
  - src/test/graph-sync.test.ts
  - src/test/graph-knowledge.test.ts
  - src/web/App.tsx
  - src/web/lib/api.ts
  - src/web/components/GraphLegend.tsx
  - src/web/components/GraphView.tsx
  - src/web/components/TaskDependencyGraph.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/utils/task-subgraph.ts
  - src/web/utils/task-subgraph.test.ts
  - src/web/utils/graph-caption.ts
  - src/web/utils/graph-caption.test.ts
  - src/web/utils/graph-node-links.ts
  - src/web/utils/graph-node-links.test.ts
  - backlog/docs/BRDS/doc-14 - Kuzu-任务图谱：冷启动校验与热更新设计.md
  - backlog/docs/BRDS/doc-15 - Wiki-知识图谱关系设计（doc-14-第三期）.md
priority: medium
ordinal: 284400
actual_start: '2026-09-26 07:40'
actual_end: '2026-09-26 17:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase-3 implementation of the knowledge graph per backlog/docs/BRDS/doc-15 (this-term scope only). Extends the phase-1 graph (BACK-713's FileNode schema) with three new whitelisted directories: backlog/wiki/, backlog/decisions/, backlog/docs/.

Work items:

1. **Type**: FileNode.type enum extended with wiki/decision/document. The parser reads the explicit frontmatter 'type' and NEVER infers type from the folder — subfolders under wiki/ (sources/, concepts/, decisions/, ...) are navigation scope only, not types. Missing/invalid type is a validation error; the migration writes type into frontmatter for existing files.
2. **Tags**: Tag node table + TaggedWith edges, mechanically generated from frontmatter labels. No parallel 'tags' field.
3. **Provenance**: SourcedFrom edges from frontmatter source_path — task sources resolved via the FileNode.id property, knowledge sources via the path primary key. Unresolvable/ambiguous targets stay fail-closed and are reported.
4. **Links**: LinksTo edges mechanically parsed from body [[wikilink]] — resolved relative to the backlog/wiki/ root, alias form [[path|alias]] supported (path part only). Unresolvable targets are reported; unlinked mentions are NOT graph facts.
5. **Lint**: report missing/invalid type, unresolvable or ambiguous source_path, and wikilinks that do not resolve to a unique file.
6. **View**: graph view renders the new node types with TaggedWith/SourcedFrom/LinksTo edges and tag filtering.

Out of scope (deferred by design, do not implement): the frontmatter 'relations' field and all semantic edge tables (Supports/Mentions/Supersedes/ContentDependsOn/DerivedFrom/Contradicts/ReusableFor). The parser must ignore 'relations' silently if present.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Whitelist parser registered for backlog/wiki/, backlog/decisions/, backlog/docs/ producing FileNode rows whose node type comes from the whitelisted directory (wiki/decision/document); no frontmatter field and no subfolder name is read to decide a type, and the rule is covered by a test
- [x] #2 Tag node table exists; every labels entry produces a TaggedWith edge; no parallel 'tags' frontmatter field is introduced
- [x] #3 Every source_path produces a SourcedFrom edge: task sources matched by FileNode.id, knowledge sources by path; 0 or >1 candidates produce no edge and are reported (fail-closed)
- [x] #4 Body [[wikilink]] produces LinksTo edges: resolved relative to the wiki root, alias form takes the path part, 0 or >1 resolution candidates produce no edge and are reported
- [x] #5 Lint classifies every finding without silently dropping any: placeholder, non-md and out-of-whitelist targets and originals outside the corpus are informational, while an unresolvable corpus-internal source_path or an ambiguous wikilink is a defect. The four known source_path gaps of the current tree (doc-16 missing, draft-125/92/96 promoted) stay reported as known defects rather than being hidden or auto-repaired
- [x] #6 Graph view renders the new node types with TaggedWith/SourcedFrom/LinksTo edges and tag filtering; semantic edges are absent
- [x] #7 PARSER_VERSION is bumped for the new parsed fields (labels/source_path/wikilinks); SCHEMA_VERSION is bumped because the DDL changes (Tag node table); cold-start/hot-update flows reuse the existing fingerprint/notify machinery and the schema-version wipe guard, without changes to phase-1 semantics
- [x] #8 Two readings of the one payload: the task graph (/graph) and the task modal's relationship graph show only the phase-1/2 kinds, while the knowledge graph (/knowledge) shows only wiki/decision/document/tag. Hidden kinds are dropped before the force layout runs (not painted transparent afterwards), and the relationship subgraph never walks a TaggedWith/SourcedFrom/LinksTo edge
- [x] #9 Node captions name a node the way a reader recognises it: a knowledge page by its frontmatter title (falling back to its file name), a work file by its code name, a tag by the tag name without the payload's tag: prefix. The caption is trimmed by estimated width (CJK counted double) so every plate lands in the same band in any language, and the full title stays on hover; the rule lives in one shared, tested module
- [x] #10 Clicking a knowledge node opens its real page in a new tab - wiki via /wiki/*, document via /documentation/:id, decision via /decisions/:id - through one testable mapping from the node's path and id; a tag, or a knowledge page that carries no resolvable id (a folder readme), opens nothing rather than guessing an address
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read BACK-713's outcome first: FileNode(path PK, id, type, ...) is landed, and the cache file is self-describing — SCHEMA_VERSION in the Meta table wipes and rebuilds on mismatch, so any DDL change is a one-constant bump. Reuse the id->path resolution helper from src/graph/store.ts.
2. Extend src/graph/scanner.ts/parser.ts: whitelist the three directories; parse frontmatter type/labels/source_path and body wikilinks; add a parse stage that ignores 'relations'.
3. Extend src/graph/relations.ts: build TaggedWith (FileNode->Tag), SourcedFrom (resolve via id property or path PK), LinksTo (wikilink resolution with alias stripping); fail-closed reporting reuses the existing invalidRelations/unresolvedSources report shape.
4. Extend src/graph/store.ts DDL: add the Tag node table and bump SCHEMA_VERSION — no migration code needed; the version guard wipes stale files exactly like the Task->FileNode rename did. Migrate existing wiki files by writing explicit type into frontmatter (scripted one-off, report-only dry run first).
5. Extend src/graph/validation.ts with the new lint rules; run it against the real backlog/wiki tree and fix/report findings.
6. Update the web graph view (/graph and related components) for the new node colors/edges and tag filter.
7. Bump PARSER_VERSION (parsed fields changed) on top of the SCHEMA_VERSION bump; tests: parser type rules, tag edge generation, source_path resolution (task by id, knowledge by path, ambiguous, missing), wikilink resolution (alias, unresolvable), lint on a fixture tree; keep coverage on the memory store / pure logic, since the real KuzuGraphStore still has no automated test (binding cannot load inside Bun); run scoped bun test + bunx tsc --noEmit + bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Outcome

Phase 3 of the knowledge graph (doc-15). The graph ingests `backlog/wiki/`, `backlog/decisions/` and `backlog/docs/` into the same `FileNode` table as tasks, adds three mechanically derived relation tables, and reports findings without ever silently dropping one.

### What the graph holds

- **Node types come from the whitelisted directory**: `wiki/**` -> `wiki`, `docs/**` -> `document`, `decisions/**` -> `decision`. Frontmatter is never read for a type, and a subfolder (`wiki/sources/`, `wiki/concepts/`) never changes it. `wiki/index.md` and `wiki/log.md` are excluded at scan time.
- **Tag nodes** are generated from frontmatter `labels`; every label value produces a `TaggedWith` edge. No parallel `tags` field is introduced.
- **`SourcedFrom`** comes from frontmatter `source_path`: task sources are matched through the `FileNode.id` property, knowledge sources through the path. A corpus-internal reference resolving to 0 or more than 1 records produces no edge and is reported.
- **`LinksTo`** comes from body `[[wikilink]]`, resolved against the `wiki/` root and against the citing page; alias and heading parts are stripped. Only a unique hit becomes an edge. The frontmatter `relations` field is ignored by design.
- **Versions**: `SCHEMA_VERSION` 2 (the `Tag` node table plus `TaggedWith`/`SourcedFrom`/`LinksTo`; the self-describing Meta-table guard wipes and rebuilds a stale cache), `PARSER_VERSION` 3. Cold start, incremental sync, the core notify hook and the schema-version guard keep their phase-1 behaviour.

### What the UI shows

- **`/graph` - task graph** (the default reading): task, completed, draft and milestone nodes only.
- **`/knowledge` - knowledge graph**: wiki, decision, document and tag nodes only, reached from its own sidebar entry.
- Both read the same `/api/graph` payload and drop the hidden kinds **before** the force layout runs, so the layout is never squeezed by nodes nobody can see. The task details modal shows the same task-only set.
- **Knowledge nodes are labelled by their frontmatter title** (falling back to the file name), work nodes by their code name, tags by their tag name. Captions are trimmed by estimated width - CJK glyphs counted double - so every plate lands in the same band in any language; the full title stays on hover.
- **Clicking a knowledge node opens its real page in a new tab**: wiki via `/wiki/*`, document via `/documentation/:id`, decision via `/decisions/:id`. A tag, or a page with no resolvable id (a folder `readme.md`), opens nothing.
- `nav.graph` and the graph heading read "Task Graph"; the new entry is `nav.knowledgeGraph`. All four locales are updated.

### Verification

- `bunx tsc --noEmit`, `bun run check .` and the scoped suites pass: graph-foundation 30, graph-sync 19, graph-knowledge 17, graph-caption 8, graph-node-links 5, task-subgraph 9.
- Real corpus (1155 files / 1131 nodes / 216 tags): `TaggedWith` 2048, `LinksTo` 1155, `SourcedFrom` 187, phase-1 edges 132. Task graph view: 755 nodes / 132 edges. Knowledge graph view: 592 nodes / 2251 edges. `/api/graph` payload has no edge with a missing endpoint; `unresolvedLinks` is 0; 374 of 376 knowledge nodes resolve to a page.

### Reported, not repaired

- Four `source_path` gaps stay visible as lint defects: `doc-16` no longer exists, and `draft-125` / `draft-92` / `draft-96` were promoted to tasks, so their ids no longer match.
- 21 `completed/*.md` files fail to parse (`assignee: @MrLesk` unquoted) and are skipped by the importer; `drafts/readme.md`, `milestones/readme.md` and `tasks/readme.md` carry no id. Both predate this task.
<!-- SECTION:NOTES:END -->

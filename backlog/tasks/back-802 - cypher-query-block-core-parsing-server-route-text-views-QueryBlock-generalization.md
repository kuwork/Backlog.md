---
id: BACK-802
title: >-
  cypher-query block core: parsing + server route + text views + QueryBlock
  generalization
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-16 15:42'
updated_date: '2026-10-17 15:02'
labels:
  - web-ui
milestone: m-15
dependencies: []
references:
  - 'src/sqlite/block.ts:46'
  - 'src/graph/store.ts:847-876'
  - 'src/server/index.ts:3138-3167'
  - 'src/web/components/MermaidMarkdown.tsx:422'
  - src/web/components/SqlQueryBlock.tsx
documentation:
  - backlog/docs/PRDS/cypher/doc-27 - Cypher-Live-Query：只读图查询块与可配置样式.md
modified_files:
  - src/graph/block.ts
  - src/graph/coerce.ts
  - src/graph/store.ts
  - src/server/index.ts
  - src/sqlite/block.ts
  - src/web/components/CypherQueryBlock.tsx
  - src/web/components/DuckdbQueryBlock.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/SqlQueryBlock.tsx
  - src/web/components/SqliteQueryBlock.tsx
  - src/web/lib/api.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/cypher-query-block.test.tsx
  - src/test/graph-block.test.ts
  - src/test/graph-coerce.test.ts
  - src/test/server-cypher-query-endpoint.test.ts
ordinal: 364001
actual_start: '2026-10-16 16:17'
actual_end: '2026-10-16 23:50'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
sqlite-query/duckdb-query fenced blocks already run live SQL in document reading views; the Cypher backend (runCypher read-only gate, row caps) exists but cannot be embedded in documents. This task delivers the minimal cypher-query loop: block parsing, server query route, table/list/value text views, and generalizing SqlQueryBlock into an engine-agnostic QueryBlock shared by all three engines. Design basis: doc-27 sections 0-6 (graph view, refresh:auto and the style field are follow-up tasks).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reading view renders cypher-query blocks with correct table/list/value output; edit mode shows raw source
- [x] #2 source resolves by registered database name; unregistered names and path-shaped values are rejected with a readable in-block error listing available databases
- [x] #3 Write Cypher (CREATE/MERGE/DELETE/SET/DROP/UPDATE) is rejected by runCypher and shown in-block; a regression test covers the validation-passed-but-write-attempted path
- [x] #4 Results are truncated at the configured queryMaxRows limit with an in-block notice; truncated is passed through to the frontend; node/relationship/path values render in the compact format of doc-27 section 5.4
- [x] #5 Show/Hide Query is collapsed by default and does not trigger a query; Copy Markdown emits a GFM table; Export CSV sends exactly { source, query }
- [x] #6 sqlite-query and duckdb-query blocks remain byte-identical in behavior; the shared-component refactor stays behind thin wrappers
- [x] #7 queryMaxRows config key applies to cypher blocks (default 500, hard clamp 5000) and hot-reloads via config-updated; pagination is intentionally not offered for cypher (PRD doc-27 section 5.3)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Block parsing: reuse parseQueryBlock in src/sqlite/block.ts; support query (Cypher) and sql (SQL) as the statement field, parameterizing the field name whichever way is smaller.
2. Server: decide between reusing POST /api/graph/db-cypher vs a new /api/graph/cypher-query based on which aligns the response shape with the SQL blocks { columns, rows, truncated, elapsedMs } (doc-27 section 5.1); add POST /api/graph/export-csv (strict two-key { source, query }). source validation = must match a registry.json database name; reject every path-shaped value.
3. Type coercion: convert node/relationship/path to compact strings per doc-27 section 5.4, stripping _id/_src/_dst; unit tests for each type and for truncation.
4. QueryBlock generalization: extract SqlQueryBlock.tsx into an engine-agnostic core; extend QueryEngineConfig with the view-set difference; convert SqliteQueryBlock/DuckdbQueryBlock to thin shells and run existing tests to confirm zero regression.
5. Frontend mount: add language-cypher-query dispatch to the MermaidMarkdown.tsx fence chain, mounting a CypherQueryBlock thin shell (engine id / i18n namespace / api methods / action buttons).
6. Component state machine loading/ready/error/empty with explicit copy for error and empty states.
7. Acceptance: bunx tsc --noEmit, bun run check ., related tests green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. New: src/graph/block.ts (parseCypherQueryBlock, statement field 'query'), src/graph/coerce.ts (node/rel/path compact coercion), CypherQueryBlock.tsx thin shell, 4 test files (42 tests green). Modified: parseQueryBlock parameterized statement field (SQL messages byte-identical), server routes POST /api/graph/cypher-query + /api/graph/export-csv with registry-name source validation, QueryEngineConfig extended with parse/actions.pagination extension points, MermaidMarkdown dispatch, api.ts client, 4-locale i18n. Decisions: new route instead of reusing db-cypher (response shape mismatch); zero new row-cap constants (queryMaxRows config, fallback DEFAULT_CYPHER_ROW_CAP); no pagination for cypher (PRD 5.3) - AC 6 rewritten accordingly. SQL blocks: 27 pre-existing tests pass unmodified. tsc + biome green. Full bun test running in background.
Known follow-ups: loadRyu module-cache race on concurrent first call (pre-existing, worth its own task); parser 'source' error copy still says 'path' for cypher blocks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
cypher-query live block core: fenced blocks execute read-only Cypher against registered graph databases in the Web UI reading view, rendered via the shared QueryBlock core with table/list/value views. Server adds /api/graph/cypher-query (registry-name source validation, queryMaxRows-configured truncation) and /api/graph/export-csv (strict two-key). node/relationship/path values coerce to compact strings per PRD 5.4. parseQueryBlock statement field parameterized; SqliteQueryBlock/DuckdbQueryBlock behavior byte-identical (27 existing tests untouched and green). 42 new tests green; tsc and biome clean. graph view, refresh:auto and style field intentionally left to BACK-803/804/805.
<!-- SECTION:FINAL_SUMMARY:END -->

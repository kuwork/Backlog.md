---
id: BACK-806
title: 'Graph legend persistence: server storage + /api/graph/legend endpoints'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-17 02:45'
updated_date: '2026-10-17 15:05'
labels:
  - docs
milestone: m-16
dependencies: []
documentation:
  - backlog/docs/PRDS/cypher/doc-29 - Graph-Legend-配置持久化：项目级存储与启动恢复.md
modified_files:
  - src/graph/legend-store.ts
  - src/graph/legend-updated.ts
  - src/server/index.ts
  - src/test/server-graph-legend-endpoint.test.ts
  - package.json
  - bun.lock
  - backlog/docs/PRDS/cypher/doc-29 - Graph-Legend-配置持久化：项目级存储与启动恢复.md
  - backlog/milestones/m-16 - graph-legend-persistence.md
priority: medium
ordinal: 368001
actual_start: '2026-10-17 03:18'
actual_end: '2026-10-17 03:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PRD: doc-29. Persist per-database graph legend configs in backlog/databases/graph-legends.yaml (single file, database name -> config map), served over two new endpoints. The file is block-style YAML with LF endings so it versions cleanly and stays hand-editable; deep validation stays client-side in normalizeLegendConfig.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/graph/legend?database=X returns the stored config JSON for that database, 204 when none exists
- [x] #2 PUT /api/graph/legend with {database, config} writes atomically (temp file + rename) to backlog/databases/graph-legends.yaml; config: null removes that database's entry
- [x] #3 PUT rejects a non-plain-object config with 400 and leaves the file untouched
- [x] #4 A successful PUT broadcasts graph-legend-updated over the existing WS channel with the database name in the payload
- [x] #5 The stored file is block-style YAML with LF endings and round-trips through git
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a small store module (src/graph/legend-store.ts): load/save/reset against backlog/databases/graph-legends.yaml, atomic write via temp file + rename, tolerant read (missing or corrupt file = empty map).
2. Wire GET/PUT /api/graph/legend in src/server/index.ts beside the other graph routes; broadcast through the existing WS helper used for config updates.
3. Tests in src/test/server-graph-legend-endpoint.test.ts: round-trip, 204, 400 on non-object, reset via null, broadcast payload.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented src/graph/legend-store.ts (load/save/reset, atomic write, tolerant read), src/graph/legend-updated.ts (graph-legend-updated broadcast payload codec), the server routes GET/PUT /api/graph/legend with their two handlers, and added integration tests in src/test/server-graph-legend-endpoint.test.ts (round-trip / 204 / 400 / reset / broadcast - all 7 green). tsc and biome pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
BACK-806 delivered the server side of legend config persistence. Added src/graph/legend-store.ts (database -> config map in backlog/databases/graph-legends.yaml, atomic write + tolerant read) and src/graph/legend-updated.ts (graph-legend-updated broadcast codec, modelled on graph/updated.ts). The server mounts GET /api/graph/legend (returns the config / 204 when none / 400 when the database parameter is missing) and PUT /api/graph/legend (validates a plain object, otherwise 400 without touching the file; config:null removes that database's entry; on success broadcasts graph-legend-updated with the database over the existing WS channel). The 7 integration tests are green; tsc --noEmit and biome check pass.
<!-- SECTION:FINAL_SUMMARY:END -->

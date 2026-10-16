---
id: m-15
title: Cypher Live Query
created_date: '2026-10-16 15:41'
updated_date: '2026-10-17 00:09'
actual_start: '2026-10-16 16:17'
actual_end: '2026-10-17 00:09'
documentation:
  - backlog/docs/PRDS/cypher/doc-27 - Cypher-Live-Query：只读图查询块与可配置样式.md
---
## Description

cypher-query fenced blocks: execute read-only Cypher queries live in any document's reading view, with table/list/value/graph views, graph-updated auto-refresh, and per-block style presets. Design basis: doc-27 (PRDS/cypher). Row limits come from the queryMaxRows config key, not hardcoded constants.

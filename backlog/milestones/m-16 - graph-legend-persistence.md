---
id: m-16
title: graph-legend-persistence
created_date: '2026-10-17 02:44'
updated_date: '2026-10-17 13:13'
actual_start: '2026-10-17 03:18'
actual_end: '2026-10-17 13:08'
documentation:
  - backlog/docs/PRDS/cypher/doc-29 - Graph-Legend-配置持久化：项目级存储与启动恢复.md
---
## Description

Persist graph legend configs (per-type colors, captions, rules, line styles) to a version-controlled project file instead of browser localStorage: server storage + /api/graph/legend endpoints, browser boot restore with localStorage migration and write-through saves, and CLI graph legend get/set/reset. PRD: doc-29.

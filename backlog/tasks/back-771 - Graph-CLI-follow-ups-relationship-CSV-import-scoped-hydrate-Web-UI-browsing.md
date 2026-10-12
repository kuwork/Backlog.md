---
id: BACK-771
title: 'Graph CLI follow-ups: relationship CSV import, scoped hydrate, Web UI browsing'
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-12 15:25'
updated_date: '2026-10-12 15:26'
labels:
  - cli
  - graph
dependencies:
  - BACK-769
ordinal: 331001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three independent follow-ups deliberately kept out of BACK-769 (multi-database core). Each is shippable on its own; none is required for that core to be useful.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Relationship CSV import: import <db> <csv> --rel KNOWS --from <col> --to <col> creates edges by matching both endpoint keys, reusing the node importer's CSV reader.
- [ ] #2 Scoped hydrate: a cold open loads only the tables a query references, falling back to a full hydrate whenever that cannot be determined.
- [ ] #3 Web UI read-only browsing of user databases (list plus a Cypher box scoped to a database); the front end needs a generic renderer because it currently assumes the FileNode corpus schema.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an edge mode to csv-import.ts (MATCH both endpoints, then CREATE the relationship).
2. Store per-table fingerprints and extract referenced labels for scoped hydrate, always fail-safe to a full hydrate.
3. Add a server API to list user databases and query one, plus a generic result renderer; keep it read-only.
<!-- SECTION:PLAN:END -->

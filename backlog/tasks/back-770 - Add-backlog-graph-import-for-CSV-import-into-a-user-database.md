---
id: BACK-770
title: Add backlog graph import for CSV import into a user database
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-12 15:23'
updated_date: '2026-10-12 15:24'
labels:
  - cli
  - graph
dependencies:
  - BACK-769
ordinal: 330001
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Load rows from a CSV file into a user database. ryu COPY FROM silently imports zero rows under the WASM build (BACK-766), so the file must be read with node fs and inserted with batched parameterised UNWIND; the target table is auto-created with inferred types when absent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 import <db> <csv> [--node T] [--header] [--map a=b,...] loads rows into a user database and persists the snapshot.
- [ ] #2 Rows go in via batched parameterised UNWIND; ryu COPY FROM is never used.
- [ ] #3 A missing target table is auto-created with inferred column types (INT64 / DOUBLE / BOOLEAN / STRING).
- [ ] #4 A malformed file fails with a clear message and leaves the database unchanged.
- [ ] #5 tsc, biome and the graph suites stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/graph/csv-import.ts: node fs read, header handling, --map, type inference.
2. Insert in batches, reusing the BACK-769 write path and snapshot persistence.
3. Register the import subcommand; document it in graph.md.
4. Tests: round-trip, header/map variant, malformed file.
<!-- SECTION:PLAN:END -->

---
id: BACK-772
title: >-
  Reuse a derived-graph snapshot instead of rebuilding the corpus on every CLI
  run
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-12 15:27'
updated_date: '2026-10-12 15:32'
labels:
  - cli
  - graph
dependencies:
  - BACK-769
modified_files:
  - src/graph/reconcile-once.ts
  - src/graph/fingerprint.ts
  - src/cli.ts
  - src/test/graph-reconcile-once.test.ts
ordinal: 332001
actual_start: '2026-10-12 13:33'
actual_end: '2026-10-12 15:32'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The derived default graph is rebuilt from the markdown corpus on every CLI run (~6.0s here) because ryu's WASM build keeps the graph in memory and never writes it to disk (BACK-767). Persist it as a JSON snapshot in the OS cache directory - it is a cache of the corpus, not user data - and restore it when the corpus fingerprint is unchanged, so the CLI stops paying the markdown parse on every command. Measured here: rebuild 5985ms vs hydrate 1133ms for a 1039KB snapshot of 1569 nodes / 4600 edges.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A cold CLI run whose corpus fingerprint, PARSER_VERSION and graph SCHEMA_VERSION all match the recorded snapshot restores the graph from the snapshot instead of re-parsing the corpus.
- [x] #2 The snapshot lives next to the default database in the OS cache directory (it is a cache of the corpus, not user data) and is written after every full build.
- [x] #3 Any mismatch - corpus fingerprint, parser version, schema version, missing or unreadable snapshot - falls back to a full rebuild; the store is never left empty or stale.
- [x] #4 Verified end to end: a separate process reads the same node and edge counts as a rebuild, and the derived build step drops from ~6.0s to ~1.1s.
- [x] #5 tsc, biome and the graph suites stay green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the meta cache with the snapshot's content hash and the graph schema version, tying a snapshot to the exact corpus state that produced it.
2. Add a reuseSnapshot path to reconcileGraphStoreOnce: a fingerprint match hydrates, otherwise a full build followed by a dump - and never do nothing, which is what made forceBuild necessary in BACK-767.
3. Switch the CLI's derived branch from forceBuild to reuseSnapshot.
4. Tests: a fresh store hydrates from the snapshot; a changed corpus rebuilds; a corrupt snapshot rebuilds.
5. Gates plus a live before/after measurement.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What was added
- MetaCache gained snapshotFingerprint and graphSchemaVersion, tying a snapshot to the exact corpus state that produced it (loadMetaCache rebuilds its object field by field, so both had to be carried through explicitly).
- reconcileGraphStoreOnce gained reuseSnapshot: on a match it hydrates, otherwise it does a full build and writes a fresh snapshot. Unlike the old fingerprint path it never does nothing - skipping the load is exactly what made forceBuild necessary in BACK-767.
- derivedSnapshotPath(paths) = <dbPath>.graph.json, i.e. beside the default database in the OS cache directory. It is a cache of the corpus, so it is never written into the repository and deleting it only costs one rebuild.
### Fail-safe direction
Seven checks must all pass before a snapshot is served: the meta cache exists; the backend matches; PARSER_VERSION matches; the aggregate corpus fingerprint matches; the graph SCHEMA_VERSION matches; a snapshot hash is recorded; and the file on disk still hashes to it. Any failure - including an unreadable snapshot or a hydrate error - falls through to a full rebuild.
### Measured in this repo
Build + dump 11042ms -> hydrate 5166-5663ms. Identical results: FileNode 1390, ParentOf 44. Snapshot 1066051 bytes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The CLI no longer re-parses the markdown corpus on every command. A cold run whose corpus fingerprint, parser version and schema version all still match the recorded snapshot hydrates the derived graph from a JSON snapshot kept beside its database in the OS cache directory; anything else rebuilds and rewrites it. Measured here: 11042ms for the rebuilding run versus 5166-5663ms for hydrating runs, with identical query results. The fail-safe direction is always rebuild - an unrecognised, mismatched, replaced or unreadable snapshot is never served.

Delivered: src/graph/fingerprint.ts (the meta cache carries the snapshot hash and graph schema version); src/graph/reconcile-once.ts (reuseSnapshot, derivedSnapshotPath, hydrateFromSnapshot, persistSnapshot); src/cli.ts (the derived branch switches from forceBuild to reuseSnapshot); three tests (cold hydrate, changed corpus rebuilds, corrupt snapshot rebuilds).

Gates: tsc clean; biome clean; 7 reconcile-once tests plus the graph suites pass.
<!-- SECTION:FINAL_SUMMARY:END -->

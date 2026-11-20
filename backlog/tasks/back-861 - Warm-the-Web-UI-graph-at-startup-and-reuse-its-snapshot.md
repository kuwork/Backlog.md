---
id: BACK-861
title: Warm the Web UI graph at startup and reuse its snapshot
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-19 17:25'
updated_date: '2026-11-20 02:36'
labels:
  - graph
  - web
  - performance
dependencies: []
references:
  - 'src/server/index.ts:809-821'
  - 'src/graph/service.ts:170-210'
  - 'src/graph/reconcile-once.ts:79-92'
modified_files:
  - src/graph/fingerprint.ts
  - src/graph/reconcile-once.ts
  - src/graph/service.ts
  - src/server/index.ts
  - src/test/graph-sync.test.ts
ordinal: 420004
actual_start: '2026-11-19 17:26'
actual_end: '2026-11-20 02:36'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task and knowledge graph pages share one GraphService, but the Web server starts it only on the first /api/graph request, so the first visit pays the full RyuGraph WASM build. BACK-843 made that lazy deliberately to protect first paint; BACK-772 later added a verified JSON snapshot for CLI/MCP processes, but the Web slot neither hydrates nor writes one. Warm the graph in the background after the content services are ready and reuse the existing fail-closed snapshot mechanism for the Web slot, keeping the startup path non-blocking.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After the Web content services become ready, the server starts the same memoized GraphService attempt in the background without awaiting it on the bind or first-paint path; /api/graph and both graph pages share that attempt and its existing started/ready broadcasts.
- [x] #2 A Web-slot full build writes the derived-graph JSON snapshot and snapshot metadata beside that slot's fingerprint sidecar, and subsequent incremental graph syncs refresh the snapshot without writing it when the graph did not change.
- [x] #3 A new Web process whose corpus fingerprint, parser version, graph schema version and snapshot hash all match hydrates instead of re-parsing the markdown corpus and serves the same graph counts and payload as a full build.
- [x] #4 A missing, mismatched, replaced or unreadable snapshot falls back to the existing full rebuild and rewrites the cache; the graph is never served empty or stale.
- [x] #5 Targeted tests cover background warm-up scheduling, cold snapshot hydration, fallback and snapshot refresh; tsc, Biome and the scoped suites pass.
- [x] #6 A live run on this repository records services-ready and graph-ready timings for cold and warm starts, confirms the graph endpoints stay responsive during preparation, and leaves a running server for manual task/knowledge graph verification.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Share the existing derived-snapshot validation and persistence helpers so the long-lived GraphService can use the same fail-closed rules as the CLI without duplicating them.
2. On the initial reconcile, hydrate a valid Web-slot snapshot instead of re-parsing; after a full or incremental graph change, dump and stamp the snapshot, leaving it untouched on a no-change reconcile.
3. After ensureServicesReady resolves, kick the memoized graph-service attempt without awaiting it, preserving the existing broadcasts and request behavior.
4. Add focused service/server tests, then run tsc, Biome and scoped suites.
5. Measure cold and warm live starts, check graph APIs during preparation, and leave a browser server running for user verification. Do not commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented background warm-up after services readiness and reused the CLI snapshot helpers in GraphService. Web snapshot metadata also carries ParseReports so hydration preserves the complete payload, including missing-dependency findings. Older snapshots without reports deliberately rebuild once.

Validation: bunx tsc --noEmit passed; bun run check . passed (14 pre-existing warnings and 1 pre-existing info); 127 graph-related tests passed, including new hydration, corrupt fallback, incremental refresh, unchanged no-write and non-blocking warm-up scheduling tests.

Live on this repository, port 6430: cold services ready 1675ms, graph ready including initial snapshot dump 5859ms; warm services ready 1481ms, graph ready 3240ms. Warm start left the snapshot/meta mtimes unchanged, proving hydration rather than a rebuild. Both starts returned 973 nodes and 260 edges; warm returned all 78 missing-dependency reports. /graph and /knowledge both returned HTTP 200. A separate cold probe kept /api/config responsive while the graph request was in flight (12 samples, average 508.1ms, max 3496ms), confirming the expected main-thread jank rather than a startup deadlock. Final warm server remains running at http://localhost:6430 for user acceptance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Warm the shared task/knowledge GraphService in the background after content and search become ready, without awaiting it on the boot path. Reuse the BACK-772 derived snapshot for Web slots: valid snapshots hydrate on a cold process, changed graphs dump a fresh snapshot, and invalid/missing snapshots fail closed to a full rebuild. Persist parser/relation reports alongside the snapshot so hydrated Web payloads retain all findings.

Verification: TypeScript, Biome and 127 scoped tests pass. Live cold/warm graph preparation measured 5859ms -> 3240ms on this repository; the warm snapshot was not rewritten and graph payloads matched. Server left at http://localhost:6430 for manual verification. No git commit created.
<!-- SECTION:FINAL_SUMMARY:END -->

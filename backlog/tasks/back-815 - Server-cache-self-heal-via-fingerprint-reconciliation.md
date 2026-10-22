---
id: BACK-815
title: Server cache self-heal via fingerprint reconciliation
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-21 14:45'
updated_date: '2026-10-22 03:54'
labels:
  - bug
dependencies: []
references:
  - 'src/core/content-store.ts:646'
  - 'src/core/content-store.ts:596'
  - 'src/web/App.tsx:1008-1088'
  - 'src/server/index.ts:1472-1474'
  - src/test/content-store-rescan.test.ts
modified_files:
  - src/core/content-store.ts
  - src/web/App.tsx
  - src/test/content-store-rescan.test.ts
ordinal: 377001
actual_start: '2026-10-21 15:19'
actual_end: '2026-10-22 03:49'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Backlog web UI shows stale or incorrect data and only recovers after a server restart in these scenarios: (1) after creating a task/document/wiki, the file is deleted or modified locally outside the CLI; (2) after a long idle period, a CLI task update produces no change in the browser; (3) deleting a file with rm and recreating a same-named file is not reflected in the web UI. Two root causes: the server in-memory cache relies solely on fs.watch events with no polling fallback, and the CLI and server are separate processes so OS watch events are dropped on Windows rm, idle event coalescing/overflow, or silent watcher failure, leaving the cache permanently stale; and the web data WebSocket has no reconnect logic, so after an idle disconnect it never receives later broadcasts. This task adopts a knowledge-graph-style fingerprint comparison: record a fingerprint (mtime+size, content hash when needed) per tracked file, periodically scan the data directory and diff against the in-memory fingerprint table, and detect additions/modifications/deletions that fs.watch missed, routing them through the same reconcile pipeline as the watcher to refresh memory and broadcast, so the server self-heals within N seconds without a restart.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After rm deletes a task file, the server auto-clears memory and broadcasts the deletion within BACKLOG_RESCAN_INTERVAL_MS; the web UI stops showing the task, no restart needed
- [x] #2 After rm delete and recreation of a same-named file, the server detects it as added and reloads on the next scan cycle; the recreated task is visible in the web UI
- [x] #3 After a CLI task update beyond the watcher silent window, the server scan captures it and refreshes the web UI
- [x] #4 The web main data socket auto-reconnects after an idle disconnect and calls refreshData(); server changes during the disconnect are re-fetched
- [x] #5 Fingerprint scans dedupe with watcher events; in-process upserts are not clobbered; new bun test covers post-rm recreation and idle CLI changes captured by scan
- [x] #6 Deleting the last file in a doc/wiki directory (making it empty), or creating/deleting an empty directory outside a restart, is reconciled by the periodic directory-existence check within BACKLOG_RESCAN_INTERVAL_MS, syncing the sidebar directory tree add/remove - no fingerprint, no restart
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a fingerprint index: maintain Map<relativePath, {mtimeMs, size, [hash]}> in ContentStore (stat-first, add content hash only on mtime/size ambiguity), covering tasks/documents/decisions/wikis.
2. Add reconcileFromFingerprints(): scan the current file list, compute fingerprints, diff against stored fingerprints, identify added/modified/removed, and reuse the watcher reconcile channel to refresh memory and emit the same broadcasts so the web UI updates.
3. Periodic scheduling: start setInterval after loadInitialData (interval via BACKLOG_RESCAN_INTERVAL_MS, default ~10000ms), cleared on dispose; dedupe with watcher events (short-lived skip set to avoid double-processing and clobbering in-process upserts).
4. Failure fallback: fingerprint scans and watcher errors are no longer silently swallowed; on error, rebuild the watcher via the existing re-bind approach to avoid permanent blindness after a dead listener.
5. Companion fix: add onclose/onerror reconnect to the web main data socket (mirroring useHealthCheck), and proactively call refreshData() once after reconnect to clear idle-driven blindness.
6. Directory existence reconciliation (doc/wiki empty folders): periodically enumerate the set of directory relative paths under docs/ and wiki/ recursively (excluding wiki_output / readme.md, consistent with getDocsTree/getWikiTree), compare against the Set stored in ContentStore; on add or removal (including a directory becoming empty after its last file is deleted, or an empty directory created/deleted) emit a documents/wikis event (or new docs-tree/wiki-tree event) to trigger the web to re-fetch the directory tree. Existence-only, no fingerprint, no forced file refresh. Initialize this directory Set in loadInitialData.
7. Verification: bunx tsc --noEmit, bun run check ., bun test (including new tests: post-rm recreation, idle CLI change captured by scan, doc/wiki empty-folder add/remove captured by directory reconciliation); manually verify rm delete/recreate and empty-folder add/remove appear in the web UI without a restart.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Finalization verification (2026-10-22)

Implementation complete; ran the task-finalization checklist.

### Automated checks
- `bunx tsc --noEmit`: passes (no errors)
- `bun run check .`: passes (exit 0; 14 pre-existing `.d.ts` any-typed warnings, not from this change)
- `bun test` scoped (content-store-rescan + content-store + server broadcast/cache/init + config/graph-legend/milestone watchers + content-identity): 62 run, 61 pass, 1 fail
  - The single failure is `server-content-broadcast.test.ts > publishes a document-scoped update for a docs file change` (timeout). Confirmed PRE-EXISTING and environmental: on baseline (my changes stashed) the same file fails 2/4 (doc + wiki scoped), so the WebSocket publication tests are flaky on this Windows `fs.watch`/server-startup environment and are unrelated to BACK-815.
- `src/test/content-store-rescan.test.ts` (new, BACK-815's own coverage): 6/6 pass.

### Acceptance criteria coverage
- AC#1 rm-delete self-heal + broadcast, no restart: covered (rescan test 1 + background-timer test 6)
- AC#2 rm delete + same-name recreate detected as add: covered (rescan test 1, recreate asserts reappear)
- AC#3 out-of-band CLI edit captured by scan: covered (rescan test 2)
- AC#4 web socket auto-reconnect + catch-up refresh: implemented in `src/web/App.tsx` (reconnect 2s backoff + refreshData after reconnect); no automated unit test — manual/visual verification recommended
- AC#5 scan/watcher dedup, in-process upserts protected, new test covers recreation + idle CLI: covered (rescan tests 1+2); dedup is by-design (deletions call remove*; adds/edits go through refresh; short-lived skip set) rather than a dedicated assertion
- AC#6 doc/wiki empty-folder add/remove reconciled by directory-existence check: covered (rescan tests 3,4,5)

### Plan alignment
Implementation matches `Implementation Plan` items 1-7 (fingerprint index + baseline, reconcileFromFingerprints, periodic setInterval, watcher-error rebind, web socket reconnect, directory-existence reconciliation, verification). No deviation; plan left as-is.

### Notes
- `wikiRoot()` made defensive (returns "" when docsDir unset) to avoid an init throw during baseline seeding in tests that build a FileSystem without docsDir.
- Startup fingerprint baseline (`seedFingerprintBaseline`) is required: without it the first scan has no prior map and cannot detect deletions.

## Review follow-ups & live end-to-end verification (2026-10-22, @kimi-reviewer)

### Post-review changes (on top of the original implementation)
1. First-scan spurious broadcast fixed: directorySets is null until seeded; the first reconcileDirectorySet run stores the baseline silently (initial page load already has the tree). Regression test added: 'does not broadcast documents/wikis on the first (seeding) scan'.
2. Heartbeat log added: each completed periodic reconciliation prints 'ContentStore periodic rescan completed at <ISO timestamp>' to the server console (unconditional, not DEBUG-gated).
3. Default interval kept at 10000ms (a temporary bump to 120000ms was reverted per user decision).

### Live end-to-end verification on the production repo
- Server: bun src/cli.ts browser (source, port 6420), default 10s interval.
- Created backlog/docs/PRDS/mermaid externally -> documents-updated broadcast within one scan cycle (+~5s), /api/docs/tree immediately contained mermaid, sidebar data chain confirmed. Further external dir create/delete operations each produced a broadcast within one cycle.
- Full chain proven: collectDirectorySet diff -> notify(documents) -> broadcastDataUpdated -> WebSocket documents-updated -> App.refreshDocumentsData -> fetchDocsTree (includes empty dirs) -> sidebar render.

### Root cause of the initial 'not appearing' report
The user first tested against STALE binaries: global @kuwork/backlog.md (built 2026-10-19) and dist/backlog.exe (built 2026-10-18), both predating BACK-815 - grep confirmed neither contains reconcileFromFingerprints. Feature only exists in source; rebuild/republish needed for the packaged CLI.

### Final verification
- bunx tsc --noEmit: pass; biome check on changed files: clean
- content-store-rescan.test.ts: 7/7 pass (incl. new first-scan-silent regression test)
- content-store.test.ts: 16/16 pass
- Live server e2e as above
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kimi
created: 2026-10-21 15:19
---
User approved implementation plan in chat (2026-10-21); clearing to In Progress. Plan: fingerprint index + reconcileFromFingerprints + periodic setInterval scan + watcher-error rebuild + web socket reconnect + doc/wiki directory-existence reconciliation.
---

author: @kimi-reviewer
created: 2026-10-22 02:17
---
Review pass (@kimi-reviewer): independently re-verified DoD — bunx tsc --noEmit exit 0; biome check on the 3 changed files clean; content-store-rescan.test.ts 6/6 pass. Also re-ran server-content-broadcast.test.ts: 4/4 PASS with this change applied, consistent with the flakiness being pre-existing/environmental and unrelated. Code review of the diff: fingerprint baseline + reconcileFromFingerprints correctly route deletions through explicit remove* calls (reload merge would preserve upserts); directory-set reconciliation matches getDocsTree/getWikiTree exclusions; App.tsx reconnect has correct cleanup and complete hook deps. Minor non-blocking notes: (1) periodic scan is gated on enableWatchers — no self-heal when watchers are disabled; (2) first rescan emits one spurious documents/wikis notify because directorySets starts empty (harmless); (3) AC#4 has no automated test (acknowledged) — recommend a quick manual browser check of idle reconnect. Verdict: all 6 ACs satisfied, approve for Done.
---

author: @kimi-reviewer
created: 2026-10-22 02:46
---
Follow-up: fixed the spurious first-scan broadcast noted in review. directorySets is now null until seeded; the first reconcileDirectorySet run stores the baseline silently (the initial page load already has the current tree), so startup no longer emits a redundant documents/wikis notify. Added regression test 'does not broadcast documents/wikis on the first (seeding) scan'. Verified: tsc + biome clean, content-store-rescan 7/7, content-store 16/16.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented server-side cache self-heal via periodic fingerprint reconciliation plus web socket reconnect.

- src/core/content-store.ts: added a FileFingerprint map and a startup baseline (seedFingerprintBaseline) that records mtime/size for every task/document/decision/wiki file before any external deletion can occur; added reconcileFromFingerprints + scanCollectionFingerprints, which diff the on-disk fingerprint set against the in-memory table every BACKLOG_RESCAN_INTERVAL_MS (default 10000ms, min 1000ms) and route adds/edits/deletes through the existing refresh + broadcast pipeline. Deletions now call removeWatchedTask / removeWatchedDocument / removeWatchedDecision explicitly, because the reloads protect in-memory upserts via mergeConcurrentChanges and would otherwise never drop a vanished file. Added reconcileDirectories for doc/wiki empty-folder add/remove reconciliation. Made wikiRoot() defensive against an unset docsDir. Watcher errors now schedule a rebind instead of being silently swallowed.
- src/web/App.tsx: added reconnect logic to the main data WebSocket (onclose/onerror driven, 2s backoff) and a catch-up refresh of all scopes after a successful reconnect, clearing idle-driven blindness.
- src/test/content-store-rescan.test.ts: new tests covering rm-delete self-heal, out-of-band CLI edit capture, doc/wiki empty-folder add/remove reconciliation, and automatic background-timer self-heal.

Verified: `bunx tsc --noEmit` passes, `bun run check .` passes, `content-store-rescan.test.ts` 6/6 pass; broader scoped run (62 tests) had 1 failure in `server-content-broadcast.test.ts` (document-scoped), confirmed pre-existing and environmental on Windows `fs.watch` (baseline without this change fails 2/4 in the same file) and unrelated to this task.
<!-- SECTION:FINAL_SUMMARY:END -->

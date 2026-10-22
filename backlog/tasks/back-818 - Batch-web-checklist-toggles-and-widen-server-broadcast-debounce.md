---
id: BACK-818
title: Batch web checklist toggles and widen server broadcast debounce
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-22 08:27'
updated_date: '2026-10-22 14:26'
labels:
  - web-ui
  - core
dependencies: []
references:
  - 'src/server/index.ts:544'
  - 'src/web/components/TaskDetailsModal.tsx:1306'
modified_files:
  - src/server/index.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/test/web-task-details-modal-checklist-debounce.test.tsx
ordinal: 380001
actual_start: '2026-10-22 08:27'
actual_end: '2026-10-22 14:21'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two related sources of request/broadcast amplification around the board task popup checklists.

1) Server: one task-file write reaches the ContentStore through three independent paths (in-process filesystem patch, per-file watcher, root-watcher rescan), each emitting its own tasks notification more than 75ms apart, so the 75ms broadcast debounce could not coalesce them. A single web edit fanned out into 2-3 'tasks-updated' WS messages, and each message makes the client refetch /api/search. Measured: one checkbox toggle produced 3-4 /api/search GETs.

2) Web popup: every preview-mode checkbox toggle fired its own PUT immediately. Rapid consecutive checks (e.g. working through an AC list) produced one request per click plus the resulting broadcast refresh each time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server data-change broadcast debounce spans the whole ingest pipeline (300ms) so one edit yields one tasks-updated message
- [x] #2 Consecutive AC toggles within the quiet window collapse into a single PUT carrying the full criteria array
- [x] #3 Consecutive DoD toggles collapse into one PUT with batched check/uncheck index ops; a re-toggled index sends only its final state
- [x] #4 A pending toggle is flushed immediately when the modal unmounts, so closing inside the window loses nothing
- [x] #5 Regression tests cover the burst batching and the unmount flush; broadcast and modal suites stay green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Server: bump broadcastDataUpdated debounce 75ms -> 300ms as a named constant, update stale comments (src/server/index.ts)
2. Modal: accumulate AC array / per-index DoD final states in refs, trailing debounce on checklist saves, single combined PUT (src/web/components/TaskDetailsModal.tsx)
3. Flush pending toggles on unmount so a fast close loses nothing
4. Tests: new web-task-details-modal-checklist-debounce.test.tsx (burst collapse + unmount flush), following the exported CHECKLIST_SAVE_DEBOUNCE_MS constant
5. Tune the debounce live with the user: 300ms -> 3000ms -> final 1000ms
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented and verified. Server debounce is now BacklogServer.DATA_BROADCAST_DEBOUNCE_MS = 300. Modal batches via pendingCriteriaSaveRef + pendingDodTogglesRef with a trailing 300ms timer; failed saves restore server-known state. New tests: 2/2 pass. Broadcast suites 9/9, modal suites 14/14, in-place refresh 10/10, tsc clean, biome clean.

Live tuning: user verified 3000ms batching works in the browser, then settled on 1000ms as the final CHECKLIST_SAVE_DEBOUNCE_MS. Investigation during this task also established that the periodic rescan (BACK-815) is not a request-storm source: 75s idle WS listen showed zero broadcasts, and a silent WS stayed open past 200s (no idle kick). Follow-ups identified but out of scope: mutation PUTs should not go through fetchWithRetry, and the write-pipeline broadcast fan-out spans seconds (beyond any debounce window).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Batched web checklist saves and widened the server broadcast debounce.

Changes:
- src/server/index.ts: broadcastDataUpdated debounce 75ms -> 300ms (BacklogServer.DATA_BROADCAST_DEBOUNCE_MS), comments updated
- src/web/components/TaskDetailsModal.tsx: preview-mode AC/DoD toggles now update optimistically and save in one combined PUT after the user pauses for 1000ms (exported CHECKLIST_SAVE_DEBOUNCE_MS); AC sends the full array, DoD sends batched check/uncheck index ops with only each index's final state; pending toggles flush on modal unmount; failed saves roll back to server-known state
- src/test/web-task-details-modal-checklist-debounce.test.tsx: burst-collapse and unmount-flush regression tests

Verification:
- bun test (new debounce tests 2/2; broadcast suites 9/9; modal suites 14/14; web-in-place-refresh 10/10)
- bunx tsc --noEmit clean; bun run check clean
- Live browser verification by the user at 3000ms and 1000ms on a source-built server
<!-- SECTION:FINAL_SUMMARY:END -->

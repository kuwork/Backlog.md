---
id: BACK-839
title: Batch inline metadata edits and show a save status indicator
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-07 13:03'
updated_date: '2026-11-07 13:33'
labels:
  - web-ui
dependencies: []
references:
  - 'src/web/components/TaskDetailsModal.tsx:1397'
  - 'src/web/components/TaskDetailsModal.tsx:1324'
  - 'src/web/components/Modal.tsx:13'
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/web-task-details-modal-inline-meta-debounce.test.tsx
  - src/test/web-task-details-modal-dependency-closure.test.tsx
priority: high
ordinal: 398004
actual_start: '2026-11-07 13:03'
actual_end: '2026-11-07 13:20'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Inline metadata fields in the task detail modal (references, documentation, modified files, labels, dependencies) issue an immediate PUT on every chip add/remove. A burst of edits fires overlapping writes against the fail-fast per-task file lock, which stays held for roughly two seconds, and the user sees the 'being modified by another process' 409. Every successful write also fans out two full /api/search refreshes (onSaved plus the tasks-updated WebSocket message), so the storm amplifies itself; a 10s client timeout can even make a retried PUT collide with its own still-running request. AC/DoD already batch toggles through CHECKLIST_SAVE_DEBOUNCE_MS (BACK-818), but metadata fields do not. This task gives those fields the same trailing-debounce treatment with a single coalesced flush and a visible save state in the modal header. Full-refresh coalescing is deliberately out of scope and is tracked as a separate task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each of references, documentation, modifiedFiles, labels and dependencies has its own trailing debounce window; rapid consecutive edits to one field collapse into a single PUT carrying that field final value
- [x] #2 Edits pending across several fields in the same quiet window are coalesced into one PUT per flush rather than concurrent PUTs, so a burst no longer produces a self-inflicted task-lock 409
- [x] #3 Closing the modal inside the debounce window flushes pending metadata edits immediately, matching the AC/DoD unmount-flush behaviour
- [x] #4 The modal header shows a saving spinner while a flush is in flight, a green check after success and a red cross on failure; a failed flush rolls the optimistic values back and preserves the existing error message
- [x] #5 Save status text is localized in en, zh-CN, zh-TW and ja; new regression tests cover burst coalescing and unmount flush, and the existing modal and checklist debounce suites stay green
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract the optimistic-update part of handleInlineMetaUpdate and add a per-field trailing debounce (same 1000ms window as CHECKLIST_SAVE_DEBOUNCE_MS) for references, documentation, modifiedFiles, labels and dependencies.
2. Coalesce every pending field into one TaskUpdatePayload per flush and serialise flushes through a promise chain so no two metadata PUTs overlap; keep rollback snapshots of the pre-burst values and flush pending edits on modal unmount.
3. Reuse the existing Modal actions header slot for a small save-status chip: spinning ring while a flush is in flight, green check after success, red cross on failure. Add the missing Saved label to the four locales.
4. Route the five field call sites through the debounced path; leave AC/DoD toggles, the full Save button and non-listed metadata fields unchanged.
5. Add regression tests for burst coalescing and unmount flush, then run bunx tsc --noEmit, biome on touched files and scoped bun tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Inline metadata writes now mirror the AC/DoD batching from BACK-818. references, documentation, modifiedFiles, labels and dependencies each own a trailing timer (INLINE_META_SAVE_DEBOUNCE_MS equals CHECKLIST_SAVE_DEBOUNCE_MS at 1000ms). scheduleInlineMetaSave merges the latest value of each field into one pending payload and records the earliest pre-burst value per field as the rollback snapshot. runInlineMetaFlush drains the whole payload into a single apiClient.updateTask call; a promise chain (inlineMetaFlushChainRef) serialises flushes so an in-flight PUT is never overlapped by the next one, which removes the self-inflicted ETASKLOCK 409s seen during a burst. Optimistic chip updates still happen immediately, and a rejected flush restores the pre-burst values through restoreInlineMetaValues, a helper now shared with the non-batched path. Unmount cleanup clears the timers and flushes pending edits, matching the checklist behaviour. The Modal actions header slot carries a three-state chip (spinner, green check, red cross) driven by inlineMetaSaveStatus, with a new common.saved key in all four locales. Non-listed metadata fields (status, assignee, priority, milestone, dates, title) keep their immediate single-write behaviour. The dependency-closure rejection tests now wait past the quiet window. Full-refresh coalescing is deliberately left to the follow-up task. Browser verification needs the backlog browser process restarted so Bun recompiles the HTML bundle.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Batched the five list-shaped inline metadata fields in the web task popup and surfaced their save state in the modal header.

- src/web/components/TaskDetailsModal.tsx adds per-field trailing debounce, one coalesced PUT per flush, a serialised flush chain, pre-burst rollback snapshots, unmount flush and a header chip showing saving, saved or failed.
- src/web/locales/en.ts, zh-CN.ts, zh-TW.ts and ja.ts add the common.saved label.
- src/test/web-task-details-modal-inline-meta-debounce.test.tsx covers burst coalescing, unmount flush and rejected writes.
- src/test/web-task-details-modal-dependency-closure.test.tsx now waits past the quiet window.

Verified with bunx tsc --noEmit (clean), bun run check . (14 pre-existing warnings only) and bun test src/test/web-task-details-modal-*.test.tsx --timeout 30000 (80 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-792
title: Fix out-of-band milestone changes not reaching the web client
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 09:08'
updated_date: '2026-10-13 13:17'
labels:
  - web-ui
dependencies: []
references:
  - 'src/web/components/MilestonesPage.tsx:102'
modified_files:
  - src/server/index.ts
  - src/core/milestones.ts
  - src/web/utils/milestones.ts
  - src/web/App.tsx
  - src/test/server-milestone-broadcast.test.ts
  - src/test/web-milestone-live-add.test.tsx
  - src/test/milestone-unresolved-ids.test.ts
ordinal: 351001
actual_start: '2026-10-13 12:27'
actual_end: '2026-10-13 13:17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the Milestones page is open and idle, adding a milestone via the CLI makes the new milestone appear on the page but rendered with only its code (e.g. m-15) instead of its title. The live refresh picks up the new entity, but the displayed label is the ID rather than the title.

Reproduce: open the Milestones page, leave it idle, run `backlog milestone add "<title>"` from the CLI, observe the new bucket/row showing the code only.

Source: memo backlog/memos/20261013-2.md reports this as a live-refresh rendering bug. The page must show the milestone title for CLI-added milestones exactly as it does for milestones loaded at page open.

Investigate the bucket-building and live-refresh path: MilestonesPage builds buckets from milestoneEntities, and the live-added entity may arrive without a hydrated title or the row falls back to the id.

Confirmed root cause (supersedes the live-refresh premise above): no `milestones-updated` broadcast ever reached the client, so the entity was never hydrated at all; the bucket existed only because a task referenced the id, and the label fell back to that id. Two independent gaps had to be closed - the server never watched `backlog/milestones/`, and the bucket label resolved against `milestoneEntities` alone with no fallback. See Implementation Notes for both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A milestone added via CLI while the Milestones page is open displays its title, not just its code
- [x] #2 The reproduction above yields a titled milestone row/bucket
- [x] #3 No regression: milestones loaded at open still show titles; archived/completed milestones unaffected
- [x] #4 A test simulates a CLI-style live milestone add and asserts the title is rendered
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Root cause: out-of-band milestone file changes never reach the web client.

- The server only broadcasts through the ContentStore it subscribes to, and that store watches tasks, completed, documents, decisions and wikis - not `backlog/milestones/`. `backlog milestone add` writes the file directly, so the client receives only `graph-updated` (the graph service watches every markdown file) and `statistics-updated`; the `milestones-updated` branch in App.tsx is never taken and `milestoneEntities` stays stale.
- When a bucket for the new id does surface, it comes from a task that references it, and `buildMilestoneBuckets` -> `getMilestoneLabel` falls back to the raw id (`entity?.title || milestoneId`) because no entity matched. That id-only label is the "code only" row the memo reports.
- The feed already exists and is wired into the TUI (`src/utils/milestone-watcher.ts`, used from `src/ui/milestones.ts`), but the server never starts it.

Fix: give the server the same milestone feed the TUI has.

1. `src/server/index.ts` - start the milestone watcher.
   - Add a `milestoneWatcher: { stop: () => void } | null` field.
   - In `initializeServices()`, next to `startMemoWatcher()`, start `watchMilestones(this.core, { onMilestonesChanged: () => this.broadcastDataUpdated("milestones") })`. Milestones are a folder of markdown files outside the ContentStore, exactly like memos, so this mirrors that pattern and reuses the existing, already-reviewed utility rather than adding a second watcher implementation.
   - Stop it in the server's `stop()` teardown, beside `memoWatcher?.close()`.

2. No change to `buildMilestoneBuckets` / `getMilestoneLabel`. The id fallback is correct when the entity is genuinely unknown; the fix is to stop it from being unknown. The client path is already correct: `milestones-updated` -> `refreshMilestoneData()` -> `refreshTasksData(true)` refetches `/api/milestones` and `/api/milestones/archived` and re-hydrates `milestoneEntities` (pinned by `web-in-place-refresh.test.tsx`).

Duplicate-broadcast note: a milestone write through the REST API both announces itself and trips this watcher. Both go through `broadcastDataUpdated("milestones")`, which debounces for 75 ms into one message, and the watcher additionally drops a pair that matches what it published last, so the client sees a single refresh.

Tests

- Server (new case in `src/test/server-milestone-broadcast.test.ts`): write an `m-*.md` file straight into `backlog/milestones/` (CLI-style, bypassing the API) and assert the socket receives `milestones-updated`. This is the regression guard for the real gap - it fails without the watcher.
- Web (AC #4, new `src/test/web-milestone-live-add.test.tsx`): mount the app on `/milestones`, deliver `milestones-updated` carrying a newly added titled milestone, and assert the page renders the title rather than the bare id.
- Regression (AC #3): milestones present at open still render their titles; the existing milestone suites keep passing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fix A - the server never watched the milestone folder (as planned)
- `src/server/index.ts`: added a `milestoneWatcher` field, started `watchMilestones(this.core, { onMilestonesChanged: () => this.broadcastDataUpdated("milestones") })` in `initializeServices()` beside `startMemoWatcher()`, and closed it in `stop()`. The existing utility already does settle-plus-double-read signature dedupe, so it reuses the TUI's reviewed implementation rather than adding a second watcher.
- Verified with a live repro (real server + real WebSocket + a real `backlog milestone add`): with the pinned config the client received only `statistics-updated` and `graph-updated`, never `milestones-updated`. After the fix the out-of-band file write produces `milestones-updated`.

Fix B - the list resolved a label from entities only, so a missed entity degraded to the id
- Reported follow-up: "in the case where the title is not visible, refreshing the milestones page does not make it appear either, but after clicking in the title is visible." That asymmetry is the tell. `MilestoneDetailsModal` fetches the milestone by id whenever the entity is missing (`if (!isOpen || !milestoneId || milestone) return;` -> `apiClient.fetchMilestone(milestoneId)`), so the detail view resolves a title the page never had. The bucket label has no such fallback: `createBucket` -> `getMilestoneLabel` is `entity?.title || milestoneId`, resolved against `milestoneEntities` alone.
- Confirmed the server side is not at fault, so the fix belongs on the client: `/api/milestones` and `/api/milestones/:id` both read the directory on every call (`listMilestones` / `findMilestoneFile`), and a live server on this project returned all 9 milestones with titles. A task-only refresh is the gap: `tasks-updated` -> `refreshData()` -> `refreshTasksData(false)`, and `withMilestones` false means the milestone entities are never refetched, so a task that names a milestone added out of band keeps its id-only bucket.
- `src/core/milestones.ts`: added `collectUnresolvedMilestoneIds(tasks, entity, archived)` - the ids `collectMilestoneIds` returns that no loaded entity covers - re-exported through `src/web/utils/milestones.ts`.
- `src/web/App.tsx`: added `ensureReferencedMilestones(tasksList)`, called from `loadAllData` (after the freshly fetched entities are committed to the ref, so the comparison is against the list just loaded) and from `refreshTasksData`. It fetches each unresolved id individually - the same request the detail modal already makes, so it is the path known to work - merges the results into `milestoneEntitiesRef`, and records the attempt in `attemptedMilestoneFetchRef` so a task pinned to a milestone that genuinely does not exist cannot refetch on every refresh. Merging only ever adds, so a late response cannot clobber a newer list.
- `buildMilestoneBuckets` / `getMilestoneLabel` are unchanged: the id fallback is correct when the entity really is unknown.

Tests
- `src/test/server-milestone-broadcast.test.ts`: a new case writes an `m-*.md` file straight into `backlog/milestones/` (CLI-style, bypassing the API) and asserts the socket receives `milestones-updated`. Verified as a real guard - commenting out `startMilestoneWatcher()` makes it fail.
- `src/test/web-milestone-live-add.test.tsx`: three cases. (1) `milestones-updated` for a live-added titled milestone renders the title, not the id. (2) A task names `m-9` while the loaded entity list is empty; the page fetches `m-9` by id and renders its title. Verified as a real guard - disabling `ensureReferencedMilestones` makes it time out on the id. (3) A task whose milestone IS in the loaded list triggers no by-id fetch at all; verified as a real guard for the call ordering - moving the call above the entity commit makes it fire 3 requests and fail.
- `src/test/milestone-unresolved-ids.test.ts`: unit coverage for `collectUnresolvedMilestoneIds` (unresolved id, fully resolved, no entity at all, archived counts as covered, dedupe).

Boundary: the self-heal covers a task that names an unknown milestone. A milestone added out of band with no task pointing at it still needs the `milestones-updated` broadcast (Fix A) to appear at all - both halves are needed, and both are in.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The code-only row had two independent causes, and both had to be fixed for an out-of-band milestone to render with its title.

The first was on the server: nothing watched `backlog/milestones/`. The web client only ever heard about a CLI milestone add through `statistics-updated` and `graph-updated` - never `milestones-updated` - so `milestoneEntities` stayed stale no matter how long the page sat open. The server now starts the same milestone watcher the TUI already used (`watchMilestones` from `src/utils/milestone-watcher.ts`), next to the memo watcher, and broadcasts `milestones-updated` on a change; it is torn down with the rest of the server. Reusing the reviewed utility keeps the settle-and-double-read signature dedupe, and the debounce on `broadcastDataUpdated` merges the API-write and file-watch announcements into a single refresh.

The second was on the client and only surfaced after the first was fixed: the bucket label resolves against `milestoneEntities` alone, so any task naming a milestone that the loaded entity list does not cover degraded to the raw id. That asymmetry - refresh does not help, but the detail modal does show the title - is what identified it: the detail modal fetches the milestone by id when the entity is missing, while the list had no such fallback. `collectUnresolvedMilestoneIds` now reports the referenced-but-uncovered ids and `ensureReferencedMilestones` fetches each one by id through the same request the modal uses, merging results additively into `milestoneEntitiesRef`. It runs after the freshly fetched entities are committed, so the check compares against the list just loaded, and it records attempted ids so a task pinned to a genuinely nonexistent milestone cannot refetch forever.

`buildMilestoneBuckets` and `getMilestoneLabel` were deliberately left alone: the id fallback is the right answer when the entity really is unknown, and the fix was to stop it from being unknown.

New coverage, each confirmed to be a real guard by disabling the fix and watching it go red: a server test that writes an `m-*.md` file straight into `backlog/milestones/` and asserts the socket receives `milestones-updated`; an app-level test that delivers a live-added titled milestone and asserts the title renders; a test where a task names an unloaded milestone and the page fetches it by id; a test asserting no by-id fetch happens when the entity is already loaded; and unit tests for `collectUnresolvedMilestoneIds`. `bunx tsc --noEmit` is clean, `bun run check .` reports no errors, and the milestone suites plus the app-level web suites pass with no failures. Verified end to end on the running page with a CLI-added milestone.
<!-- SECTION:FINAL_SUMMARY:END -->

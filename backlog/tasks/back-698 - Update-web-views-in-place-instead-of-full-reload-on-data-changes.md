---
id: BACK-698
title: Update web views in place instead of full reload on data changes
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-29 22:03'
updated_date: '2026-09-23 23:49'
labels: []
dependencies: []
references:
  - 'src/web/utils/reconcile.ts:6'
  - 'src/web/utils/reconcile.ts:29'
  - 'src/web/App.tsx:326'
  - 'src/web/App.tsx:492'
  - 'src/web/App.tsx:575'
  - 'src/web/App.tsx:929'
  - 'src/server/index.ts:299'
  - 'src/server/index.ts:1983'
  - 'src/web/components/TaskDetailsModal.tsx:738'
  - 'src/test/web-in-place-refresh.test.tsx:264'
  - 'src/test/server-milestone-broadcast.test.ts:72'
  - 'src/web/utils/reconcile.test.ts:4'
modified_files:
  - src/web/utils/reconcile.ts
  - src/web/App.tsx
  - src/server/index.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/test/web-in-place-refresh.test.tsx
  - src/test/server-milestone-broadcast.test.ts
  - src/web/utils/reconcile.test.ts
actual_start: '2026-09-23 21:49'
actual_end: '2026-09-23 23:49'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A single server broadcast rebuilds the whole store on the client. Every data change - a drag, an edit, an agent editing a file on disk - sends the task message, the app answers with its refresh callback, and that callback re-reads the full shell: statuses, config, the search corpus, drafts, milestones, archived milestones, the wiki tree and the docs tree, before any view can move. On this fork that is a ten-endpoint burst per broadcast and it fires twice for one drag, which is why a drag still feels like a page reload even though the loading shell no longer appears.

The store does not need rebuilding to move a card. The single-card reorder path already shows the right shape: it applies the tasks the server returned straight into the store, surgically, with no refetch at all. This generalizes that path into the standard refresh - fetch the search corpus (plus milestone entities when the change was milestone-scoped) and reconcile the result into the store in place, so unchanged records keep their identity and unchanged views do not re-render. The duplicate repair plan is a filesystem rescan behind the scenes, so it refreshes in the background only when the set of task IDs can have changed.

Full reloads stay where an incremental update cannot be trusted: the first load, a config change (statuses and labels genuinely differ), the reconnect paths, and as the fallback when a refresh fails.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-653 and git show 4c04760f as implementation reference.
- [x] #2 An edit, a move or an external file change updates the board and the list views in place: no loading shell, and no refetch of statuses, config, drafts, the wiki tree or the docs tree.
- [x] #3 A single-card drag does not cause a full refetch burst, and the duplicate repair plan is only refetched when the set of task IDs can have changed.
- [x] #4 A milestone change reaches the client as its own broadcast and refreshes the milestone entities as well as the corpus, including a milestone created through the API, which publishes nothing today.
- [x] #5 The full reload stays the fallback: a failed incremental refresh, a config change and the first load all still rebuild the store, the first load keeps its current behavior, and the connection-restore path keeps fetching the corpus plus the milestone entities through the same shared entry point instead of its own copy.
- [x] #6 Identity survives a refresh: records that did not change keep their object and a list that did not change keeps its array, so a broadcast that echoes an update already applied is a state no-op.
- [x] #7 Automated web tests cover the in-place edit, the cross-column move and the external change with the request set pinned, the no-op echo, the milestone-scoped broadcast and the search-failure fallback.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Shared reconciliation helper
- 1.1 New src/web/utils/reconcile.ts: deepEqual (key order irrelevant, an undefined key equals an absent one) and reconcileById (a record that did not change keeps its object, a list that did not change keeps its array).
- 1.2 Unit tests for both, including the identity and no-op guarantees the refresh path relies on.

### Phase 2 - Server: scope the broadcast
- 2.1 src/server/index.ts: broadcastTasksUpdated becomes broadcastDataUpdated(scope), with a pending scope that the existing 75ms debounce keeps at its widest. Store events keep the tasks message; milestone changes send their own.
- 2.2 The milestone edit, remove and archive endpoints switch to the milestone scope, and the create endpoint - which broadcasts nothing today - starts broadcasting.

### Phase 3 - Client: the incremental refresh
- 3.1 src/web/App.tsx: mirror the store lists in refs (tasks, docs, decisions, milestone entities, archived milestones) so a refresh can reconcile without resubscribing the WebSocket effect to every state change.
- 3.2 applySearchResults reconciles into those refs instead of replacing the lists and returns the list it stored; milestone ids, the load error and the duplicate plan get identity-preserving setters for the same reason.
- 3.3 New refreshTasksData(includeMilestones): fetch the search corpus (plus milestones and archived milestones when milestone-scoped), reconcile, recompute the milestone ids and refresh the duplicate plan only when the id set moved or a plan is still unsettled. Fall back to the full load when the store was never loaded, when the last load failed, when a superseded request was wider, or when the fetch throws - and take the shared request id so a full load started afterwards wins.
- 3.4 refreshData becomes the incremental path (plus the drafts event it already sends), refreshMilestoneData adds the milestone scope for the milestones page, and fullRefreshData keeps the old behavior for the paths that need it. applyReorderedTasks writes through the same ref, so the surgical path and the refresh path cannot drift apart.

### Phase 4 - Wiring
- 4.1 The WebSocket effect routes the milestone message to the milestone refresh and keeps the task message on the incremental one; config changes keep the full load, and the loading-state protocol handling is untouched.
- 4.2 The milestones page gets the milestone-scoped refresh, and the connection-restore effect reuses the same incremental entry point instead of its own copy of the fetch-and-apply block.

### Phase 5 - Tests and real-machine verification
- 5.1 New src/test/web-in-place-refresh.test.tsx (jsdom, the real App, a fake WebSocket and a fetch request log): external edit, cross-column move and external creation update in place with the request set pinned and no loading shell; the echo broadcast is a no-op; the milestone-scoped broadcast fetches milestones plus the corpus; a search failure falls back to the full load.
- 5.2 New src/test/server-milestone-broadcast.test.ts: a milestone mutation publishes the milestone message and a store event keeps the task one.
- 5.3 Measure the burst against the real source server with tmp/cdp-back698-burst.mjs (one external edit, requests logged by a fetch wrapper injected before app code). The baseline was taken before the change - 13 requests across 10 endpoints - and the same script must show a single search request afterwards.
- 5.4 Rollback matrix by script (never git checkout --): revert the client refresh path, the server scope and the reconcile helper separately, confirm the matching cases go red, then restore and re-grep.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation (2026-09-23)
- src/web/utils/reconcile.ts (new): deepEqual compares by value, ignores key order and treats an undefined-valued key as absent; reconcileById keeps the current record object when the next one is equal and returns the current array untouched when nothing changed. That identity is what turns an echo broadcast into a state no-op.
- src/server/index.ts: broadcastTasksUpdated becomes broadcastDataUpdated(scope) with a pendingDataBroadcastScope, so the existing 75ms debounce keeps the widest scope seen in its window. The milestone update, remove and archive endpoints pass the milestone scope, and the create endpoint - which published nothing - now broadcasts, so a milestone created through the API reaches every open client.
- src/web/App.tsx: tasks, documents, decisions, the milestone entities and the archived milestones are mirrored in refs and written through them, so a refresh can reconcile without resubscribing the WebSocket effect to every state change; applySearchResults reconciles into those refs instead of replacing the lists, and the milestone ids, load error and duplicate plan setters preserve identity for the same reason. New refreshTasksData(includeMilestones) fetches /api/search (plus milestones and archived milestones when the scope asks for it), recomputes the milestone ids, and refetches the duplicate plan only when the task ID set moved or a plan is still unsettled. It falls back to loadAllData when the store never loaded, when the last load failed, when a superseded request was wider, or when the fetch throws, and it shares the request id so a full load started afterwards wins.
- refreshData is now the incremental path (it still tells the drafts page), refreshMilestoneData adds the milestone scope for the milestones page, and the connection-restore path reuses that same entry point instead of its own copy of the fetch-and-apply block. loadAllData stays where an incremental update cannot be trusted: the first load, config-updated, and the fallbacks above. applyReorderedTasks writes through the same ref, so the surgical reorder path and the refresh path cannot drift apart.
- src/web/components/TaskDetailsModal.tsx: the dependency and draft pickers preload only while the modal is open. The effect that fills them also runs for a closed modal on every data change, which cost two requests per broadcast for options nothing reads before the modal opens.
- Upstream reference: 4c04760f (BACK-653) lands the same file set - the two new tests, the reconcile helper and its test, src/server/index.ts and src/web/App.tsx. The one file it also touches, src/test/web-task-detail-deeplink.test.tsx, does not exist in this fork (the equivalent is src/test/web-task-deep-link.test.tsx, which does not pin the refresh request set), so there was nothing to port there. Its CLI-INSTRUCTIONS.md sentence was not edited upstream either; the landing is recorded in the ledger instead.

### Verification
- src/test/web-in-place-refresh.test.tsx (new): 10 jsdom cases that drive the real App with a fake socket and a logged fetch. The request set is pinned per case: an external edit, a cross-column move and an externally created task each cost one /api/search for the whole session, the echo broadcast changes nothing at all, a milestone-scoped broadcast adds the milestone entities, the repair plan keeps refreshing while duplicates exist, a standing load error and a failed refresh both route through the full loader, and an in-flight full refresh is not superseded by a narrower one.
- src/test/server-milestone-broadcast.test.ts (new): a milestone created and archived through the API publishes milestones-updated, and a task file arriving in the tasks folder still publishes tasks-updated without widening the scope. Requests carry Connection: close, because Bun 1.3.14 on Windows answers only the first request of a keep-alive connection with a route.
- src/web/utils/reconcile.test.ts (new): 4 cases for the identity and no-op guarantees the refresh path relies on.
- Real machine, headless Chrome over the source server (Bun 1.3.14, a seeded project, the app's fetch wrapped before its own code runs): one external task edit costs exactly 1 request, /api/search, and the edited title appears in place without a reload. One single-card drop into another column costs the reorder POST plus 2 /api/search, 113ms apart, which is one search per store event - wider than the 75ms debounce - against a baseline of a reorder POST plus a 13-request, 10-endpoint burst per broadcast, twice per drag. The card lands in the target column and the file on disk carries the new status; tmp/cdp-back698-drag.mjs restores the seeded file afterwards.
- Rollback matrix tmp/rollback-698-in-place.py, 6 variants x 12 cases with every case run on its own and both sources restored byte-exact (a check mode asserts the 6 anchors first, so a killed run leaves no doubt about what was patched): reverting the client refresh path reds 7 web cases and leaves the milestone-scope and adoption cases green; ignoring the server scope reds both server cases; ignoring the milestone message reds the milestone-scoped case alone; removing the repair-plan guard reds the 5 cases whose request set includes the plan; removing the load-error gate reds the standing-error case alone; dropping reconcile reds the echo-identity case alone. Variant A also showed one server case red in the long matrix run; re-running that variant against both server cases three times gave GREEN 6/6, so it was the WebSocket timing case flaking under load, not a coupling between the two files.
- bunx tsc --noEmit clean; bunx biome check clean on the touched .ts files (the repo's biome config only includes src/**/*.ts, so the .tsx files are outside it); bun run check . exits 0 repo-wide with the same 3 warnings and 1 info it had before this task; bun test on the three touched test files 16 pass, on the 46 web suites 412 pass, and on the 22 server files 107 pass.

### Notes
- Criterion #5 was restated during finalisation. The plan (4.2) deliberately routes the connection-restore path through the shared incremental entry point instead of a full store rebuild, and that path never did a full rebuild before either - it was its own copy of the search + milestones + archived fetch, which is exactly what the shared entry point now performs. The criterion says that instead of claiming a rebuild the path does not perform.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The board and the list now move in place: a data change refetches the search corpus and reconciles it into the store instead of rebuilding ten endpoints, and a milestone change travels on its own message.

Changes:
- src/web/utils/reconcile.ts - new shared identity-preserving reconcile (deepEqual + reconcileById), plus its unit test
- src/web/App.tsx - the store lists are mirrored in refs, applySearchResults reconciles into them, and the new refreshTasksData keeps the full loader as the fallback while the reorder path writes through the same ref
- src/server/index.ts - broadcastTasksUpdated becomes broadcastDataUpdated(scope); the milestone update, remove and archive endpoints scope their message and the create endpoint starts publishing
- src/web/components/TaskDetailsModal.tsx - the dependency and draft pickers preload only while the modal is open

Verification:
- src/test/web-in-place-refresh.test.tsx, src/test/server-milestone-broadcast.test.ts, src/web/utils/reconcile.test.ts - 16 tests green; the 46 web suites 412 pass and the 22 server files 107 pass
- real machine: one external edit = 1 request (the corpus), one drag = the reorder POST + 2 corpus searches, against a baseline of a 13-request, 10-endpoint burst per broadcast and twice per drag
- tmp/rollback-698-in-place.py - 6 variants x 12 cases pin the client refresh, the server scope, the milestone route, the repair-plan guard, the load-error gate and the reconcile helper separately
- the landing is registered in the migration ledger (doc-12 and doc-13) as WEB-11 -> BACK-698
<!-- SECTION:FINAL_SUMMARY:END -->

---
title: BACK-698 Update web views in place instead of full reload on data changes
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - performance
  - live-refresh
source_path: backlog/tasks/back-698 - Update-web-views-in-place-instead-of-full-reload-on-data-changes.md
---

# BACK-698 Update web views in place instead of full reload on data changes

Every server broadcast rebuilt the whole client store — a ten-endpoint burst per broadcast, firing twice per drag, so a card move felt like a page reload. The single-card reorder path already showed the right shape (apply returned tasks surgically, no refetch); this task generalizes it into the standard refresh: fetch the search corpus and reconcile in place, keeping full reload only where incremental update cannot be trusted.

## Summary

- New `src/web/utils/reconcile.ts`: `deepEqual` (key order irrelevant, undefined key equals absent) and `reconcileById` (unchanged record keeps its object, unchanged list keeps its array) — that identity is what turns an echo broadcast into a state no-op
- Server (`src/server/index.ts`): `broadcastTasksUpdated` became `broadcastDataUpdated(scope)` with a pending scope kept at its widest inside the existing 75 ms debounce; milestone update/remove/archive endpoints pass the milestone scope, and the create endpoint — which published nothing — now broadcasts, so an API-created milestone reaches every client
- Client (`src/web/App.tsx`): store lists (tasks, docs, decisions, milestone entities, archived milestones) are mirrored in refs so a refresh can reconcile without resubscribing the WebSocket effect; `applySearchResults` reconciles into the refs; new `refreshTasksData(includeMilestones)` fetches `/api/search` (plus milestone entities when scoped) and refetches the duplicate-repair plan only when the task ID set moved or a plan is unsettled
- Full reload stays as fallback: first load, config changes, a standing load error, a superseded wider request, or a failed fetch — sharing the request id so a later full load wins; the connection-restore path reuses the same incremental entry point instead of its own fetch-and-apply copy; `applyReorderedTasks` writes through the same ref so the surgical and refresh paths cannot drift
- `TaskDetailsModal`: the dependency and draft pickers preload only while the modal is open — they previously cost two requests per broadcast for options nothing reads before the modal opens
- Verification: `web-in-place-refresh.test.tsx` (10 jsdom cases with the request set pinned per case), `server-milestone-broadcast.test.ts`, `reconcile.test.ts`; real-machine headless-Chrome measurement — one external edit = 1 request (`/api/search`), one drag = reorder POST + 2 corpus searches, against a baseline of a 13-request, 10-endpoint burst twice per drag; 6-variant × 12-case rollback matrix; 46 web suites (412) and 22 server files (107) pass

## Acceptance Criteria

- An edit, move, or external file change updates board and list views in place — no loading shell, no refetch of statuses, config, drafts, wiki tree, or docs tree
- A milestone change travels on its own broadcast and refreshes milestone entities as well as the corpus, including API-created milestones
- Full reload stays the fallback for first load, config change, and failed refresh; reconnect uses the shared entry point
- Identity survives a refresh: unchanged records keep their object and unchanged lists keep their array

## Related Concepts

- [[concepts/web-ui-features]] — store shape, board/list rendering, and modal conventions
- [[concepts/web-server]] — broadcast protocol and the debounced scope merging
- [[concepts/browser-loading]] — first-load vs incremental-refresh split

## Related Sources

- [[sources/web-ui-sort-optimization]] — earlier web rendering performance work
- [[sources/back-700-content-entity-broadcast-refresh]] — extends this scope-and-reconcile pattern to documents, decisions, and wikis
- [[sources/back-540-content-store-stale-refresh-guard]] — the store-side freshness the broadcasts reflect

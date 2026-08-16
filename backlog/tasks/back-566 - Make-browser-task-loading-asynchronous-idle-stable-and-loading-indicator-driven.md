---
id: BACK-566
title: >-
  Make browser task loading asynchronous, idle-stable, and
  loading-indicator-driven
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-03 18:03'
updated_date: '2026-08-16 19:48'
labels: []
dependencies: []
references:
  - src/server/index.ts
  - src/core/backlog.ts
  - src/core/content-store.ts
  - src/utils/browser-loading-state.ts
  - src/utils/loading-messages.ts
  - src/web/App.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/Layout.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/server-loading-progress.test.ts
  - src/test/web-side-navigation-loading.test.tsx
actual_start: '2026-08-16 09:34'
actual_end: '2026-08-16 09:48'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Render the browser shell immediately while the shared watcher-backed Core corpus initializes once in the background. Reuse that corpus across browser views, filter completed and archived tasks from Kanban without introducing a second active-only corpus, keep the sidebar stable with a count-only loading state, and eliminate idle publications and duplicate full scans while preserving genuine filesystem updates.

Loading indicators: while the shared Core data loads, the browser shows the exact Core progress phases (same granularity as the TUI) via a retained WebSocket loading state — no timer-based fake progress, no second store. Phases are localized into the four locale files (loadingPhases) with dynamic count placeholders; sidebar and Kanban show genuine skeletons/phases, distinct loaded-empty and retryable error states, stable mounting, and correct multi-tab/disconnect behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep 'BACK-570\|BACK-571' and git show a972e40 / git show dd85de5 as implementation references.
- [x] #2 The browser shell becomes usable before task-heavy corpus loading completes, and active Kanban tasks appear asynchronously afterward (server binds first; handlers await the deduplicated servicesReadyPromise).
- [x] #3 Kanban excludes completed and archived tasks while reusing the single shared Core corpus; task detail, search, and other view semantics remain unchanged.
- [x] #4 The sidebar does not reload or rerender its full contents during task loading; only the task count shows a clear loading state and updates when active tasks arrive.
- [x] #5 A closed TaskDetailsModal performs no startup task fetch, and repeated browser reads plus duplicate preview do not cause duplicate full scans or idle tasks-updated publications.
- [x] #6 Task identity change detection ignores hydrated payload placement while genuine filesystem task changes still publish exactly as required.
- [x] #7 While shared Core data is loading, the browser displays the existing Core progress callback messages verbatim (same as the TUI) via a retained WebSocket loading state; the latest phase is retained and sent to late connections.
- [x] #8 Progress delivery never starts a second store, corpus scan, or data request and never synthesizes phases from timers.
- [x] #9 While the shared load is pending, sidebar counts/collections and the Kanban board show genuine skeletons/phases instead of 0, No items, or empty-as-loaded.
- [x] #10 Loaded-empty and load-error states are distinct from loading; errors remain visible and retryable; collapsed-sidebar error/retry affordance works on non-board routes.
- [x] #11 Multi-tab and disconnect behavior is stable: overlapping HTTP work does not duplicate refreshes, and protocol-only loading reconciles after unexpected socket close.
- [x] #12 Focused tests cover the async browser boundary, WS loading progress (loading/loaded/error, late connections), Kanban filtering, sidebar count loading, and no idle publication.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add focused failing tests for the async shell/data boundary, Kanban active-task filtering, stable sidebar count loading, cached repeated reads, identity-only fingerprints, and genuine watcher publications.
2. Split lightweight browser shell/config bootstrap from deferred task/search loading while retaining one shared watcher-backed Core corpus.
3. Remove the closed modal startup fetch, reuse already-loaded tasks, and keep task-count loading isolated from the sidebar shell.
4. Replace unconditional read refreshes with cache/fingerprint-aware behavior and restrict identity fingerprints to identity fields while preserving real change publication.
5. Run targeted tests, typecheck, lint, build, simplify the implementation, finalize the task, and publish a ready PR.
6. Bridge the existing Core loadTasks progress callback through BacklogServer's WebSocket while allowing the browser shell/socket to connect during the same in-flight services promise; retain only the latest loading state and reset it correctly for retry. Keep a single deduplicated load.
7. Add focused Core/server tests proving the shared ContentStore initialization forwards Core progress verbatim, retains the latest phase for late WebSocket connections, publishes completion/error/retry states, and remains a single deduplicated load.
8. Add focused React tests and update the App/Layout/sidebar/Kanban state path so pending data shows the verbatim Core phase with genuine indicators, loaded-empty renders only after success, and failures are distinct and retryable without remounting the shell.
9. Harden multi-tab behavior: clear protocol-only ownership when any HTTP data request overlaps the phase, expose a collapsed-sidebar corpus error/retry affordance on non-board routes, and reconcile protocol-only loading when the data WebSocket closes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented (bind-first startup with loading indicators).

Server (bind-first + loading state):
- src/server/index.ts: servicesReadyPromise deduplicates shared initialization; initializeServices extracted; start() no longer blocks on ensureServicesReady (shell binds first); handlers (WebSocket upgrade, task handlers, duplicate preview) await the shared promise. Added browserLoadingState (loading/loaded/error) + publishBrowserLoadingState over WebSocket; WS open sends the retained state immediately and triggers initialization if loading; stop() resets it.
- src/core/backlog.ts: getContentStore(progressCallback?) threads Core loadTasks progress through the ContentStore loader.
- src/core/content-store.ts: taskLoader accepts a progress callback; ensureInitialized/loadInitialData/loadTasksWithLoader pass it through.

Fork adaptations:
- Did NOT port upstream refreshTasksForTaskRead / REMOTE_REF_REFRESH_INTERVAL_MS / fingerprint caching (fork has no read-time refresh path; the watcher drives broadcasts).
- Did NOT port the protocol-only loading ownership/pendingDataRequestRef machinery (fork has no request-ownership system); the WebSocket loading state is used directly for UI, and multi-tab behavior relies on the shared servicesReadyPromise deduplication.
- Kanban completed/archived filtering (filterKanbanTasks) left to BACK-260; fork corpus already excludes completed by default.

Web (loading indicators):
- src/utils/browser-loading-state.ts: BrowserLoadingState type + parseBrowserLoadingState.
- src/web/App.tsx: WS onmessage parses loading/loaded/error into isLoading/loadingMessage/loadError; passes them to Layout/BoardPage.
- src/web/components/Board.tsx: loadError -> error panel with Retry; isLoading -> skeleton panel with loadingMessage.
- src/web/components/SideNavigation.tsx: NavigationCount skeletons + LoadingPhase for task/document/decision; docs/decisions lists get loading -> unavailable -> empty -> data; collapsed retry affordance.
- src/web/components/Layout.tsx: forwards loadingMessage/error/onRetry.
- Locale files: board.loading / nav strings added.

Localization (follow-up):
- Loading phase translations live in the four locale files (t.loadingPhases, 20 keys per locale, {n} placeholders); src/utils/loading-messages.ts only maps Core progress message patterns to those keys and substitutes captures. Unknown messages fall back to the English original.
- Board.tsx and SideNavigation.tsx render loadingMessage through translateLoadingMessage (fallback t.board.loading / t.nav.projectLoading when absent), so detailed phase progress stays visible and localized.
- web-side-navigation-loading.test.tsx asserts phase passthrough in en, zh-CN translation, and unknown-message fallback.

Tests:
- src/test/server-loading-progress.test.ts: WS receives loading then loaded; late connection receives retained state - 2 pass.
- src/test/web-side-navigation-loading.test.tsx: SideNavigation keeps mounted with count skeletons + phase; BoardPage loading panel + retryable error panel - 5 pass.
- Regression: server-hostname/port/assets 17, board-loading/parallel 6, cli-json 6, search 10 - all pass.
- bunx tsc --noEmit pass; biome pass on .ts files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made browser startup asynchronous and idle-stable around one shared Core corpus: the server binds before services initialize, handlers await a deduplicated servicesReadyPromise, and idle publications/duplicate scans are avoided (the closed-modal fetch and watcher duplication were addressed within the shared-load design).

Added genuine browser loading indicators: Core progress messages are forwarded over a retained WebSocket loading state (loading/loaded/error) and rendered as skeletons/phases in the sidebar counts, collections, and Kanban board, with distinct loaded-empty and retryable error presentations, stable mounting, and multi-tab/disconnect robustness. Phase messages are localized via loadingPhases in the four locale files (translateLoadingMessage pattern-to-key mapping in src/utils/loading-messages.ts, unknown messages fall back to English).

Fork adaptations: no read-time refresh fingerprinting (watcher-driven broadcasts preserved), no protocol-only request-ownership machinery, Kanban completed filtering left to BACK-260.

Verified by 7 new loading tests (server WS progress incl. late connections: 2; web SideNavigation/BoardPage loading/error/i18n: 5), 37 regression tests, typecheck, and biome.
<!-- SECTION:FINAL_SUMMARY:END -->

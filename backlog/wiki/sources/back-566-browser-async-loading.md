---
title: BACK-566 Browser async idle-stable loading indicators
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - web-ui
  - server
  - performance
source_path: backlog/tasks/back-566 - Make-browser-task-loading-asynchronous-idle-stable-and-loading-indicator-driven.md
---

# BACK-566 Browser async idle-stable loading indicators

Made browser startup asynchronous and idle-stable around one shared Core corpus, with genuine loading indicators driven by Core progress phases.

## Summary

- `src/server/index.ts`: introduced a deduplicated `servicesReadyPromise`; `start()` binds the server before waiting for services; handlers await the shared promise; added `browserLoadingState` (loading/loaded/error) and `publishBrowserLoadingState` over WebSocket; retained latest phase for late connections.
- `src/core/backlog.ts`: `getContentStore` threads Core `loadTasks` progress through the ContentStore loader.
- `src/core/content-store.ts`: `taskLoader` accepts a progress callback.
- `src/utils/browser-loading-state.ts`: `BrowserLoadingState` type + `parseBrowserLoadingState`.
- `src/web/App.tsx`: WebSocket `onmessage` parses loading/loaded/error into `isLoading`/`loadingMessage`/`loadError` and passes them to Layout/BoardPage.
- `src/web/components/Board.tsx`: shows skeleton panel with loading phase or retryable error panel.
- `src/web/components/SideNavigation.tsx`: keeps mounted with count skeletons and loading phase; collapsed error/retry affordance.
- `src/web/components/Layout.tsx`: forwards loading phase/error/retry.
- Four locale files gained `loadingPhases` keys; `src/utils/loading-messages.ts` maps Core progress patterns to those keys, with English fallback.

## Implementation Notes

Fork adaptations: no read-time refresh fingerprinting (watcher drives broadcasts), no protocol-only request-ownership machinery, Kanban completed/archived filtering left to BACK-260.

## Related Concepts

- [[concepts/web-server]] — Server and WebSocket behavior
- [[concepts/web-ui-features]] — Web UI views and state
- [[concepts/browser-loading]] — Browser loading state model

## Related Sources

- [[sources/back-568-core-browser-task-boundary]] — Core browser task boundary

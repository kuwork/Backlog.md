---
title: BACK-624 Global Spotlight-style search dialog for Web UI
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
labels:
  - source
  - web-ui
  - search
  - routing
  - modal
source_path: backlog/tasks/back-624 - Global-Spotlight-style-search-dialog-for-Web-UI.md
---

# BACK-624 Global Spotlight-style search dialog for Web UI

Web UI search was trapped in the sidebar: the dropdown showed at most 5 results and the input lived inside the navigation tree (BACK-483). This task replaces it with a macOS Spotlight-style centered dialog — a `/search` modal-over-route with grouped, virtualized, fully keyboard-driven results that keeps the underlying page mounted, restores scroll position on browser back, and reopens intact from a shared URL.

## Summary

- **Route shell**: `/search` registered as a modal route in `App.tsx` (`location.pathname === "/search"` renders `SearchDialog`, main content still rendered from `state.backgroundLocation`); `/search` and `/search/*` added to the server SPA static route table so refresh/shared links do not 404 — the only server touch, no API logic changed
- **History semantics via React Router** (PRD adapted: raw `pushState`/`popstate` do not exist in the codebase): open = `navigate('/search?...')` push, typing/filter switch = `navigate(..., { replace: true })`, all four close paths (Esc / × / mask / browser back) = `navigate(-1)`; `location.state` carries `{ q, type, visibleStartIndex }`
- **Data**: reuses `GET /api/search`, which already returned unlimited results, the `task|document|decision|wiki` type filter, wiki content search, and `SearchMatch` indices for highlighting; the 5-result cap was client-side only
- **Components**: `SearchDialog.tsx` (centered 800px at 12vh, max 75vh, focus trap, body scroll lock, 300ms debounce, loading/empty states), `search/VirtualList.tsx` (hand-rolled fixed-height windowing with `scrollRowIntoView` and overscan — no new dependency), `utils/search-results.ts` (pure helpers: row building/grouping, highlight range merge, restore-index clamp, link + meta resolution) covered by 31 unit tests
- **Presentation**: single-column grouped list with collapsible type headers (Enter/Space or click), title *and* resource-ID keyword highlighting from server match ranges, status/priority pills shared with TaskList/DraftsList via the new `utils/task-badge-colors.ts`, four-locale i18n
- **Keyboard and viewports**: arrow keys move selection, Enter opens; below 640px the dialog goes full-screen with fixed-height two-line rows so virtual scrolling and `visibleStartIndex` restore behave identically
- **Navigation identity**: search targets open as `/task/:id/:slug` for tasks (the `/?highlight=id` route broke back-to-dialog) and as plain pushes for doc/decision/wiki, which are full pages, not modals — `isModalSearchTarget()` gates `backgroundLocation`
- **Feedback rounds**: mask restyled to match the task modal (no blur), invisible placeholder keeps window height while first results load, input font enlarged (28px/32px, ≥16px narrow to avoid iOS focus zoom), local input draft + debounced URL replace to stop caret jitter, sidebar search box converted to a read-only trigger button
- **Known pending**: a full `zh-TW` locale audit (only `searchDialog` terminology unified: 工作 → 任務)

## Acceptance Criteria

- Ctrl+K / Cmd+K opens the dialog from anywhere; the underlying page stays mounted and scroll-locked
- Esc, ×, mask click, and browser back all close the dialog and restore the previous route
- Refreshing or sharing `/search?q=...&type=...` reopens the dialog with query, filter, and results restored
- Browser back re-renders the dialog and restores list scroll via `visibleStartIndex`
- Virtual scrolling stays smooth on large result sets; narrow viewports get full-screen two-line rows

## Related Concepts

- [[concepts/spotlight-search]] — the dialog's route, virtualization, grouping, and scroll-restore model
- [[concepts/web-ui-features]] — Web UI feature catalogue the dialog now belongs to
- [[concepts/search-sequences]] — server-side Fuse search and the type-filter model the dialog consumes
- [[concepts/web-server]] — `/api/search` contract and the SPA static route table
- [[concepts/web-ui-i18n]] — four-locale dictionary the dialog's strings were added to

## Related Sources

- [[sources/sidebar-resize-search-task]] — BACK-483 sidebar search whose 5-result cap this replaces
- [[sources/stable-task-modal-urls-task]] — BACK-509 modal-over-route URL pattern reused here
- [[sources/back-627-back-arrow-history-fix]] — BACK-627 history-stack invariant the dialog exposed
- [[sources/back-628-task-hierarchy-section]] — BACK-628 modal section that followed in the same wave

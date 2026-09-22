---
id: BACK-624
title: Global Spotlight-style search dialog for Web UI
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-11 07:05'
updated_date: '2026-09-12 06:32'
labels:
  - web-ui
dependencies: []
priority: medium
ordinal: 227400
actual_start: '2026-09-11 17:09'
actual_end: '2026-09-12 06:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a macOS Spotlight-style centered global search dialog for the Web UI, replacing the current sidebar search that shows at most 5 results (see BACK-483). PRD has been adapted to the project architecture where they conflict: history semantics are implemented via React Router (navigate push/replace/navigate(-1), location.state) instead of raw pushState/replaceState/popstate.

Core constraints: dialog form only (no separate page; underlying page stays mounted with scroll lock), bound to browser route /search, back/forward support, no right preview panel, single-column grouped high-density list, list scroll position memory, keyboard-first operation.

Route: /search with params q (keyword, empty = no input) and type (all | task | doc | wiki | decision).

History behavior (React Router): opening the dialog uses navigate('/search?...') (push) so browser back closes it; typing keywords or switching type filter uses navigate(..., {replace: true}) (no new history entries); location.state (backed by history.state) carries { q, type, visibleStartIndex } where visibleStartIndex is the virtual list start index (preferred over pixel scrollTop for stability with large data).

Close behaviors, all unified through navigate(-1): Esc key, × button, mask click, browser back button. Only navigating to a detail page persists scroll position; closing via Esc/×/mask does not.

Layout: horizontally centered, 12vh from top, fixed 800px width, max-height 75vh, dark theme with slight backdrop blur. Row structure: type icon + resource ID + title with keyword highlight + muted status/priority tags. 300ms debounced search, loading and empty states, virtual scrolling for large result sets.

Narrow viewports (< 640px): dialog becomes full-screen (100vw x 100dvh, no rounded corners or mask); rows switch to a fixed-height two-line layout (line 1: title with keyword highlight; line 2: resource ID + muted status/priority tags) so row height stays constant and virtual scrolling plus visibleStartIndex restore keep working unchanged. No free text wrapping inside rows.

Icons: reuse the established search type icons already used in the sidebar search dropdown - a magnifier for the all-types row, a clipboard for tasks, a document for docs, a shield for decisions, and a book for wiki pages.

Non-goals: no right preview panel, no fullscreen search page, no in-dialog editing of tasks/docs, no local search history/favorites.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ctrl+K (Win/Linux) and Cmd+K (Mac) open the centered dialog from anywhere in the web UI; the underlying page is scroll-locked and stays mounted
- [x] #2 Dialog is bound to /search with q and type params: opening uses pushState so browser back closes it; typing or switching type filter uses replaceState without growing the history stack
- [x] #3 Esc, × button, mask click, and browser back all close the dialog and restore the previous route
- [x] #4 Results render as a single-column grouped list (tasks/docs/wiki/decisions) with keyword highlight, no preview panel, and no 5-result cap
- [x] #5 Arrow keys move the selection and Enter opens the selected item; returning via browser back re-renders the dialog and restores the scroll position via visibleStartIndex
- [x] #6 Refreshing /search?q=... or opening a shared link reopens the dialog with query, filter, and results restored
- [x] #7 Virtual scrolling keeps rendering smooth with large result sets and exposes scrollToIndex for position restore
- [x] #8 On viewports below 640px the dialog renders full-screen with fixed-height two-line rows (title, then ID + tags); virtual scrolling and scroll position restore behave the same as desktop
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
No API/server changes needed: GET /api/search (src/server/index.ts:944-1068) already supports unlimited results (omit limit), type filter (task|document|decision|wiki), wiki content search, and returns SearchMatch indices for keyword highlight. The 5-result cap is client-side only (SideNavigation.tsx:944-957).

Design decision: implement the PRD's History semantics through React Router v7 instead of raw pushState/popstate (none exist in the codebase): open = navigate('/search?...') (push), typing/filter switch = navigate(..., {replace: true}) (replace), all four close paths = navigate(-1). popstate is handled by the Router; history.state maps to location.state carrying { q, type, visibleStartIndex }. No new dependencies: fixed row heights allow a small hand-rolled virtual list.

1. Route shell: register a top-level modal-style /search route in src/web/App.tsx (same modal-over-route pattern as task/:id/*, underlying page stays mounted). Route element renders SearchDialog when location.pathname === '/search'; q/type read from URL search params.
2. Global shortcut: rewire the existing Cmd/Ctrl+K handler (SideNavigation.tsx:867-882) from focusing the sidebar input to navigating to /search; do not add a second keydown listener. Keep the sidebar search untouched.
3. SearchDialog component (src/web/components/search/SearchDialog.tsx): centered, 12vh top, 800px wide, max-height 75vh, dark blur mask, body scroll lock (reuse overflow-lock pattern from Modal.tsx:17-37), input auto-focus, focus trap (new — no existing utility), Esc / x button / mask click all close via navigate(-1). Narrow viewport (<640px): full-screen, fixed-height two-line rows.
4. Type filter tabs (all/task/doc/wiki/decision) reusing the established sidebar icons; add all strings to the 4 locale files (src/web/locales/{en,zh-CN,zh-TW,ja}.ts).
5. Results: call apiClient.search (src/web/lib/api.ts:204) with no limit and mapped types; debounce 300ms via a small new useDebouncedValue hook. Group by type with counts; row = icon + resource ID + title highlighted from server SearchMatch.indices + muted status/priority; loading, empty, and no-match states.
6. Virtual list: hand-rolled windowing (fixed row height, window + overscan, scrollToIndex exposed). Row height constant per viewport mode so visibleStartIndex restore stays valid.
7. Keyboard nav: up/down move selection (throttled), Enter stores visibleStartIndex then navigates to the detail route using the existing URL helpers (src/web/utils/urlHelpers.ts; targets as in SideNavigation.tsx:1141-1219: task -> /?highlight=id, doc -> /documentation/:id/:slug, decision -> /decisions/:id/:slug, wiki -> /wiki/:path).
8. Scroll memory: debounced replace of location.state.visibleStartIndex while scrolling; on back-popstate re-entry wait for list render then scrollToIndex(saved index), fallback to top when index out of range. Esc/x/mask close paths must NOT persist scroll state — only Enter-to-detail updates it.
9. Race safety: sequence-counter guard so a stale debounced response cannot overwrite newer results.
10. Verification: bunx tsc --noEmit, bun run check ., bun test (unit tests for grouping/highlight/index-restore helpers); then manual pass against all 8 acceptance criteria including refresh/share-link reopen and history-stack behavior (type a lot, press back once -> dialog closes immediately).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
No API changes needed as predicted: GET /api/search already supports unlimited results, type filter, wiki search, and SearchMatch indices for highlight. One unavoidable server touch: added /search and /search/* to the SPA static route table so refresh/shared links do not 404 (AC #6); no handler logic changed.

Smoke-test findings that adjusted the plan: (1) task results link directly to /task/:id/:slug instead of /?highlight=id, because the highlight route bounces through BoardPage into a task push and browser back then landed on / instead of reopening /search, breaking AC #5; (2) full suite had 1 timing flake in ContentStore document-move test while the dev server was running — passes in isolation (16/16), unrelated to this change.

Validation: bunx tsc --noEmit clean; bun run check . passes (3 pre-existing warnings in src/core/assets.ts untouched); bun test 2231 pass incl. 20 new unit tests for search-results helpers; real-browser smoke test covered all 8 ACs.

Post-completion fixes (user feedback rounds):
1. Fixed filter tab row clipped by input (flex shrink-0 on header rows).
2. ID keyword highlight: getIdMatchIndices renders <mark> on resource IDs (e.g. 411 in BACK-411), incl. wiki path offset; +6 unit tests.
3. Task/draft modal opened from search now closes back to the search dialog with q/type/visibleStartIndex intact (openItemAt passes backgroundLocation=location; handleCloseModal carries background state through).
4. Sidebar search box converted to a read-only trigger button (its label is the localized word for "search" followed by `(⌘K)`) that opens the dialog; inline sidebar search/dropdown removed.
5. Collapsible result groups: header rows toggle collapsed (click or Enter/Space), collapsed groups excluded from virtual rows so next group is directly visible; state resets on query/filter change; +3 unit tests. 29 search-results tests, full suite 2241 pass.

Round 4 navigation fixes (done directly, subagent lock was stuck):
6. Bug A: document/decision/wiki results changed URL but never rendered — isModalSearchTarget() now attaches backgroundLocation only for task (modal overlay routes); doc/decision/wiki get a plain push so the full-page route renders. Back returns to /search.
7. Bug B: task modal close used replace-to-background, accumulating duplicate /search history entries (N task opens -> N+1 clicks to close the dialog). handleCloseModal now pops (navigate(-1)) when state.backgroundLocation exists; replace fallback only for direct-loaded modal URLs without background.
8. Mask aligned with task modal: bg-black/40 dark:bg-black/60, backdrop blur removed (user decision).
Verified: tsc clean, Biome clean (3 pre-existing warnings), 31 search-results unit tests pass. Browser re-verification pending user confirmation.

Round 5-8 polish (user feedback):
9. Mask restyled to match task modal (bg-black/40 dark:bg-black/60, backdrop blur removed) — user decision overriding PRD's frosted-glass spec.
10. Dialog height: fixed-height experiment reverted; instead an invisible same-size placeholder keeps the empty-state height while first results load, so the window no longer collapses when typing starts. 'Searching' indicator moved from input row to an overlay badge at the results area top-right (no layout shift).
11. Input font sized up per user request: 28px desktop / 32px narrow (also keeps narrow >=16px to avoid iOS focus zoom).
12. Task status/priority render as colored pills identical to TaskList; color logic deduplicated into shared src/web/utils/task-badge-colors.ts (TaskList + DraftsList now import it).
13. zh-TW searchDialog terminology unified with the sidebar (its word for a task now matches the sidebar's). NOTE: a full-file zh-TW audit was requested but interrupted before starting - still pending.
14. Input cursor jitter fixed: keystrokes update a local draft synchronously; URL replace is debounced 300ms (buildSearchUrl helper). Flush before opening a result, timer cleared on unmount/external navigation.
15. SearchTypeIcon normalizes sidebar SVGs (hardcoded w-4/w-5) into the requested box with flex centering — fixes vertically off-center filter tab icons.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a macOS Spotlight-style global search dialog for the Web UI (BACK-624), iterated through 8 rounds of user feedback.

Core: centered 800px dialog at 12vh (max 75vh), /search modal-over-route bound to React Router (push on open, replace on type/filter/scroll, navigate(-1) for all close paths), location.state carries { q, type, visibleStartIndex } with virtual-list scroll restore on back; hand-rolled fixed-height VirtualList (no new deps); grouped results with collapse/expand group headers; full keyboard nav; focus trap; narrow viewport (<640px) full-screen with two-line rows; 4-locale i18n.

Feedback-driven refinements: task modal close pops instead of replace (no duplicate /search history entries); doc/decision/wiki results navigate as full pages (backgroundLocation only for modal targets); task modal close returns to the dialog with state intact; sidebar search box converted to a read-only trigger; ID matches highlighted; colored status/priority pills shared with TaskList via task-badge-colors.ts; mask matches task modal (no blur); loading keeps window height via invisible placeholder; input uses local draft + debounced URL sync (caret stable); filter icons vertically centered.

Server: only /search added to SPA static routes. No API logic changes.

Verification: tsc clean, Biome clean, bun test green (31 search-result unit tests); browser-verified across rounds. Known pending: full zh-TW locale audit (interrupted before it started).
<!-- SECTION:FINAL_SUMMARY:END -->

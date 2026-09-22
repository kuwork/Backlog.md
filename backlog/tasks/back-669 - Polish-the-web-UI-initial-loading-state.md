---
id: BACK-669
title: Polish the web UI initial loading state
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-30 21:48'
updated_date: '2026-09-20 04:57'
labels: []
dependencies: []
references:
  - src/web/components/BoardLoadingSkeleton.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/LoadingSpinner.tsx
  - src/web/App.tsx
  - src/test/web-board-loading-skeleton.test.tsx
  - src/test/web-side-navigation-loading.test.tsx
  - src/test/web-task-deep-link.test.tsx
modified_files:
  - src/web/App.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardLoadingSkeleton.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/LoadingSpinner.tsx
  - src/test/web-board-loading-skeleton.test.tsx
  - src/test/web-side-navigation-loading.test.tsx
  - src/test/web-task-deep-link.test.tsx
actual_start: '2026-09-20 04:48'
actual_end: '2026-09-20 04:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replaces the pre-first-load loading state with a compact, design-consistent indicator (PR #977, "the old ugly square").

Root cause in this fork: `src/web/styles/source.css` deliberately excludes `rounded-full` from the compiled Tailwind CSS (`@source not inline("{rounded-full}")`, project utility is `rounded-circle`), so the board's first-load spinner rendered as a spinning bordered SQUARE inside a plain gray box. The app's pre-init screen was still bare "Loading..." text. The reported "giant ~13k px SVG" does not reproduce here: no unconstrained inline SVG exists in the loading path (every icon carries `w-*/h-*`); the measurement matches the unstyled dev shell before the stylesheet applies.

The fork already had the post-first-load gating from BACK-668 (`hasLoadedDataRef`), so this task is only about the two pre-first-load surfaces: the app pre-init screen and the board's own loading branch.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.50.1..v1.52.0 --grep BACK-665` and `git show 65e9371c5` (PR #977 squash; earlier states: `0af430e4c`, `bd1be48ab`)
- [x] #2 The `isInitialized === null` screen shows the shared `LoadingSpinner` ring (no visible copy, sr-only label from the active locale) in both themes, instead of the bare "Loading..." text
- [x] #3 The board's first-load branch renders `BoardLoadingSkeleton` with the configured status count (`statuses.length`, three ghost columns as the pre-config fallback)
- [x] #4 Ghost columns mirror the real column chrome (`flex-1 min-w-[16rem]` wrapper, `rounded-lg p-4 min-h-24` card, `animate-pulse` placeholders that honour `motion-reduce`) and are hidden from assistive tech
- [x] #5 The loading path never uses the dead `rounded-full` class; the ring is `rounded-circle` with `motion-reduce:animate-none` and renders as a circle
- [x] #6 The skeleton announces itself only through `role="status"` + the localized `t.board.loading` label; no hardcoded copy and no duplicated progress sentence (the header chip owns that since BACK-668)
- [x] #7 Board/BoardPage no longer carry the now-unused `loadingMessage` prop, and `Board.tsx` drops its leftover `translateLoadingMessage`/`locale` plumbing; `bunx tsc --noEmit` is clean
- [x] #8 jsdom tests cover the skeleton, the BoardPage loading state and the pre-init screen, and each new behaviour has a revert probe that turns red when the change is undone
- [x] #9 Verified on the real machine (source server + headless Chrome, cold start): skeleton and pre-init ring render in both themes, and the board's content replaces the ghosts without touching the loading path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Root cause (fork-verified): `rounded-full` is excluded from the compiled CSS (`src/web/styles/source.css:5`; `rounded-circle` is the project utility). The board's first-load spinner used it, so it rendered as a spinning bordered square inside a gray panel; the app pre-init screen was bare "Loading..." text. The reported "~13k px giant SVG" does not reproduce (no unconstrained SVG in the loading path).
2. New `src/web/components/BoardLoadingSkeleton.tsx`: `columnCount` ghost columns using the real board's default (lane-free) geometry - `overflow-x-auto > flex flex-row flex-nowrap gap-4 w-full` with one `flex-1 min-w-[16rem]` per column and a `rounded-lg p-4 min-h-24` card (min-h-24 is TaskColumn's empty floor, so the board never contracts), plus `animate-pulse` placeholders carrying `motion-reduce:animate-none`; all ghosts `aria-hidden`. Centred over them: the compact ring from the BACK-668 chip (`h-5 w-5 animate-spin rounded-circle border-2 border-blue-200 border-t-blue-600`, dark variants, `motion-reduce:animate-none`) and an sr-only `t.board.loading`.
3. Fork divergence: the skeleton takes no `message`. Since BACK-668 the header chip already shows the localized progress sentence, so rendering it in the board too would duplicate the same line on screen; the skeleton stays copy-free (`role="status"` + `aria-label`/sr-only only). `aria-label`/sr-only come from `t.board.loading` instead of a hardcoded "Loading tasks".
4. `Board.tsx`: the `isLoading` branch becomes `<BoardLoadingSkeleton columnCount={statuses.length} />`; the dead `loadingMessage` prop, the `translateLoadingMessage` import and the unused `locale` are removed (the board stopped receiving the message in BACK-668). `BoardPage.tsx` drops the same dead prop from its interface and pass-through.
5. `App.tsx`: the `isInitialized === null` screen renders `<LoadingSpinner size="md" text="" />` plus an sr-only `t.nav.projectLoading` (reusing the key the sidebar placeholder freed in BACK-668) under `role="status"`. `LoadingSpinner.tsx` gains `motion-reduce:animate-none`.
6. Gating from BACK-668 untouched: `hasLoadedDataRef` still keeps mid-session indexing frames from flipping the blocking skeleton back on; the header chip remains the only mid-session loading signal.
7. Tests: new `src/test/web-board-loading-skeleton.test.tsx` (6 cases: status semantics, geometry, floor height, configured/fallback column counts, localized label, no `rounded-full`); `web-side-navigation-loading.test.tsx` asserts the BoardPage loading surface and that the real board replaces it; `web-task-deep-link.test.tsx` asserts the board skeleton while the first search is gated and that a new pre-init case shows only the copy-free ring (with the `/api/status` call held open).
8. Verify: `bunx tsc --noEmit`, `bun run check .`, scoped `bun test`; per-change revert probes; real-machine check on the source server (headless Chrome, cold start, light + dark screenshots).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fork reality before this change: the board's `isLoading` branch was a self-drawn gray panel with a dead `rounded-full` spinner (rendered as a square) plus three flat `h-24` gray blocks that did not match the real column geometry; the app pre-init screen was bare "Loading..." text. Both surfaces are now polished without touching the board layout (the fork's lane/grid branch is untouched - only the loading branch renders something else).

Divergence recorded in doc-12/doc-13: (a) the skeleton has no `message` prop and never renders the progress sentence - the header chip has owned that since BACK-668, so a second copy on the same screen would just be noise; (b) labels come from i18n (`t.board.loading`, `t.nav.projectLoading`) rather than hardcoded English; (c) dropping the dead `loadingMessage` prop from Board/BoardPage was part of this change instead of being left as unused plumbing.

Real-machine measurements (source server `bun src/cli.ts browser -p 6467 --no-open`, headless Chrome, `/api/status` and `/api/search` held via the Fetch domain so each state could be captured):
- Pre-init screen: ring `border-radius: 9999px`, 24x24 px, no `<p>`, sr-only text follows the project locale (the localized "Loading..."); screenshots in both themes.
- Board skeleton: `role="status"`, `aria-label` carrying the localized "Loading tasks..." (locale-driven), ring 20x20 with `border-radius: 9999px`, three ghost columns at x=336/685/1035, width 333, height 96 (= `min-h-24`, the real empty-column floor), card radius 8px (`rounded-lg`), 6 pulse blocks; screenshots in both themes.
- Headless Chrome reports `prefers-reduced-motion: reduce`, so the computed `animation-name` is `none` for both rings - which also demonstrates the `motion-reduce:animate-none` variant is compiled and applied.
- After the load: `skeletonPresent: false`, no spinner left from the loading path, 356 tasks / 13 docs render, board columns land at the same left edge (336) with the same order of magnitude chrome. Two measured deltas are data-driven and pre-existing, not caused by the skeleton: the column row's `top` moves 162 -> 210 px because the filter bar wraps once assignee/label data arrives, and the container is 10 px narrower because the loaded board's own scroll container gains a vertical scrollbar (content 48k px tall).

Verification: 7 revert probes (dead `rounded-full` ring, dropped `min-w-[16rem]`, 1-column fallback, `min-h-96` ghosts, fixed `columnCount={3}` in Board, `motion-reduce` removed from `LoadingSpinner`, pre-init reverted to the "Loading..." text) all turn the corresponding tests red. Gates: `bunx tsc --noEmit` clean, `bun run check .` 426 files with the 3 pre-existing `assets.ts` warnings, scoped `bun test` 20/20 across the four web suites.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Landed the loading-state polish (PR #977) on the fork's two pre-first-load surfaces, with the top-level cause fixed: the dead `rounded-full` utility (excluded from the compiled CSS) made the old board spinner a bordered square.

Added `BoardLoadingSkeleton` (ghost columns in the real column chrome + compact circular ring, `columnCount={statuses.length}`, three-column fallback), pointed the board's `isLoading` branch at it, replaced the app's "Loading..." pre-init text with the shared `LoadingSpinner` ring and an sr-only locale label, and gave that spinner `motion-reduce:animate-none`. Removed the `loadingMessage` prop and its `translateLoadingMessage`/`locale` leftovers that BACK-668 had orphaned on Board/BoardPage.

Fork divergence: the skeleton stays copy-free - the header chip has been the single progress-sentence surface since BACK-668 - and all labels come from i18n. BACK-668's `hasLoadedDataRef` gating is untouched, so only the pre-first-load window shows the skeleton.

Verified with 6 new jsdom cases plus updated BoardPage/deep-link coverage, 7 revert probes all red, `tsc`/`biome` clean, and a cold-start real-machine pass in light and dark (ghost geometry matches the real column floor and chrome; ring computes to a 9999px radius).
<!-- SECTION:FINAL_SUMMARY:END -->

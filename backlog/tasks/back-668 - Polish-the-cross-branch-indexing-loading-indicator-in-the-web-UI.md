---
id: BACK-668
title: Polish the cross-branch indexing loading indicator in the web UI
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-30 11:55'
updated_date: '2026-09-20 04:38'
labels: []
dependencies: []
references:
  - src/web/components/BranchIndexingIndicator.tsx
  - src/web/components/Navigation.tsx
  - src/web/components/Layout.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/App.tsx
  - src/web/styles/source.css
  - src/utils/loading-messages.ts
  - src/test/web-branch-indexing-indicator.test.tsx
modified_files:
  - src/web/App.tsx
  - src/web/components/BranchIndexingIndicator.tsx
  - src/web/components/Layout.tsx
  - src/web/components/Navigation.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/styles/source.css
  - src/test/web-branch-indexing-indicator.test.tsx
  - src/test/web-side-navigation-loading.test.tsx
  - src/test/web-task-deep-link.test.tsx
actual_start: '2026-09-20 04:12'
actual_end: '2026-09-20 04:37'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The cross-branch indexing progress was already on screen — the server's phase line (`Loading tasks from local branches...`, `Indexing 3 other local branches...`) reaches the web UI as `loadingMessage` and was rendered verbatim in four places: the board's loading panel and three spots in the sidebar. It arrived with two costs. Every `loading` frame flipped `isLoading` back on, so a refresh that started while data was on screen replaced the board and the documents and decisions trees with skeletons and the page had to wait for them to come back; and the same long line jumped in all four places at once (counts changing, trees dropped and rebuilt), which read as flicker rather than progress.

The indicator now lives in one place — a chip in the header, with a hairline sweep along the header's bottom border — and keeps the detail: the chip's label is the phase line itself, translated through the same `loadingPhrases` table the sidebar and board sentences used, so `正在索引 3 个其他本地分支...` stays readable while it runs. What moved is the place, not the information.

The content underneath no longer gives way: once the first load has succeeded, a later indexing frame leaves the loaded board and trees mounted and interactive, and the chip is the only loading signal left. Appearance is delayed — a phase that finishes inside the window mounts nothing at all — and the exit is a short fade before unmount, so short phases never flash.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-654` and `git show f52b190c6`, and confirm each stated change against the fork before porting it - the CSS block is ported byte for byte, while the chip's label keeps the fork's own wording.
- [x] #2 The indexing state shows as a chip in the header plus a hairline sweep along the header's bottom border, and the four raw sentence places it replaces (the board loading panel, the tasks caption, the documents and decisions lists) no longer render the phase line.
- [x] #3 The chip's visible label is the real progress line translated through the existing `loadingPhrases` table, with an unmatched phase falling back to the raw server line and the full line available as the tooltip when the label is truncated; no new locale key is added for it.
- [x] #4 Once the first load has succeeded, a later indexing frame leaves the board and the sidebar trees mounted and interactive instead of replacing them with skeletons.
- [x] #5 The indicator mounts only after the phase has persisted - a phase that completes inside the appear window mounts nothing - and fades out before unmounting when indexing completes.
- [x] #6 Consecutive progress messages keep the indicator mounted and swap its label rather than restarting the appear window.
- [x] #7 `bunx tsc --noEmit`, `bun run check .` and the touched suites pass, every new case was first confirmed red against the reverted change, and the indicator was checked live on the source server in both themes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. New `src/web/components/BranchIndexingIndicator.tsx`: a status chip plus a hairline sweep bar along the header's bottom border, driven by a delayed-appear / fade-out state machine (both delays are props, so tests can use short values). The chip's visible label is the progress line run through `translateLoadingMessage`, truncated at `max-w-[16rem]` with the full line kept as the tooltip.
2. Add the `indexing-sweep` keyframes and the `animate-indexing-sweep` utility next to the existing `slide-in-down` block in `src/web/styles/source.css`, ported from upstream byte for byte.
3. `Navigation.tsx` gains an optional `loadingMessage` prop and renders the indicator in its right-hand cluster; `Layout.tsx` passes the message through. No new i18n keys: the chip reuses the existing `loadingPhrases` entries, so the four locale files stay untouched.
4. `SideNavigation.tsx` drops the `loadingMessage` prop and its three sentence placeholders become pure skeletons; `App.tsx` stops handing `loadingMessage` to the board, so the board panel keeps its own generic caption.
5. `App.tsx`: a mid-session `loading` frame no longer sets `isLoading` once the first load has succeeded (`hasLoadedDataRef`), so loaded content stays mounted and interactive while indexing runs; the initial load keeps today's behaviour.
6. Tests: new `src/test/web-branch-indexing-indicator.test.tsx` covering the appear delay, the visible real progress line (raw and translated), the fast-completion case, the fade-out unmount and consecutive messages; `web-task-deep-link.test.tsx` drives the indicator from the socket frames and checks that loaded content survives a later frame; `web-side-navigation-loading.test.tsx` is updated for the removed sentence.
7. Verify: `bunx tsc --noEmit`, `bun run check .`, the scoped suites, then a live pass on the source server with headless Chrome — catching the cold-start window, in both themes.

Review outcome (2026-09-20): the chip keeps the real progress line as its visible label instead of upstream's fixed "Indexing branches" caption. The maintainer wants the branch-loading detail readable at a glance, the way the four sentence placeholders made it, and the full line also stays as the tooltip for the truncated case.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Indicator

- `BranchIndexingIndicator` renders two siblings: a `role="status"` chip in the header's right cluster and a 2px sweep track pinned to the header's bottom border (`inset-x-0 bottom-0`, `pointer-events-none`, hidden under `motion-reduce`). The chip mounts only after the phase line has persisted (`appearDelayMs`, default 250ms), so a phase that finishes inside that window mounts nothing and never flashes; on completion it goes inactive (opacity plus a 2px rise) and unmounts after `exitDurationMs` (default 200ms), so the exit is a fade rather than a pop. `lastMessageRef` keeps the line through the exit, so the label cannot blank out mid-fade.
- The chip's visible label is the real progress line - `translateLoadingMessage(message, locale)` - not a generic caption. That is the fork's deliberate divergence from upstream (below), and it means the header carries `正在索引 3 个其他本地分支...` while the phase runs. The line is truncated at `max-w-[16rem]`; the untruncated line stays as `title`, so hovering shows it in full.
- No locale keys were added: the chip reuses the `loadingPhrases` table that `src/utils/loading-messages.ts` already maps the Core phase strings onto, so `en`/`zh-CN`/`zh-TW`/`ja` are untouched and an unmatched phase falls back to the raw server line.

Wiring

- `Layout.tsx` hands `loadingMessage` to `Navigation.tsx`, which renders the indicator before the theme toggle. The header already carried `relative` and `z-20`, so the sweep track needed no new positioning.
- `SideNavigation.tsx` lost the `loadingMessage` prop: its three placeholders (`LoadingPhase`) are now pure `animate-pulse` skeletons, and the tasks caption no longer carries the phase sentence. `translateLoadingMessage` and the `locale` binding went with it.
- `Board.tsx` is untouched: `App.tsx` simply stops passing `loadingMessage`, so the panel's optional prop stays unset and it renders its own `t.board.loading` caption. That keeps the header chip the only place the phase line shows, with no duplicate sentence on screen.
- `App.tsx` gates the mid-session skeleton on `hasLoadedDataRef`: a `loading` frame only sets `isLoading` before the first successful load. The handler still stores the message, which is what drives the chip, and still clears a stale terminal error so a passive client shows its cached content instead of an obsolete failure.

Divergences from upstream

- Upstream's chip label is a hardcoded English "Indexing branches", with the real line demoted to `title` and an `sr-only` copy. This fork already depended on that line being readable - it was the only progress signal the UI had - so the chip shows the translated line itself and drops the duplicate `sr-only` node. Upstream's intent (a label that does not resize the header) is met by the `max-w-[16rem]` truncation and the tooltip rather than by hiding the detail.
- `src/web/styles/source.css` is byte-identical to upstream's post-654 blob (`207bdc42f`), so future merges see no conflict there; the component is the only file with a deliberate difference.

Verification

- Live check against the source server with headless Chrome over CDP. The phase frames only exist while the content store is being built - `content-store.ts:604-612` passes a progress callback on the initial load, the refresh path at `:752` does not - so the run restarts the server and catches the cold-start window. Captured: the chip mounted with the real line (`正在索引 3 个其他本地分支...`), `opacity-100`, `title` matching, 195px wide, not truncated and inside the header's right edge; the sweep track mounted with the animation present in the compiled CSS (`@keyframes indexing-sweep` plus `.animate-indexing-sweep{animation:indexing-sweep 1.4s ease-in-out infinite}`); the frozen frame was screenshotted in both palettes (`bg-blue-50`/`text-blue-600` and `blue-600/20`/`blue-400`); after `loaded` the indicator is gone, the page text no longer contains the phase line, and 355 tasks plus 13 documents render.
- This host runs dark by default (`prefers-color-scheme`), so the light palette was captured by removing `.dark` from `<html>` while the frame was frozen with `Emulation.setVirtualTimePolicy({policy:"pause"})` - the same freeze is what made the transient chip survive the screenshot round-trip.
- Tests: `web-branch-indexing-indicator.test.tsx` (6 cases) covers the appear delay, the real line raw and in zh-CN, the untranslated fallback, the fast-completion case, the exit fade and consecutive messages; `web-task-deep-link.test.tsx` drives the chip from socket frames, asserts the line appears exactly once in the page text, and checks that already-loaded content stays mounted through a later frame. Probes, each reverted in place and then restored: a fixed generic label fails 4 indicator cases plus the app case; re-adding an `sr-only` copy fails the same 4 (the label would be counted twice); ignoring the appear delay fails the fast-completion case; dropping the `hasLoadedDataRef` gate fails the app case that keeps loaded content mounted.
- Gates: `bunx tsc --noEmit` clean, `bun run check .` clean (426 files, the same three pre-existing `assets.ts` warnings), the three touched suites 13/13.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web UI now shows cross-branch indexing with one polished signal in the header - a chip carrying the real progress line, plus a hairline sweep along the header's bottom border - instead of the same sentence repeated in four places.

The chip's label is the phase line itself, translated through the loading-message table the old placeholders used, so `正在索引 3 个其他本地分支...` stays readable while indexing runs, while the board's loading panel keeps its own generic caption. Appearance is delayed, so a phase that finishes inside the window never flashes; the exit is a fade before unmount, and consecutive messages swap the label without restarting the window.

Content no longer gives way to the loader: once the first load has succeeded, a later indexing frame leaves the board and the sidebar trees mounted and interactive, with the chip as the only loading signal.

Verified live on the source server: the cold-start phase captured in both palettes, the chip sitting inside the header at 195px with no truncation, the sweep animation present in the compiled CSS, and the phase line gone from the page once loading finished. Covered by a new 6-case indicator suite plus the updated deep-link and sidebar cases (13 passing), with every probe listed in the notes confirmed red first. Gates: `bunx tsc --noEmit` clean, `bun run check .` clean.
<!-- SECTION:FINAL_SUMMARY:END -->

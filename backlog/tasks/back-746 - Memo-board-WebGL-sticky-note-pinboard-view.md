---
id: BACK-746
title: 'Memo board: WebGL sticky-note pinboard view'
status: In Review
assignee:
  - '@kimi'
created_date: '2026-10-04 05:51'
updated_date: '2026-10-04 15:07'
labels: []
dependencies: []
modified_files:
  - src/web/components/MemoBoard.tsx
  - src/web/components/MemoCard.tsx
  - src/web/components/MemosPage.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/types.ts
  - src/web/utils/memo-board.ts
  - src/web/utils/memo-board.test.ts
ordinal: 312400
actual_start: '2026-10-04 07:05'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a WebGL pinboard view to the memos page: classic yellow sticky notes with colored pushpins, deterministic slight tilt, curled corners and soft shadows. Coexists with the list stream via ?view=board. No new dependencies (raw WebGL + offscreen 2D canvas texture baking). The board is a fixed, non-scrollable blackboard area with no pan/zoom and a fullscreen toggle. Hovering lifts a note; clicking opens the MemoCard modal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Memos page exposes a list/board switch via ?view=board: board mode hides the composer and the label row, the board fills its container as a fixed area that never scrolls, a fullscreen toggle takes over the container, and when WebGL is unavailable the board shows a fallback message instead of a blank page.
- [x] #2 Each memo's whole look (yellow paper variant, colored pushpin with needle and cast shadow, curled corner, soft drop shadow, handwritten-style ink, date and tags) is baked once into an offscreen 2D canvas and drawn by raw WebGL as one textured quad per note, with no new runtime dependencies; textures are cached per memo id + updatedDate, so editing one memo rebakes only that note.
- [x] #3 A note shows its text in full: the paper height grows with the content and is never clamped to a line count, wrapping is estimated by character width (CJK ~1em, latin ~0.55em), and layout, height estimation and texture baking share wrapEstimate/memoInkDepth so the reserved height always fits the ink.
- [x] #4 The board is a fixed blackboard: no pan or zoom (d3-zoom and the ensureZoomInterrupt workaround removed), world coordinates are CSS pixels, and a drag or a wheel over the canvas leaves the rendering unchanged (verified in a headless browser).
- [x] #5 Notes land deterministically (FNV-1a hash of the memo id), so a reload never reshuffles the board: a base grid of evenly divided cells sized from the note size with generous gaps; a seam layer top-aligned just below the text of the row above, whose paper may cover that row's date/tag footer but never any text (seams without room stay empty); and a corner pile in the bottom-right cell, reserved only when a pile exists (no pile, no empty cell), cascading as one so the stagger survives the board edge and hidden notes stay discoverable.
- [x] #6 Hovering lifts a note and draws it above the others; a press that ends where it started opens the shared MemoCard modal rendered inside the board container, so it stays visible in fullscreen, with the modal title fixed to the note-content label.
- [x] #7 src/web/utils/memo-board.ts is covered by unit tests: deterministic hashing and variants, wrap estimation (CJK breaks anywhere, latin words stay whole), note heights growing with text, tier assignment and board bounds, seam notes never covering base text, pile reservation and cascade, no empty cell when nothing needs the pile, and hit testing that accounts for tilt.
- [x] #8 Board strings (view list/board, WebGL fallback, fullscreen enter/exit, note modal title) exist for en, zh-CN, zh-TW and ja.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a list/board view switch on the memos page via ?view=board; board mode hides the composer and the label row and fills the viewport without scrolling.
2. Extract MemoCard (plus ErrorBanner and date helpers) into its own component shared by the list and the board modal.
3. Pure layout module memo-board.ts: deterministic variant assignment (paper/pin/curl/tilt via FNV-1a hash of the memo id), markdown-stripped ink lines, character-width wrap estimation, ink-depth calculation, three-tier board layout, rotated-rectangle hit test.
4. Three-tier fixed-area layout: a base grid (cells sized from the note size, denser pitch); a seam layer tucked just below the text of the row above so paper may cover date/tag footers but never text; a corner pile in the bottom-right cell, which is reserved only when a pile actually exists (no pile, no empty cell).
5. MemoBoard.tsx: bake each note's full look into an offscreen 2D canvas (paper gradient, drop shadow, curled corner, handwritten-style ink, date, tags, pushpin with needle and cast shadow), upload as a texture, then draw one quad per note with rotation and a hover-grow lift. No pan/zoom: world coordinates are CSS pixels.
6. Render the memo modal inside the board container so it stays visible in fullscreen; modal title fixed to the note-content label.
7. Add i18n strings for en, zh-CN, zh-TW and ja.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions and pitfalls worth remembering:
- The dev server bundles once at startup; restart it after code changes or the browser runs a stale bundle.
- Text wrapping is estimated by character width (CJK ~1em, latin ~0.55em) instead of canvas measurement, so the pure layout and the texture baker always agree on note heights. memoInkDepth is shared by the height estimator and the seam-layer collision rule.
- Pan/zoom (d3-zoom) was removed in review: the board is a fixed blackboard and must not be draggable. This also dropped the ensureZoomInterrupt workaround entirely, which had been the root cause of a blank page when switching to the board.
- The memo modal must live inside the board container: only the fullscreen element's subtree is visible in fullscreen mode.
- Biome flags gl.useProgram as a React hook (useHookAtTopLevel); suppressed with a biome-ignore comment, matching existing repo practice.
- Note textures are cached per memo id + updatedDate, so editing one memo only rebakes that note.

### Files changed

- src/web/utils/memo-board.ts (new): pure board logic - variants from the memo id, ink lines, wrap estimation, memoInkDepth, the three-tier layoutBoard and the rotated hit test.

- src/web/utils/memo-board.test.ts (new): 16 unit tests - hashing, variants, wrapping, heights, tier assignment, seam text-avoidance, pile reservation and cascade, no empty cell when nothing piles, bounds, hit testing with tilt.

- src/web/components/MemoBoard.tsx (new): the WebGL board - texture baking, one quad per note, hover lift, click-to-open modal, fullscreen toggle, dark-mode dimming, WebGL-unavailable fallback.

- src/web/components/MemoCard.tsx (new): MemoCard, ErrorBanner and the date helpers extracted from MemosPage, so the list and the board modal share one card.

- src/web/components/MemosPage.tsx: list/board switch via ?view=board, board mode hides the composer and the label row, the fixed non-scrollable board area, fullscreen handling and memo reloads.

- src/web/locales/en.ts, ja.ts, zh-CN.ts, zh-TW.ts, types.ts: board strings (view list/board, WebGL fallback, fullscreen enter/exit, note modal title).

### Verification

- bunx tsc --noEmit: clean (exit 0).

- bunx biome check on the 10 touched files: clean, no fixes applied. Repo-wide bun run check . still reports the pre-existing CRLF errors in untouched files.

- bun test src/web/utils/memo-board.test.ts: 16 pass, 0 fail.

- bun test src/test/web-memos-page.test.tsx src/test/memos.test.ts: 63 pass, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the memos pinboard (?view=board). Raw WebGL renderer with zero new dependencies: each note's look (yellow paper, colored pushpin, curled corner, shadow, full handwritten-style text) is baked into an offscreen 2D canvas and drawn as one textured quad. Fixed, non-scrollable blackboard area with no pan/zoom and a fullscreen toggle. Three-tier deterministic layout: a dense base grid; a seam layer that may cover date/tag footers but never text (enforced by a shared memoInkDepth estimate); and a corner pile in a reserved bottom-right cell that cascades visibly so hidden notes are discoverable (no pile, no empty cell). Hover lifts a note, click opens the shared MemoCard modal inside the board container (visible in fullscreen, title fixed to the note-content label). i18n for en/zh-CN/zh-TW/ja. Verified: bunx tsc --noEmit, biome on touched files, 16 layout unit tests plus the memo page suite, and headless-Chrome checks (canvas immovable under drag/wheel, fullscreen modal visible, CJK wrapping, tier stacking).
<!-- SECTION:FINAL_SUMMARY:END -->

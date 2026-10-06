---
id: BACK-749
title: 'Pinboard notes: fixed height with ellipsis truncation on overflow'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-06 06:50'
updated_date: '2026-10-06 06:52'
labels:
  - enhancement
  - web-ui
  - memos
dependencies:
  - BACK-746
modified_files:
  - src/web/utils/memo-board.ts
  - src/web/components/MemoBoard.tsx
  - src/web/utils/memo-board.test.ts
priority: medium
ordinal: 314500
actual_start: '2026-10-06 06:10'
actual_end: '2026-10-06 06:45'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The memo pinboard (`/memos?view=board`) originally let each sticky note's paper grow with the memo's length: `estimateNoteHeight` returned `Math.max(min, inkDepth + reserve)`, so a long memo produced a tall note. On review the desired look is a uniform fixed-height note that fills to the paper and clips the rest with an ellipsis - no arbitrary heights, a tidy corkboard grid. This change pins the paper to a constant `NOTE_HEIGHT` (150px) and renders the ink (bold heading + body) into that fixed band via a new pure `layoutInkLines` helper; when the text overflows, the last visible line is trimmed greedily until it fits and an ellipsis appended, and `truncated` is reported. `drawNote` now consumes `layoutInkLines` (injecting `ctx.measureText` for exact width), removing its inline `memoInkLines`/`wrapEstimate` usage. Verified: memo-board suite 19 pass / 0 fail; scoped biome clean.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 Every note renders at the fixed NOTE_HEIGHT (150px) regardless of the memo's length
- [x] #2 Text longer than the paper is truncated: the last visible line is trimmed to fit and an ellipsis is appended
- [x] #3 tsc --noEmit and biome report no issues for the three changed files
- [x] #4 The existing memo-board suites still pass (19 pass / 0 fail)
<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes for the touched TypeScript (scoped memo-board files)
- [x] #2 bun run check . passes for the touched files (scoped biome: 3 files, no fixes applied); repo-wide check still errors only on unrelated pre-existing CRLF files
- [x] #3 bun test src/web/utils/memo-board.test.ts passes (19 pass / 0 fail, 458 expects)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the growing height with a fixed `NOTE_HEIGHT` constant (`NOTE_MIN_HEIGHT` -> `NOTE_HEIGHT`) and make `estimateNoteHeight` return it unconditionally.
2. Add the pure `layoutInkLines(memo, maxWidth, top, bottom, measureWidth)` that lays the bold heading + body into the fixed band, mirroring `wrapEstimate`'s per-line wrap, and truncates the first line crossing `bottom` with an ellipsis; export `approxInkWidth` for canvas-free unit tests.
3. Rewrite `drawNote` to consume `layoutInkLines` (inject `ctx.measureText` via `measureWidth`), with a 4px gap at the heading/body boundary; drop the old inline `memoInkLines`/`wrapEstimate` usage.
4. Add unit tests for the fixed height and for truncation (short text untouched, overflow gets `…` and the last line fits `maxWidth`, no line crosses `bottom`); assert the suite is green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Before: `estimateNoteHeight` returned `Math.max(NOTE_MIN_HEIGHT, memoInkDepth(memo) + reserve)`, so paper height scaled with content. After: `estimateNoteHeight` returns `NOTE_HEIGHT` (150) always; `inkBottomOf` clamps to `note.y + note.h / 2` so seam/gap placement sees the fixed bottom. `layoutInkLines` rebuilds the segment list (bold title lines from `wrapEstimate(title, ..., titleFontSize)`, then body lines from `wrapEstimate` per source line at `bodyFontSize`); it walks from `top`, and on the first segment whose `cursor + lineHeight > bottom` it trims `seg.text` one char at a time until `measureWidth(`${trimmed}…`, fontSize, bold) <= maxWidth`, pushes `{...seg, text: trimmed + "…"}`, sets `truncated = true`, and stops. `drawNote` injects `ctx.measureText` through the `measureWidth` callback so the baker and the unit test share one wrapping/truncation path; `approxInkWidth` reproduces `textWidthUnits` for tests without a live canvas. The 4px title/body gap is applied once at the boundary (inside `layoutInkLines` advancing `cursor`, and again in `drawNote` advancing `drawY`) so the measured and drawn layouts agree.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pinned the pinboard note paper to a constant `NOTE_HEIGHT = 150` and made overflow truncate with an ellipsis. `src/web/utils/memo-board.ts`: renamed `NOTE_MIN_HEIGHT` -> `NOTE_HEIGHT` (exported); `estimateNoteHeight` now returns `NOTE_HEIGHT`; `inkBottomOf` clamps to the fixed bottom; added pure `layoutInkLines(memo, maxWidth, top, bottom, measureWidth)` returning `{ segments, truncated }` and `approxInkWidth` for tests. `src/web/components/MemoBoard.tsx`: `drawNote` now calls `layoutInkLines` (injecting `ctx.measureText`), draws each segment (bold heading + regular body) with a 4px gap at the boundary, removed the inline `memoInkLines`/`wrapEstimate` usage. `src/web/utils/memo-board.test.ts`: `estimateNoteHeight` cases assert the fixed height; added a `layoutInkLines` block (short memo keeps all lines / overflow gets `…` with the last line <= maxWidth / no line crosses bottom). Verification: `bun test src/web/utils/memo-board.test.ts` -> 19 pass / 0 fail (458 expects); scoped biome on the three files: checked, no fixes. Change left uncommitted for the user to commit, per convention; the board needs a dev-server restart to pick up the new bundle.
<!-- SECTION:FINAL_SUMMARY:END -->

## Files Changed

- `src/web/utils/memo-board.ts` — fixed-height constant + pure `layoutInkLines`/`approxInkWidth`; `estimateNoteHeight` now constant; `inkBottomOf` bottom clamp.
- `src/web/components/MemoBoard.tsx` — `drawNote` consumes `layoutInkLines` (injected `ctx.measureText`); removed inline `memoInkLines`/`wrapEstimate` usage; 4px heading/body gap.
- `src/web/utils/memo-board.test.ts` — `estimateNoteHeight` fixed-height assertions; new `layoutInkLines` truncation block.

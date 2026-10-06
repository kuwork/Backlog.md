---
id: BACK-751
title: Auto-link entity ID ranges and slash-lists as a clickable dropdown selector
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-06 08:18'
updated_date: '2026-10-06 09:22'
labels:
  - web-ui
  - enhancement
  - markdown
dependencies:
  - BACK-614
references:
  - src/web/utils/task-id-links.ts
  - src/web/contexts/TaskIdIndexContext.tsx
  - src/web/components/MermaidMarkdown.tsx
modified_files:
  - src/web/utils/task-id-links.ts
  - src/web/utils/task-id-links.test.ts
  - src/web/components/EntityIdRangeDropdown.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/MemosPage.tsx
  - src/web/components/SideNavigation.tsx
  - src/web/utils/memo-board.ts
  - src/web/utils/memo-board.test.ts
  - src/test/mermaid-markdown.test.tsx
  - src/test/web-memos-page.test.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
priority: medium
ordinal: 314502
actual_start: '2026-10-06 08:23'
actual_end: '2026-10-06 09:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-614 auto-links single bare entity IDs (BACK-123, doc-9, decision-1, DRAFT-104) in web markdown. A common follow-up is referencing many entities at once — a release note touching BACK-715 through BACK-747, or a cluster BACK-743/744/745 — which today stay as plain text.

Extend the BACK-614 render-side auto-linker to recognize two multi-ID patterns sharing one entity kind/prefix: a range BACK-715~747 (inclusive endpoints) and a slash-list BACK-743/744/745 (arbitrary count). The matched token renders as a single clickable trigger; clicking opens a dropdown listing each resolved entity as a navigable link. Entry count is unrestricted — the dropdown must stay usable for dozens of entries (e.g. a 33-item range).

Supported kinds reuse the BACK-511/BACK-614 short-alias system (task, document, decision, draft). Wiki [[wikilink]] is out of scope. Fail-closed like BACK-614: unknown or mixed-kind segments stay plain text; empty index links nothing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A BACK-715~747 range in web markdown renders as a single clickable trigger (not 33 separate links)
- [x] #2 A BACK-743/744/745 slash-list renders as a single clickable trigger
- [x] #3 Clicking the trigger opens a dropdown listing each resolved entity with a link to its detail route
- [x] #4 A slash-list whose IDs do not all resolve (or that mix kinds) stays plain text (fail-closed). A range needs both endpoints to resolve to the same kind; only locally-present IDs are listed, and if none in the span resolve the token stays plain text.
- [x] #5 Tokens inside inline code / fenced code blocks are not linkified
- [x] #6 Existing markdown links that contain such tokens keep their original target
- [x] #7 The dropdown handles an arbitrary number of entries (e.g. a 33-item range) in a scrollable / capped-height container
- [x] #8 Dropdown rows are keyboard-navigable (Arrow / Enter / Esc) and close on outside click
- [x] #9 Clicking a dropdown entry with unsaved edits in the host modal asks for confirmation before leaving
- [x] #10 Document / decision / draft ranges and lists also link (same short-alias system)
- [x] #11 Zero-padding / case / prefix variants canonicalize like BACK-614
- [x] #12 No new API calls; existing list-endpoint sorting / params / pagination unchanged; single-ID linking still works
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend src/web/utils/task-id-links.ts: add range/list detection and resolution helpers. A slash-list requires every listed ID to resolve to the same kind (else fail-closed). A range requires both endpoints to resolve to the same kind; only locally-present IDs in the span are listed, and if none resolve the token stays plain text. Reuse existing canonicalization for case, zero-padding, and prefix variants. Export `parseMultiIdToken` and `resolveEntityRangeToken`.
2. Extend the remark plugin (`splitEntityIds`) to detect a multi-ID token at the head of a candidate; emit a single `link` node whose href is `entity-range:<kind>:<token>` (carrying the resolved entity list indirectly via re-resolution). Code blocks and existing links are skipped, and boundary rules (preceding/following reject) keep prose intact.
3. Add src/web/components/EntityIdRangeDropdown.tsx: a trigger button plus a popover that is portalled to `document.body` with `position: fixed` and a high z-index so it is never clipped by the markdown container. Row list (ID and title) are anchored `<a>` elements using the same singular routes as BACK-614; keyboard nav (Arrow/Enter/Esc), outside-click and scroll/resize close, and modifier/middle clicks fall through for a new tab.
4. In src/web/components/MermaidMarkdown.tsx, intercept `entity-range:` hrefs in `LinkComponent` and render `<EntityIdRangeDropdown>` (re-resolving the token against `useTaskIdIndex()`), passing the existing `onTaskClick`/`onDocClick`/etc. handlers and a new `confirmNavigation` prop.
5. Reuse the BACK-614 unsaved-edits guard for dropdown entries via the `confirmNavigation` prop threaded from the host modal.
6. Add util tests (parse + resolve, range/list/fail-closed/zero-padding/kind coverage) and a remark-plugin integration test (single link node for range and list, plain text when unresolvable, skipped inside existing links); then run tsc, check, and bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Delivered behaviour

Clicking a `BACK-715~747` range or a `BACK-743/744/745` slash-list opens a portalled dropdown that lists every locally-resolvable entity; picking one navigates in-app. The same works for doc-/decision-/draft- prefixed tokens through the shared short-alias system.

### Render side

- `splitEntityIds` gained a multi-ID branch that emits one `link` node with href `entity-range:<kind>:<token>`; the list is re-resolved at render time, so the link node stays small and never goes stale in a stale index.
- A range is fail-closed on both endpoints (same canonical kind required) and only lists IDs present in the local index; if nothing in the span resolves the token stays plain text.
- A slash-list is all-or-nothing: every ID must resolve to the same kind, else the whole token stays plain text.
- Code spans / fenced blocks and pre-existing markdown links are untouched, matching BACK-614 boundary rules.

### Dropdown surface

- `EntityIdRangeDropdown` renders `createPortal` -> `document.body`, `position: fixed`, `z-[9999]`, so it is never clipped by the markdown container or a host modal.
- Placement: measured after mount; `maxWidth` takes the larger of the two horizontal rooms and clamps to `innerWidth - 2*EDGE_MARGIN`, so a trigger at the right edge still gets a usable single-line-wide menu and flips to the trigger's left when it would overflow the right edge.
- `minWidth` is a fixed 200 (not the trigger's rendered width — that was what stretched a one-line menu into a tall empty bar). Row IDs are `whitespace-nowrap`; titles wrap normally, so the menu only becomes multi-line when the window is genuinely narrow.
- Theme colouring reads `document.documentElement.classList.contains("dark")` via a `MutationObserver` (local `useIsDark`), not the React theme context: the dropdown portals outside any `ThemeProvider` and a context lookup there silently falls back to light (and, when the provider was removed, crashed the whole memo card).
- Close policy: outside mousedown + resize. The capture-phase `scroll` listener was removed — it killed the menu on the first wheel tick before the popover's own scroll could happen.
- Entry click with an in-app handler calls `preventDefault` and does an SPA navigation; without one it falls through to native same-tab navigation (no new tab).

### Folded-in follow-ups (same ticket)

- Memos default view: after the first feed load, `view=board` is applied when a bare `/memos` has content and `view=list` otherwise; an explicit `view` or a date filter is never overridden.
- Memos sidebar icon: `Icons.Memo` replaced with the supplied 1024-grid `fill="currentColor"` two-path glyph, matching the other iconfont icons in `SideNavigation`.
- Pinboard note ink overflow: `wrapEstimate` now accepts the baker's real `measure` (with the `bold` flag) and `layoutInkLines` passes it, so line breaks are computed from the same glyph widths the canvas draws — the previous estimate-vs-real mismatch is what let a line spill past the paper's right edge. `clampLine` hard-truncates any remaining over-wide line with an ellipsis as a safety net.

### Verification

- `bun test src/web/utils/memo-board.test.ts src/test/mermaid-markdown.test.tsx src/test/web-memos-page.test.tsx src/web/utils/task-id-links.test.ts` -> 253 pass / 0 fail.
- `memo-board.test.ts` includes a regression that feeds a 1.2x-wide measure to simulate a wider handwriting font and asserts every laid line fits `maxWidth`.
- `mermaid-markdown.test.tsx` asserts `see BACK-715~747 and BACK-743/744/745` renders two menu triggers and leaks no `entity-range:` scheme.
- `web-memos-page.test.tsx` covers the empty -> list and content -> board defaults.
- `bunx biome check` on every touched file is clean; `bunx tsc --noEmit` reports zero errors under `src/` (remaining repo errors are only in the unrelated `mikesigs/`, `myran/`, and `tmp/` fork checkouts).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended the BACK-614 render-side auto-linker with two multi-ID patterns that share one entity kind: a range (`BACK-715~747`) and a slash-list (`BACK-743/744/745`). Both now render as a single trigger whose click opens a portalled dropdown of every locally-resolvable entity, each row navigating in-app to its detail route. Ranges are fail-closed on both endpoints and list only present IDs; slash-lists are all-or-nothing on a single kind; code blocks and existing links are untouched. Kinds flow through the shared short-alias system, so task/document/decision/draft all work.

The dropdown is a `createPortal` to `document.body` with `position: fixed` and a high z-index, measured after mount and clamped/flipped against both viewport edges, with a fixed 200px minimum width so a right-edge trigger still gets a usable menu. Its colours come from the `document.documentElement` `dark` class via `MutationObserver` rather than the theme context, which is absent on the surfaces that host it. It closes on outside mousedown and resize only (the capture-phase scroll listener was removed), and entries navigate with SPA handlers when present and native same-tab links otherwise.

Three same-session follow-ups were folded into this ticket: the memos default view (content -> board, empty -> list, explicit view/date filters respected), the memos sidebar icon replacement, and the pinboard note ink overflow fix (`wrapEstimate` now wraps with the baker's real `measure` including the bold flag, with `clampLine` as a hard-truncation safety net).

All 12 AC and 3 DoD items are met. Verification: 253 tests pass across the four touched suites (memo-board 31, including a wider-font regression), biome is clean on every changed file, and `tsc` reports no errors under `src/`.

Files changed: src/web/utils/task-id-links.ts + .test.ts, src/web/components/EntityIdRangeDropdown.tsx (new), src/web/components/MermaidMarkdown.tsx, src/web/components/MemosPage.tsx, src/web/components/SideNavigation.tsx, src/web/utils/memo-board.ts + .test.ts, src/test/mermaid-markdown.test.tsx, src/test/web-memos-page.test.tsx, and the four locale files (en/zh-CN/zh-TW/ja).
<!-- SECTION:FINAL_SUMMARY:END -->

## Files Changed

- `src/web/utils/task-id-links.ts` — range/slash-list detection and resolution (`parseMultiIdToken`, `resolveEntityRangeToken`); `splitEntityIds` emits `entity-range:<kind>:<token>` link nodes.
- `src/web/utils/task-id-links.test.ts` — util coverage for range/list parsing, fail-closed rules, zero-padding/case/prefix, and cross-kind tokens.
- `src/web/components/EntityIdRangeDropdown.tsx` — new portalled dropdown: viewport-clamped placement, fixed 200px minimum width, DOM-based dark-mode detection, keyboard nav, outside-click/resize close, SPA-or-native entry navigation.
- `src/web/components/MermaidMarkdown.tsx` — `LinkComponent` intercepts `entity-range:` hrefs and renders the dropdown; new `confirmNavigation` prop threaded from host modals.
- `src/web/components/MemosPage.tsx` — default view (`view=board` when a bare `/memos` has content, otherwise list; explicit `view`/date filters win).
- `src/web/components/SideNavigation.tsx` — `Icons.Memo` replaced with the supplied 1024-grid two-path glyph.
- `src/web/utils/memo-board.ts` — `wrapEstimate` accepts the baker's real `measure` + `bold`; `layoutInkLines` passes it and `clampLine` hard-truncates any over-wide line.
- `src/web/utils/memo-board.test.ts` — `layoutInkLines` overflow regression using a wider-than-estimate measure.
- `src/test/mermaid-markdown.test.tsx` — remark integration: range and slash-list produce a single dropdown trigger; no `entity-range:` scheme leakage.
- `src/test/web-memos-page.test.tsx` — default-view cases (empty -> list, content -> board, explicit view wins).
- `src/web/locales/{en,zh-CN,zh-TW,ja}.ts` — locale strings for the dropdown and memos surfaces.


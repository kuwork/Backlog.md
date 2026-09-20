---
id: BACK-674
title: >-
  Rename the documents sort label to Title and add the same sort toggles to
  decisions
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-20 07:17'
updated_date: '2026-09-20 07:18'
labels: []
dependencies: []
references:
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/test/web-side-navigation-decisions-sort.test.tsx
  - src/test/web-side-navigation-docs-sort.test.tsx
modified_files:
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/web-side-navigation-decisions-sort.test.tsx
  - src/test/web-side-navigation-docs-sort.test.tsx
ordinal: 255400
actual_start: '2026-09-20 07:18'
actual_end: '2026-09-20 07:18'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The documents tree labels its first sort toggle `名称` / 'Name', but it has never sorted on a name: BACK-667 added it as `docsNodeLabel(node, docTitles)`, which returns the document title and falls back to the file name, and the toggle's own tooltip already says 'Sort by title'. The wording is the only thing that disagrees, so it is renamed to `标题` / 'Title' and nothing else about that column changes.

The decisions section, meanwhile, has no sorting at all - its header carries only the create-decision button - even though it is a flat list of the same two fields the documents tree sorts on: a title and the ID the item is identified by. It gets the same pair of toggles as the documents section, to the left of the create button: `标题` for the title (the default, ascending) and `ID` for the decision ID.

The rows keep printing the decision title in both columns, exactly as the documents tree prints the document title in both of its columns; the ID column only re-orders. Decisions are flat, so there are no folders to hold back. Clicking the inactive column switches the sort and restarts ascending, clicking the active one flips the direction - the behaviour the documents and wiki sections already have.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The documents section's title sort toggle prints 标题 / Title / タイトル / 標題 instead of the old wording, and nothing else about the documents sorting changes: the same locale key, the same column id and the same default and order.
- [x] #2 The decisions section header renders two sort toggles (标题 / ID) to the left of the create-decision button, each with the up/down indicator used by the documents header, with the title column active and ascending on first render.
- [x] #3 Decisions start ordered by title ascending; selecting the ID column orders them by decision ID through the shared ID comparator (decision-2 before decision-11) rather than by title, while the rows keep printing the title.
- [x] #4 Clicking the active column flips between ascending and descending; clicking the inactive column switches the sort and restarts ascending.
- [x] #5 All four locales carry both decision labels and both tooltips (en, ja, zh-CN, zh-TW).
- [x] #6 Tests cover the decisions sorting (default order, column switch, direction flip, restart on a column change, localized labels) and the renamed documents label; bunx tsc --noEmit, bun run check . and the scoped tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Locales: rename the documents label value in all four dictionaries (`Name` / `名前` / `名称` / `名稱` -> `Title` / `タイトル` / `标题` / `標題`), leaving the key, the tooltips and the column id untouched, and add `sortDecisionsByTitle`, `sortDecisionsById`, `sortDecisionsByTitleHint` and `sortDecisionsByIdHint` to the same four dictionaries (`TranslationDict` is derived from `en`, so the keys have to land together).
2. Sidebar helpers: `DecisionSortColumn = 'title' | 'id'`, plus `compareDecisionTitles`, `compareDecisions` (title, or `compareTaskIds` on the ID with the title as the tie-break) and `sortDecisions(items, column, direction)` next to the documents and wiki helpers. Decisions are flat, so there is no folder pinning.
3. Sidebar state and wiring: `decisionSortColumn` / `decisionSortDirection` (`title` / `asc` by default), a `sortedDecisions` memo over the displayed list, `handleDecisionSortChange` and `renderDecisionSortButton` following the shape the docs and wiki sections already use, then the two toggles in the decisions header row inside the `flex items-center gap-1` cluster that already holds the create-decision button, and render `sortedDecisions` instead of `filteredDecisions`.
4. Tests: `src/test/web-side-navigation-decisions-sort.test.tsx` (JSDOM, titles unrelated to the IDs, every lookup scoped to the decisions section because all three sections now carry a `Sort by title` toggle) and the corrected label expectations in `src/test/web-side-navigation-docs-sort.test.tsx`.
5. Revert probes (`tmp/revert-verify-673.py`) for the default column, the default direction, the sorted list, the ID comparator, the direction flip, the ascending restart, the two toggles and the renamed documents label, then a live check on the source server (`tmp/cdp-back673.mjs`) against a scratch project, because the repository itself only holds one decision.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### The documents change is the label only

The first documents column has been labelled `名称` / 'Name' since BACK-667 while sorting on `docsNodeLabel`, which returns the document title and falls back to the file name - its tooltip already read 'Sort by title'. Only the displayed value changes: the locale key (`sortDocsByName`), the column id (`'name'`) and the comparator all stay, so no caller or test had to move. Renaming the key would have been a wider change than the rename that was asked for, and the key name is not user-visible. The test that pins the four localized labels was updated, since it asserts the exact wording.

### Decisions are a flat list, so the sorting is one pass

`filteredDecisions` is a plain array, so `sortDecisions` sorts it once and returns a new array - there is no folder pinning like `sortDocsTree` and `sortWikiTree` need, and the incoming prop array is not mutated. The columns mirror the documents tree: title first (the default), then the ID the list is identified by, with the title comparator as the tie-break so two decisions sharing an ID stay in title order. The ID column goes through the shared `compareTaskIds`, so `decision-2` sorts before `decision-11` and a number-less ID sorts as 0.

The rows keep printing `decision.title` in both columns, which is what the documents tree does too - its ID column only re-orders, it does not swap the printed field. That is the deliberate difference from the wiki tree, whose label does follow the selected column (BACK-672).

The state, the change handler and the render button follow the shape the docs and wiki sections already use, so all three sections now share `renderSortButton` and only the state they read differs.

### Test scoping

All three sections now render a toggle whose `aria-label` is 'Sort by title', so looking a button up by that label across the whole sidebar returns the documents one, not the decisions one. Every lookup in the new cases therefore scopes to the decisions section first (`heading.closest('div.px-4')`), which is also the workaround the BACK-672 notes recommend. The case names say 'restarts ascending when the other column is selected' and it takes the ID column to descending first, so a column switch that carried the previous direction over would actually fail it.

### Verification

- `src/test/web-side-navigation-decisions-sort.test.tsx` (6) passes, as do the documents (6), wiki (7) and loading (3) sidebar cases next to it - 22 across the four files.
- `tmp/revert-verify-673.py`: 9 probes, each restoring one behaviour (default column back to the ID, default direction descending, list rendered unsorted, ID column falling back to the title comparator, active-column click not flipping, column switch keeping the old direction, either toggle removed from the header, the documents label back to the old wording) - all 9 turn their case red, and every file is restored byte-for-byte (sha1 checked).
- `bunx tsc --noEmit` clean; `bun run check .` 429 files with only the three pre-existing `assets.ts` warnings.
- Live check on the source server, because the repository holds a single decision and cannot show an order: a scratch project with five decisions was served over `BACKLOG_CWD` (`tmp/back673-proj`) and driven by headless Chrome (`tmp/cdp-back673.mjs`, screenshots `tmp/back673-live-*.png`). The documents header prints `标题` / `ID` and no longer the old wording; the decisions header prints `标题` / `ID` next to `新建决策` and starts on the title column ascending (Alpha storage, Bravo cutover, Mike logging, Xray migration, Zulu rollout); the ID column gives Zulu rollout, Mike logging, Xray migration, Alpha storage, Bravo cutover (decision-2, -3, -5, -11, -12); a second click on the ID column reverses to Bravo cutover, Alpha storage, Xray migration, Mike logging, Zulu rollout; switching back to `标题` restarts ascending. At a 280px sidebar all three headers keep their toggles on one line (20px tall) with no overflow, and the decisions rows still print their titles in both modes.
- CDP gotcha worth keeping: Bun's keep-alive connection pool gets a 404 from Chrome's DevTools HTTP server on the second request over a reused connection (`/json/list` -> 404 with an empty body while the first call is a 200), which made the probe look like it had no page target. `curl` and adding `Connection: close` both stay at 200; the script now closes every probe call.

### ID collision

The repository handed this task BACK-674 - the allocator counts IDs that exist on other local branches as well, and `backlog/tasks/back-673` is present on one of them - but upstream uses BACK-674 for TUI-10 (sort the TUI list view through the shared task ID comparator), which the fork already landed as BACK-649. The fork keeps the allocated number and renumbers nothing. The ledger row for this collision is deliberately left to a separate bookkeeping change that has to be asked for, so nothing under `backlog/docs/migration/` is touched here.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The documents sort column now reads `标题` / 'Title' / `タイトル` / `標題` instead of `名称` / 'Name' / `名前` / `名稱` - the displayed value only, with the locale key, the column id and the comparator untouched. The decisions section gained the same two toggles as the documents tree, to the left of the create-decision button: `标题` for the title (the default, ascending) and `ID` for the decision ID.

Decisions are a flat list, so there is no folder handling: `sortDecisions` orders the whole list by the selected column through the shared `compareTaskIds` for the ID mode, so `decision-2` sorts before `decision-11`. The rows keep printing the title in both columns, clicking the active column flips the direction and switching columns restarts ascending, and the four locales carry both labels and both tooltips.
<!-- SECTION:FINAL_SUMMARY:END -->

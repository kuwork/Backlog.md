---
id: BACK-667
title: Add name and ID sort toggles to the web sidebar document tree
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-20 01:42'
updated_date: '2026-09-20 02:05'
labels: []
dependencies: []
references:
  - src/web/components/SideNavigation.tsx
  - src/test/web-side-navigation-docs-sort.test.tsx
  - src/web/locales/en.ts
modified_files:
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/web-side-navigation-docs-sort.test.tsx
ordinal: 252400
actual_start: '2026-09-20 01:42'
actual_end: '2026-09-20 02:05'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The sidebar documents tree renders whatever order the server hands back, which is the filesystem's own order: filename string order on Windows and an arbitrary order elsewhere, with files and folders mixed inside each level. That makes the tree look unsorted and makes its order differ from the flat lists (`doc list`, the docs API), which sort by title.

Add two sort toggles to the documents section header, sitting to the left of the create-document dropdown and styled like the task list header sort buttons: `Name` for the document title and `ID` for the document ID. Title ascending is the default. Clicking the inactive column switches the sort and starts ascending; clicking the active column flips the direction. Folders have no title or document ID, so they always come first and follow the active direction by name; files follow, ordered by the selected column. Each folder level is sorted on its own and the incoming tree is not mutated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The documents section header renders two sort buttons ("Name" for the document title, "ID" for the document ID) to the left of the create-document button, each carrying the up/down indicator used by the task list header, with the title column active and ascending on first render.
- [x] #2 Sorting by title puts folders first (ordered by folder name) then files (ordered by title), both in the active direction, using natural order so `doc-2` precedes `doc-10`.
- [x] #3 Sorting by ID orders files by document ID numerically in the active direction, while folders stay ordered by folder name following the same direction.
- [x] #4 Clicking the inactive column switches the sort and starts ascending; clicking the active column flips between ascending and descending.
- [x] #5 Every folder level is sorted, not just the root, and the tree passed in as a prop is left untouched (no in-place mutation).
- [x] #6 All four locales carry both labels and both tooltips (en, ja, zh-CN, zh-TW).
- [x] #7 A web test covers the default title-ascending order, the switch to ID and the direction flip, including the folder order in the ID view, with fixture titles unrelated to the file names so the two columns are told apart.
- [x] #8 bunx tsc --noEmit, bun run check . and the scoped web tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Sorting helper in `SideNavigation.tsx`: `sortDocsTree(nodes, column, direction, docTitles)` sorts one level, folders first by name (direction-aware) and files by the selected column, recursing into children and returning new node objects so the prop tree is never mutated. `Name` compares the label the row prints — the document title from a `docId → title` map, or the file name without its extension when the corpus has no entry — with `localeCompare(..., { numeric: true, sensitivity: "base" })`; `ID` goes through `compareTaskIds`, with that same label as tiebreak.
2. Header controls: `docsSortColumn`/`docsSortDirection` state (defaults `name`/`asc`), a `useMemo` for the `docId → title` map and another around the sorted tree, `handleDocsSortChange` (a new column restarts ascending, the active column flips) and `renderDocsSortButton`, which mirrors the task list header's label plus ↑/↓ indicator.
3. Wire both buttons into the documents header row, left of the create-document dropdown, and render `sortedDocsTree` in place of `docsTree`. `DocTreeItem` takes the title map instead of the documents array, so the row label and the sort key come from one helper.
4. Locales: add `sortDocsByName`, `sortDocsById`, `sortDocsByNameHint`, `sortDocsByIdHint` to all four dictionaries (`TranslationDict` is derived from `en`, so the keys have to land together).
5. Test `src/test/web-side-navigation-docs-sort.test.tsx`: JSDOM + `createRoot`, with two folders and three top-level files whose titles are deliberately unrelated to the file names and the IDs, so the title column, the ID column and the raw tree order all disagree; assert the default order, the ID switch, the direction flip and the localized labels.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Layout

The two toggles sit in the documents header row, wrapped together with the create-document dropdown in one right-aligned group, so the strip reads `chevron · icon · Documents (13) … Name ↑↓ ID ↑↓ +`. Each button mirrors the task list header: the label, then a `w-4` icon span holding `↑` and `↓`, the active direction in `text-gray-600`/`dark:text-gray-300` and the inactive one in `text-gray-300`/`dark:text-gray-600`.

### Sorting rules

`sortDocsTree` sorts every level independently and returns new nodes (`{ ...node, children: sorted }`), leaving the tree that arrives as a prop untouched. Folders always lead and are ordered by name in the active direction, because a folder is not a document and has neither title nor ID; files follow. `Name` compares the label the row prints, not the file name: `docsNodeLabel` returns the document title looked up in a `docId → title` map that the component builds from the `docs` prop in a `useMemo`, and falls back to the file name without its extension when the corpus has no entry. That helper now feeds the row itself as well, so the order always matches what the sidebar shows. The comparison is `localeCompare(..., { numeric: true, sensitivity: "base" })`, so `doc-4 …` sorts before `doc-10 …`. `ID` compares `node.docId` through `compareTaskIds` (numeric parts, so `doc-2` precedes `doc-10`) and falls back to the file name on a tie — which is also what orders files that carry no numeric ID.

The two columns are therefore genuinely different on this corpus. Under `migration` the title column reads `A类…, B类…, To-Do …, Upstream v1.47.1 …, Upstream v1.48.0 …, Upstream v1.49.3 …, Upstream v1.50.1 …, v1.48.0 至 …, v1.49.3 至 …, v1.50.1 至 …`, while the ID column reads `doc-4 … doc-13`. (An earlier pass sorted the name column by file name, which on `doc-NN - title.md` names is close to the ID order; the user asked for the title instead.)

### Verification

- `bun test src/test/web-side-navigation-docs-sort.test.tsx` — 6 pass. Revert probes (`tmp/revert-sidenav-sort.py`, in-place swaps): making `sortDocsTree` a pass-through fails the four order cases while the button and locale cases stay green; making the title column compare the file name again fails the two title-column cases while the ID, button and locale cases stay green; removing the two buttons fails all six.
- `bunx tsc --noEmit` clean; `bun run check .` 426 files with only the three pre-existing `assets.ts` warnings (biome includes `src/**/*.ts` but not `*.tsx`, so the new test file is not linted there).
- Live (source server on port 6484 + headless Chrome, `tmp/cdp-back667.mjs`, screenshots `tmp/back667-*.png`): the default view opens `文档 (13) 名称 ↑ ID` and lists `migration` with its ten files in title order (`A类…`, `B类…`, `To-Do …`, the four `Upstream …` entries, then the three `v1.4x 至 …` entries), then `prd`, then the three top-level documents `Configuring …`, `Running …`, `Testing …`; the `ID` click switches the highlight and the folder to numeric `doc-4 … doc-13` with `Testing …, Configuring …, Running …` at the top level; a second `ID` click reverses both groups (`prd, migration` and `doc-13 … doc-4`, `doc-003, doc-002, doc-001`); the `Name` toggle returns to the title order. The create-document `+` stays after both buttons.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web sidebar document tree can now be sorted on demand. Two toggles sit to the left of the create-document button in the documents header, styled like the task list header: `Name` for the document title (the default, ascending) and `ID` for the document ID, each with the ↑/↓ indicator that marks the active direction. Clicking the inactive column restarts ascending, the active one flips. Folders always lead, ordered by name in the active direction, and files follow by the selected column; a file without a corpus title falls back to its file name, every folder level is sorted, the incoming tree is left untouched, and all four locales carry the labels and their tooltips.
<!-- SECTION:FINAL_SUMMARY:END -->

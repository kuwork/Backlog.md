---
id: BACK-672
title: Add title and file-name sort toggles to the web sidebar wiki tree
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-20 06:24'
updated_date: '2026-09-20 06:39'
labels: []
dependencies: []
references:
  - src/utils/wiki-titles.ts
  - src/server/index.ts
  - src/types/index.ts
  - src/web/components/SideNavigation.tsx
  - src/test/wiki-titles.test.ts
  - src/test/web-side-navigation-wiki-sort.test.tsx
  - src/test/server-wiki-tree-endpoint.test.ts
modified_files:
  - src/server/index.ts
  - src/types/index.ts
  - src/utils/wiki-titles.ts
  - src/web/components/SideNavigation.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/wiki-titles.test.ts
  - src/test/server-wiki-tree-endpoint.test.ts
  - src/test/web-side-navigation-wiki-sort.test.tsx
ordinal: 254400
actual_start: '2026-09-20 06:24'
actual_end: '2026-09-20 06:44'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The sidebar wiki tree renders whatever order the server hands back - the filesystem's own order, which is filename string order on Windows and arbitrary elsewhere - and always prints the file name, even though every wiki page carries a `title` in its frontmatter that the page header and the search results already show. The documents tree got sort toggles in BACK-667; the wiki section still has none.

Add the same pair of toggles to the wiki section header, to the left of the create-page dropdown: `标题` for the page title (default, ascending) and `文件名` for the file name. Unlike the documents tree, the label a row prints follows the selected column - sorting by title prints titles, sorting by file name prints file names without the `.md` extension - so the list always shows the field it is sorted by. Folders have no title, so they always come first and follow the active direction by their own name; pages follow, ordered by the selected column, and every folder level is sorted on its own.

The title is not part of the wiki tree payload (`GET /api/wiki/tree` returned `{name, path, type}` only), so the server attaches it from the loaded corpus as `WikiTreeNode.title`, falling back to the file name for a page the corpus does not know - the same fallback the search results and the page header use.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/wiki/tree carries a `title` on every file node, taken from the page frontmatter and falling back to the file name, while folder nodes stay untitled.
- [x] #2 The wiki section header renders two sort buttons (标题 / 文件名) to the left of the create-page button, each with the up/down indicator used by the documents header, with the title column active and ascending on first render.
- [x] #3 The label a page row prints follows the selected column: titles while sorting by title, file names without the `.md` extension while sorting by file name.
- [x] #4 Folders stay above the pages at every level and follow the active direction by folder name; pages follow, ordered by the selected column in the same direction.
- [x] #5 Clicking the inactive column switches the sort and restarts ascending; clicking the active column flips between ascending and descending.
- [x] #6 A page the corpus has no title for prints its file name in the title column.
- [x] #7 All four locales carry both labels and both tooltips (en, ja, zh-CN, zh-TW), and at the default 320px sidebar width the toggles stay on one line each instead of wrapping inside the label.
- [x] #8 Tests cover the helper rules, the tree payload and the sidebar behaviour (default order, column switch, direction flip, nested level, localized labels), and bunx tsc --noEmit, bun run check . and the scoped tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data: add `title?` to `WikiTreeNode` and a pure `src/utils/wiki-titles.ts` (`wikiPageTitle(page)` = frontmatter title, else file name without extension; `withWikiPageTitles(tree, pages)` = the same tree with titles attached at every level, folders and unknown pages untouched, input not mutated).
2. Server: `handleGetWikiTree` attaches those titles from the content store's wiki corpus, so no page is read twice and the tree keeps its file-name fallback when the store is not ready.
3. Sidebar: `wikiNodeFileName` / `wikiNodeLabel(node, column)` / `compareWikiNodeNames` / `compareWikiNodeLabels` / `sortWikiTree(nodes, column, direction)`, mirroring the documents helpers (folders first, direction-aware, level by level, no mutation). Extract the sort toggle markup out of `renderDocsSortButton` into a shared `renderSortButton`, then add `wikiSortColumn`/`wikiSortDirection` state (`title`/`asc` by default), a `sortedWikiTree` memo, `handleWikiSortChange` and `renderWikiSortButton`.
4. Wire both toggles into the wiki header row, left of the create-page dropdown, render `sortedWikiTree`, and pass the active column down through `WikiTreeItem` so the row label and the sort key come from one helper.
5. Locales: `sortWikiByTitle`, `sortWikiByFileName`, `sortWikiByTitleHint`, `sortWikiByFileNameHint` in all four dictionaries (`TranslationDict` is derived from `en`, so the keys have to land together).
6. Tests: `wiki-titles.test.ts` (helper rules), `web-side-navigation-wiki-sort.test.tsx` (JSDOM, fixture titles unrelated to the file names so the two columns disagree), `server-wiki-tree-endpoint.test.ts` (`GET /api/wiki/tree` carries the titles). Then the revert probes and a live check on the source server.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Where the titles come from

The wiki tree payload carried only `{name, path, type}`, so the sidebar had nothing to sort or label pages by. The content store already keeps every wiki page in memory (it reloads the corpus on every refresh), so `handleGetWikiTree` merges the corpus titles in rather than making the filesystem re-read 360 pages for a sidebar payload - `getWikiTree()` stays the disk authority and the merge lives in the pure `withWikiPageTitles` helper. A store that is not ready is not an error: the tree is served as it was and the client falls back to file names, exactly as it does for a page missing from the corpus.

`wikiPageTitle` uses the same rule as the search corpus (`search-service.ts`) and the page header: frontmatter `title` when it is a non-blank string, otherwise the file name without the directory or extension. A page with no frontmatter title therefore still arrives titled - with its own file name - which keeps the two label modes identical for that row.

### Sorting rules

`sortWikiTree` mirrors `sortDocsTree` (BACK-667): folders always lead and are ordered by name in the active direction, because a folder is not a page and has no title; pages follow by the selected column; every level is sorted on its own and the incoming tree is not mutated. Comparisons are `localeCompare(..., { numeric: true, sensitivity: "base" })`.

The one thing that differs from the documents tree is that the printed label follows the selected column, as asked: `wikiNodeLabel(node, column)` returns the title for the `标题` column and the file name for the `文件名` column, so the list always prints the field it is sorted by instead of only re-ordering the same strings. `WikiTreeItem` receives the active column for that reason.

The sort toggle markup was extracted from `renderDocsSortButton` into a shared `renderSortButton`, so both sections render the identical control and only the state they read differs. Renaming `DocsSortDirection` to a shared `SortDirection` also renamed the state setter (`setDocsSortDirection` contained the type name) - caught and fixed before it survived.

### Header layout

The wiki header carries more text than the documents one (`WIKI (360)` plus a three-character `文件名`), so at the default 320px sidebar the two toggles were squeezed and the labels wrapped onto two lines (`标/题`, `文/件/名`). Measured live: the row is 277px wide, the controls need 297px with `nowrap`. The fix is `whitespace-nowrap` on the toggle plus `flex-wrap gap-y-1` on the three section headers, so the action cluster drops to a second line instead of crushing the labels - the documents and decisions rows are unchanged at this width and degrade the same way when the sidebar is narrowed.

### Verification

- `src/test/wiki-titles.test.ts` (7), `src/test/web-side-navigation-wiki-sort.test.tsx` (7) and `src/test/server-wiki-tree-endpoint.test.ts` (2) pass, as do the documents sort cases (6) they sit next to.
- `tmp/revert-verify-672.py`: 11 probes, each restoring one behaviour (blank titles accepted, titles on folders, empty-corpus reference, label ignoring the column, folders unpinned, folders not following the direction, raw tree rendered, active-column click not flipping, new column keeping the old direction, label pinned to the title column, tree served without titles) - all 11 turn their case red, and every file is restored byte-for-byte.
- `bunx tsc --noEmit` clean; `bun run check .` 429 files with only the three pre-existing `assets.ts` warnings.
- Live (source server on port 6471 + headless Chrome, `tmp/cdp-back672.mjs`, screenshots `tmp/back672-live-*.png`): default `标题` ascending lists the folders `comparisons … usermanual` then `Knowledge Base Overview`, `Wiki Content Catalog`, `Wiki Operations Log`; `文件名` switches to `index`, `log`, `overview` and a second click reverses both groups (`usermanual … comparisons`, `overview`, `log`, `index`); the expanded `concepts` folder shows 33 Chinese titles in title mode (核心架构与数据流 … 自动端口选择 … Word 文档转换) and 33 file names in file-name mode (asset-management … wikilink); `GET /api/wiki/tree` reports 360 files, 360 titled, e.g. `concepts/auto-port.md → 自动端口选择`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web sidebar wiki tree can now be sorted like the documents tree. Two toggles sit to the left of the create-page button: `标题` for the page title (the default, ascending) and `文件名` for the file name, each with the ↑/↓ indicator that marks the active direction. The list prints the field it is sorted by - titles in the title column, file names without the extension in the file-name column - while folders always lead and follow the active direction by their own name, and every folder level is sorted on its own. Clicking the inactive column restarts ascending, the active one flips.

Titles were not in the tree payload, so `GET /api/wiki/tree` now serves `WikiTreeNode.title`, merged from the in-memory wiki corpus (no extra disk reads) and falling back to the file name for pages the corpus does not know. The fallback is the same rule the search results and the page header already use.
<!-- SECTION:FINAL_SUMMARY:END -->

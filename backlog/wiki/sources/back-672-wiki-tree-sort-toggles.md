---
title: BACK-672 Add title and file-name sort toggles to the web sidebar wiki tree
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - wiki
  - sidebar
  - sorting
source_path: backlog/tasks/back-672 - Add-title-and-file-name-sort-toggles-to-the-web-sidebar-wiki-tree.md
---

# BACK-672 Add title and file-name sort toggles to the web sidebar wiki tree

The sidebar wiki tree rendered the server's raw filesystem order and always printed file names, even though every wiki page carries a frontmatter `title`. This task ports the BACK-667 documents-tree sort toggles to the wiki section — and extends the tree payload, which carried no titles at all.

## Summary

- Data gap closed first: `GET /api/wiki/tree` returned `{name, path, type}` only; `handleGetWikiTree` now merges `WikiTreeNode.title` from the content store's in-memory wiki corpus (no per-page disk re-reads) via the pure `withWikiPageTitles` helper, falling back to the file name when the store is not ready or the page is unknown
- `wikiPageTitle` uses the same rule as the search corpus and page header: non-blank frontmatter `title`, else file name without directory or extension
- Unlike the documents tree, the printed label follows the selected column: `wikiNodeLabel(node, column)` returns the title in Title mode and the file name (no `.md`) in File name mode, so the list always prints the field it is sorted by; `WikiTreeItem` receives the active column for that reason
- `sortWikiTree` mirrors `sortDocsTree`: folders always lead direction-aware by name, pages follow by selected column, every level sorted independently, input tree never mutated; comparisons use `localeCompare(..., { numeric: true, sensitivity: "base" })`
- Sort toggle markup extracted from `renderDocsSortButton` into a shared `renderSortButton`, so both sections render the identical control; renaming `DocsSortDirection` to shared `SortDirection` also renamed the state setter containing the type name (caught before it survived)
- Header layout fix measured live: the wiki header's longer labels wrapped at the default 320px sidebar; `whitespace-nowrap` on toggles plus `flex-wrap gap-y-1` on the three section headers lets the action cluster drop to a second line
- Tests: `wiki-titles.test.ts` (7), `web-side-navigation-wiki-sort.test.tsx` (7), `server-wiki-tree-endpoint.test.ts` (2); 11 revert probes red; live check showed 360 files all titled

## Acceptance Criteria

- Tree payload carries `title` on every file node from frontmatter with file-name fallback; folders stay untitled
- Wiki header renders Title/File name toggles left of the create-page button, title ascending default
- Row label follows the selected column; folders lead at every level following the direction by name
- Inactive-column click restarts ascending, active-column click flips; corpus-less pages print file names in title mode
- All four locales carry labels/tooltips; toggles stay on one line at 320px sidebar width

## Related Concepts

- [[concepts/web-ui-features]] — sidebar tree conventions shared with the documents section
- [[concepts/wikilink]] — wiki page identity and titles the tree surfaces
- [[concepts/web-server]] — the `/api/wiki/tree` endpoint whose payload grew

## Related Sources

- [[sources/back-667-sidebar-docs-sort-toggles]] — the pattern this task ports and generalizes via shared `renderSortButton` (batch sibling)
- [[sources/back-674-decisions-sort-toggles]] — follow-up completing the three-section sort coverage (batch sibling)
- [[sources/wiki-web-ui-task]] — wiki web UI the tree belongs to

---
title: BACK-667 Add name and ID sort toggles to the web sidebar document tree
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - sidebar
  - sorting
source_path: backlog/tasks/back-667 - Add-name-and-ID-sort-toggles-to-the-web-sidebar-document-tree.md
---

# BACK-667 Add name and ID sort toggles to the web sidebar document tree

The sidebar documents tree rendered the server's raw filesystem order — filename order on Windows, arbitrary elsewhere — unlike the flat doc lists that sort by title. This task adds `Name` (title) and `ID` sort toggles to the documents section header, styled like the task list header sort buttons.

## Summary

- Two toggles sit left of the create-document dropdown, mirroring the task list header's label + `↑/↓` indicator; title ascending is the default, clicking the inactive column restarts ascending, the active one flips direction
- `sortDocsTree(nodes, column, direction, docTitles)` sorts every folder level independently and returns new node objects (`{ ...node, children: sorted }`) — the prop tree is never mutated
- Folders always lead (they have neither title nor document ID) and follow the active direction by name; files follow ordered by the selected column
- `Name` compares the label the row prints — document title from a memoized `docId → title` map, falling back to the file name without extension — via `localeCompare(..., { numeric: true, sensitivity: "base" })`, so `doc-4` precedes `doc-10`; the same `docsNodeLabel` helper feeds the row itself so order always matches display
- `ID` compares `node.docId` through `compareTaskIds` with the label as tiebreak; the two columns genuinely disagree on this corpus (title order vs `doc-4 … doc-13`)
- An earlier pass sorted the name column by file name, which on `doc-NN - title.md` names is nearly the ID order; the user asked for the title instead
- Locales: `sortDocsByName`/`sortDocsById` + hints in all four dictionaries; 6-case JSDOM test with fixture titles deliberately unrelated to file names; live-verified in zh-CN over CDP with revert probes

## Acceptance Criteria

- Both sort buttons render left of the create button with the up/down indicator, title column active ascending by default
- Title sort puts folders first then files by title, both direction-aware, using natural numeric order
- ID sort orders files numerically by document ID while folders follow by name; every folder level sorted, prop tree untouched
- Inactive-column click switches ascending; active-column click flips
- All four locales carry labels and tooltips; tests distinguish the two columns with unrelated fixture titles

## Related Concepts

- [[concepts/web-ui-features]] — sidebar tree and header-control conventions
- [[concepts/task-identity]] — `compareTaskIds` numeric ID ordering reused for document IDs
- [[concepts/web-ui-i18n]] — four-locale keys landing together (`TranslationDict` derived from en)

## Related Sources

- [[sources/back-672-wiki-tree-sort-toggles]] — direct follow-up applying the same pattern to the wiki tree (batch sibling)
- [[sources/back-674-decisions-sort-toggles]] — follow-up renaming this label to `Title` and extending the pattern to decisions (batch sibling)
- [[sources/sidebar-resize-search-task]] — earlier sidebar structure work

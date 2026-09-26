---
title: BACK-674 Rename the documents sort label to Title and add the same sort toggles to decisions
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - sidebar
  - sorting
source_path: backlog/tasks/back-674 - Rename-the-documents-sort-label-to-Title-and-add-the-same-sort-toggles-to-decisions.md
---

# BACK-674 Rename the documents sort label to Title and add the same sort toggles to decisions

The documents tree's first sort toggle was labelled `Name` but had always sorted on the document title (its own tooltip already said "Sort by title"). This task fixes the wording and gives the decisions section — a flat list of the same two fields — the same Title/ID toggle pair.

## Summary

- The documents change is display-only: the locale key (`sortDocsByName`), column id (`'name'`) and comparator all stay, so no caller or test moved; renaming the key would have been a wider change than asked for and key names are not user-visible
- Decisions are flat, so `sortDecisions(items, column, direction)` sorts the displayed array once with no folder pinning and no mutation; title is the default ascending column, ID goes through shared `compareTaskIds` (`decision-2` before `decision-11`) with the title comparator as tiebreak
- Rows keep printing `decision.title` in both columns — the ID column only re-orders, matching the documents tree; this is the deliberate difference from the wiki tree, whose label follows the selected column (BACK-672)
- All three sidebar sections now share `renderSortButton`, differing only in the state they read
- Test scoping lesson: all three sections render a toggle with `aria-label` "Sort by title", so lookups must scope to the section container first (the workaround BACK-672's notes recommend)
- Live check needed a scratch project over `BACKLOG_CWD` because the repository holds only one decision; five decisions verified across default, ID switch, direction flip and restart, plus 280px narrow-sidebar layout
- CDP gotcha recorded: Bun's keep-alive pool gets a 404 from Chrome's DevTools HTTP server on the second request over a reused connection; `Connection: close` fixes it
- ID collision: the allocator handed BACK-674 because `back-673` exists on another local branch, but 674 was already allocated in the migration ledger; the fork keeps the number and renumbers nothing, leaving ledger bookkeeping to a separate change

## Acceptance Criteria

- Documents title toggle prints `Title` in all four dictionaries with key, column id, default and order unchanged
- Decisions header renders Title/ID toggles left of the create button, title ascending default
- ID column orders by decision ID numerically while rows keep printing titles
- Active-column click flips, inactive-column click restarts ascending; all four locales carry labels and tooltips
- Tests cover decisions sorting and the renamed documents label with section-scoped lookups

## Related Concepts

- [[concepts/web-ui-features]] — sidebar section conventions now uniform across docs/wiki/decisions
- [[concepts/task-identity]] — `compareTaskIds` shared numeric-ID comparator
- [[concepts/web-ui-i18n]] — label rename across four dictionaries with keys untouched

## Related Sources

- [[sources/back-667-sidebar-docs-sort-toggles]] — origin of the renamed label and the toggle pattern (batch sibling)
- [[sources/back-672-wiki-tree-sort-toggles]] — sibling section whose label-follows-column behaviour deliberately differs (batch sibling)
- [[sources/back-574-decision-list-view-update-commands]] — earlier decision surface work

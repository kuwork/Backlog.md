---
id: BACK-638
title: >-
  Add a header outline button with a floating, foldable TOC for documentation,
  decisions and wiki pages
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-15 01:18'
updated_date: '2026-09-15 04:24'
labels:
  - web-ui
  - content-viewer
  - enhancement
dependencies:
  - BACK-637
references:
  - backlog/tasks/back-420 - Add-task-content-TOC-and-scrollspy-in-Web-UI.md
  - >-
    backlog/tasks/back-637 -
    Keep-in-document-anchors-working-on-load-reload-and-slug-normalization.md
modified_files:
  - src/web/utils/toc.ts
  - src/web/components/TocButton.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/web-toc.test.tsx
ordinal: 239400
actual_start: '2026-09-15 01:57'
actual_end: '2026-09-15 04:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add an outline button to the header, next to the theme toggle, that floats a foldable table of contents over the content instead of reserving a permanent column next to it.

Background. In-page anchor scrolling is provided by BACK-637 (src/web/utils/hash-target.ts and src/web/hooks/useHashScroll.ts, heading ids from github-slugger). The first iteration of this task put a sticky outline rail inside the reading pages, which took horizontal space from the prose and became unreachable once the reader scrolled away from it. The second iteration moved the trigger into the header and rendered the outline as a floating panel. The third added folding, because a document with dozens of headings still opened as one long list. The fourth added a master control to the panel header, because folding a long outline one branch at a time is tedious.

Scope.

- Read-only documentation, decision and wiki pages publish the headings of their rendered markdown to a shared TocProvider (src/web/contexts/TocContext.tsx, usePageToc).
- The header renders an outline button to the left of the theme toggle whenever the current page published headings, and renders nothing otherwise, including while editing.
- The panel is anchored below the button, floats above the content, and closes on entry selection, Escape and outside clicks.
- Entries nest by heading level and are indented by level; every entry that owns a subtree carries a chevron that folds the subtree away, and outlines longer than 20 entries open with their deeper levels folded.
- The panel header carries a two-state master control: it folds every branch while anything is open, and unfolds every branch while anything is folded. An outline without branches does not render it.
- The current section stays reachable. The branch holding it is opened automatically when the reading position moves into it, and a folded branch that still holds it keeps the accent colour. An explicit fold-everything instruction is respected instead: the tree stays folded while the reader scrolls, and the accent colour on that folded branch shows where the reading position is.
- Entries keep the scrollspy highlight and share activateHashTarget with the in-document anchor links for scroll and URL hash updates.
- Chinese headings and duplicate titles keep the anchors the renderer produced, because entries are read from the rendered DOM rather than re-parsed from markdown.

Related. BACK-420 covers the same outline for the task detail modal. BACK-637 provides the anchor infrastructure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Documentation detail page publishes its rendered headings to the header outline
- [x] #2 Decision detail page publishes its rendered headings to the header outline
- [x] #3 Wiki pages publish their rendered headings to the header outline
- [x] #4 The header shows an outline button to the left of the theme toggle when the current page has headings
- [x] #5 The outline button is hidden on pages without headings and while the page is being edited
- [x] #6 Clicking the button floats the outline panel over the content instead of reserving a column
- [x] #7 The reading page keeps its full content width (no permanent outline rail)
- [x] #8 Entries come from headings h1 through h6 and are indented by level
- [x] #9 Clicking an entry scrolls to the heading, updates the URL hash and closes the panel
- [x] #10 The outline highlights the current section while scrolling (scrollspy)
- [x] #11 Chinese headings appear in the outline and resolve to the correct heading id
- [x] #12 The panel closes on Escape and on a click outside it
- [x] #13 Scoped tests cover heading collection, click-to-scroll, scrollspy and the panel interactions
- [x] #14 Entries that own a subtree can be folded and unfolded from the outline
- [x] #15 An outline longer than 20 entries opens with its deeper levels folded
- [x] #16 The branch holding the current section is opened automatically so the highlight stays reachable
- [x] #17 Scoped tests cover folding, the length-aware default and the automatic expansion
- [x] #18 The panel header offers a master control that folds every branch while anything is open and unfolds every branch while anything is folded
- [x] #19 The master control is not rendered when no entry owns a subtree
- [x] #20 After folding everything, the outline stays folded while the reader scrolls instead of being unfolded by the scrollspy
- [x] #21 Scoped tests cover the master control, both of its states and the folded-while-scrolling behaviour
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a TocProvider plus a usePageToc registration hook so a reading page can publish the headings of its rendered markdown.
2. Add TocButton to the header, left of the theme toggle, rendering nothing when the current page published no headings.
3. Render the outline as a panel anchored below the button that floats over the content, closing on entry selection, Escape and outside clicks.
4. Reuse useActiveTocId for the scrollspy highlight while the panel is open, and activateHashTarget for scroll plus URL hash updates.
5. Register the outline from DocumentationDetail, DecisionDetail and WikiDetail in read-only mode, and drop the previous right-hand rail from all three pages.
6. Keep the toc title in the en, zh-CN, zh-TW and ja locales.
7. Update the scoped tests, including the page tests that now need the provider, then run tsc, biome check and the web test suite.
8. Build the entry tree in src/web/utils/toc.ts (buildTocTree, flattenTocTree, tocAncestorIds), nesting every entry under the closest preceding shallower entry because heading levels may skip.
9. Render chevron rows in TocButton with a per-entry fold state and a length-aware default that folds everything below the top level once the outline exceeds 20 entries.
10. Open the branch holding the current section whenever the reading position moves into it, and add the chevron labels to the four locales.
11. Extend src/test/web-toc.test.tsx with the tree unit tests plus the folding, long-outline default and auto expansion cases.
12. Add the master control to the panel header: fold every branch that owns a subtree while anything is open, unfold every branch while anything is folded, and render nothing when the outline has no branch.
13. Respect an explicit fold-everything instruction by suppressing the scroll-driven auto expansion until the reader interacts with the outline again, and add the expand all / collapse all labels to the four locales.
14. Extend src/test/web-toc.test.tsx with the master control cases: both states, the branch-less outline, and staying folded while scrolling.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Redesigned the outline as a header trigger plus a floating panel. The first pass put a sticky rail inside the reading pages; it took width from the prose and could not be reached once the reader scrolled past it. BACK-420 was returned to its original scope (the task detail modal outline).

Files:

- src/web/contexts/TocContext.tsx (new) keeps a single registration slot for the active reading page. usePageToc collects the headings of the page's rendered container and publishes them; it clears the slot on unmount only when it still owns it, since the replacing page mounts before the unmounting one cleans up.
- src/web/components/TocButton.tsx (new) renders the header button and the panel, and returns null when no page published headings, which also covers edit mode. The panel closes on entry selection, Escape and a mousedown outside the wrapper.
- The right-hand rail was removed from DocumentationDetail, DecisionDetail and WikiDetail, together with the component that rendered it (src/web/components/TableOfContents.tsx, dropped before it was ever committed). The three pages now call usePageToc(contentRef, isEditing ? null : content) and keep their full content width.
- src/web/components/Navigation.tsx renders TocButton left of ThemeToggle in a flex row, and the nav gained relative z-20 so the panel paints above the scrolling main column.
- src/web/components/Layout.tsx wraps the shell in TocProvider.

Decisions:

- The scrollspy only runs while the panel is open, so scrolling the page does not re-render the header. useActiveTocId receives an empty list when the panel is closed.
- The panel is anchored with right-0 and capped with max-w-[calc(100vw-2rem)], so it stays inside the viewport in narrow windows instead of pushing the layout.

Verification:

- bunx tsc --noEmit clean. bun run check . reports only the 3 pre-existing warnings in src/core/assets.ts (biome ignores .tsx through its includes pattern, so the new components are outside that check).
- bun test src/test/web- passes 137 tests across 25 files, including the rewritten src/test/web-toc.test.tsx with 13 cases. The three page test files now wrap their trees in TocProvider.
- Headless Chrome over CDP against a second instance on port 6423: /documentation/2 shows the button and no panel until it is clicked; the panel lists 31 entries, occupies x 1288-1608, and the prose keeps its full 1286px width with the panel open. Clicking entry 9 (Neovim with Clean UI) moved that heading from top 1772 to 72, set the hash to #neovim-with-clean-ui, closed the panel, and reopening showed the same entry highlighted. On /decisions/1 the button sits at 1572-1608 while the theme toggle sits at 1612-1648. On a wiki page at a 720px viewport the panel measured 320px wide with both edges inside the viewport.

Follow-up: folding for long outlines.

The counts and the file list in this section supersede the ones above, which record the first iteration: src/test/web-toc.test.tsx now holds 19 cases inside a 145-test web suite, and the outline component is a tree rather than a flat list.

The outline is now a tree instead of a flat list. Each entry hangs off the closest preceding entry that is shallower than it, because heading levels may skip (h2 straight to h4), so depth cannot be used as a stack index. Entries that own a subtree get a chevron on their row; folding hides the whole subtree.

Length-aware default: outlines longer than 20 entries open with their deeper levels folded, so the reader starts at the top two levels instead of a wall of entries. Shallower entries stay open. Short outlines still open fully expanded.

The current section always stays reachable: whenever the reading position moves into a folded subtree, its ancestors are opened back up automatically. A folded branch that still holds the current section keeps the accent colour even if the reader folded it by hand, so it is obvious where to look.

Files:

- src/web/utils/toc.ts: buildTocTree, flattenTocTree and tocAncestorIds added next to the existing collector.
- src/web/components/TocButton.tsx: fold state per entry id (with the length-aware default), chevron rows, auto expansion of the active entry's ancestors.
- src/web/locales/{en,zh-CN,zh-TW,ja}.ts: toc.expand / toc.collapse for the chevron labels.
- src/test/web-toc.test.tsx: tree unit tests plus folding, long-outline default, short-outline default and auto expansion cases (19 tests in the file).

Verification: bunx tsc --noEmit clean; bun run check . reports only the 3 pre-existing warnings in src/core/assets.ts; bun test src/test/web- passes 145 tests across 25 files.

Browser run over CDP against /documentation/2 (33 headings): the panel opened with 13 visible rows (6 foldable, 5 folded), expanding one level-2 branch grew it to 20 rows, folding a branch back removed its children, and after scrolling to 70% of the page the active entry "Testing Your Configuration" was visible and marked while its branches had been opened automatically. The content column stayed 1270px wide at a 1664px viewport, so the panel keeps floating over the content.

Follow-up 2: master fold control in the panel header.

The panel header carries a two-state control. It folds every branch while anything is open, and unfolds every branch while anything is folded, so the label always names the action that will change something. It is not rendered when no entry owns a subtree, because folding would be a no-op there.

An explicit fold-everything is treated as an instruction rather than a starting point: a foldAllRef flag suppresses the scroll-driven auto expansion until the reader toggles an entry, selects one, or opens another document. Without it the next scroll undid the instruction, because the scrollspy opens the branch holding the current section. A CDP run showed this clearly: 1 visible row after folding everything, 18 rows after scrolling to 55% of the page. The folded branch holding the current section still keeps the accent colour, so the reading position is not lost while the tree stays folded.

Files:

- src/web/components/TocButton.tsx: foldableIds, anyCollapsed, handleToggleAll and the foldAllRef guard. The panel header became a flex row with the title on the left and the control on the right.
- src/web/locales/{en,zh-CN,zh-TW,ja}.ts: toc.expandAll / toc.collapseAll.
- src/test/web-toc.test.tsx: 4 new cases (23 in the file) covering both states on a short outline, unfolding a long outline that opened folded and folding it back to the top level, the absence of the control without branches, and staying folded while the reader scrolls.

Verification: bunx tsc --noEmit clean; bun run check . reports only the 3 pre-existing warnings in src/core/assets.ts; bun test src/test/web- passes 149 tests across 25 files.

Browser run over CDP against /documentation/2: the panel opened at 13 visible rows with the control reading the localized "expand all"; one click unfolded all 31 rows and the control became the localized "collapse all"; the next click left a single row with the control back to the localized "expand all", and the prose stayed 1270px wide at a 1664px viewport. Scrolling to 55% and then to 85% of the page kept the single row, with the accent colour on it, so the folded tree survives the scrollspy. Screenshots: tmp/toc-toggle-all-expanded.png and tmp/toc-toggle-all-folded.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The outline for documentation, decision and wiki pages lives in the header instead of a permanent column. A list button sits to the left of the theme toggle and only appears on read-only pages that published headings; clicking it floats the outline over the content, so the prose keeps its full width and the outline stays reachable wherever the reader has scrolled to. Long outlines fold: entries nest by heading level, every entry that owns a subtree gets a chevron, and an outline longer than 20 entries opens with its deeper levels folded. The panel header carries a two-state master control that folds every branch or unfolds every branch, and it disappears for an outline without branches.

Key decisions:

- Entries come from the rendered DOM (heading id plus data-heading-text), so they always match the renderer's anchors including duplicate-heading suffixes and CJK titles.
- Nesting attaches each entry to the closest preceding shallower entry rather than to the numeric level, because heading levels may skip (h2 straight to h4).
- Long outlines fold below the top level, and the branch holding the current section is opened automatically whenever the reading position moves into it, so the scrollspy highlight stays reachable.
- Folding everything by hand counts as an instruction instead of a starting point: it stays folded while the reader scrolls, and the accent colour on the folded branch shows where the current section is. Closing the panel, selecting an entry or toggling any branch hands control back to the scrollspy.
- The master control names the action that will change something, so it reads "collapse all" only while the outline is fully open.
- The scrollspy only runs while the panel is open, so page scrolling does not re-render the header.
- The panel closes on entry selection, Escape and outside clicks, and is capped to the viewport width.
- BACK-420 keeps its original scope, the outline inside the task detail modal.

Changes: new src/web/contexts/TocContext.tsx and src/web/components/TocButton.tsx; the earlier right-hand rail is gone from DocumentationDetail, DecisionDetail and WikiDetail, which now register through usePageToc; TocButton wired into Navigation left of the theme toggle with the nav raised to z-20; TocProvider added in Layout; the toc title, the chevron labels and the expand all / collapse all labels added to the en, zh-CN, zh-TW and ja locales; src/web/utils/toc.ts gained the tree helpers; src/test/web-toc.test.tsx rewritten and grown to 23 cases, and the three page test files wrapped in the provider.

Verification: bunx tsc --noEmit clean, bun run check . with only the 3 pre-existing warnings, 149 web tests pass, and a headless Chrome pass over CDP confirmed the button placement left of the theme toggle, the floating panel staying inside the viewport down to a 720px window, a click on entry 9 of /documentation/2 scrolling the heading from top 1772 to 72 with the hash and the highlight updated, an outline opening at 13 visible rows with 5 branches folded and growing to 20 rows on demand, and the master control taking a long outline from 13 rows to all 31 and then down to a single row while the prose stayed 1270px wide, with that single row still carrying the accent colour after scrolling to 85% of the page.
<!-- SECTION:FINAL_SUMMARY:END -->

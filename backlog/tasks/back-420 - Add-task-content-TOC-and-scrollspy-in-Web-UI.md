---
id: BACK-420
title: Add task content TOC and scrollspy in Web UI
status: Done
assignee:
  - '@kimi'
created_date: '2026-04-25 12:14'
updated_date: '2026-10-01 08:27'
labels:
  - web-ui
  - content-viewer
  - enhancement
dependencies: []
references:
  - src/web/components/TocDrawer.tsx
  - src/web/hooks/useTocTree.ts
  - src/web/components/TocRows.tsx
  - src/web/components/Modal.tsx
  - 'https://github.com/MrLesk/Backlog.md/issues/405'
modified_files:
  - src/web/hooks/useToc.ts
  - src/web/utils/toc.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/TabButton.tsx
  - src/web/components/TocDrawer.tsx
  - src/test/web-task-toc.test.tsx
priority: low
actual_start: '2026-10-01 07:54'
actual_end: '2026-10-01 08:27'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Track part of GitHub issue #405: table of contents and active-heading behavior for long task content.

Most of this landed with BACK-726 (modal markdown outline drawer): the task details modal now has a 'toc' outline drawer — a bookmark tab on the left edge opens a floating panel with a level-indented, foldable TOC, scrollspy highlighting, and smooth-scroll navigation, built on shared pieces (useTocTree hook, TocRows component, useTocItems/useActiveTocId, utils/toc.ts). The markdown renderer (MermaidMarkdown) already emits github-slugger heading ids, so in-page anchors exist.

Remaining work for this task is verification and gap closure rather than a new feature: confirm anchors are stable across re-renders and edits in the modal context, confirm the drawer fallback on narrow screens keeps the TOC usable without obscuring content, and extend test coverage for the task-content case specifically (duplicate headings, CJK titles, AC/notes/plan sections).

See BACK-726 for the reference implementation (src/web/components/TocDrawer.tsx, src/web/hooks/useTocTree.ts, src/web/components/TocRows.tsx, Modal 'toc' prop).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Markdown headings in task content produce stable in-page anchors.
- [x] #2 Long task content can show a table of contents with active-heading indication.
- [x] #3 The TOC remains usable without obscuring content on narrow screens.
- [x] #4 Task modal outline is grouped by task section (Description, References, Acceptance Criteria, Definition of Done, Implementation Plan, Implementation Notes, Comments, Final Summary); sections are top-level entries with their internal headings nested underneath, and sections that are not rendered do not appear
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Context
BACK-726 delivered the outline UI for the task details modal: Modal 'toc' prop renders TocDrawer, which collects headings from the modal's scrollable content via useTocItems, nests/folds them with useTocTree + TocRows, highlights the current section with useActiveTocId, and smooth-scrolls on click. MermaidMarkdown already gives every rendered heading a github-slugger id (stable in-page anchors, CJK-safe, duplicate-suffixed).

## Steps
1. Verify AC #1 (stable anchors): render task content in the modal (MermaidMarkdown via TaskDetailsModal), confirm heading ids persist across description re-renders and mode switches (preview/edit), including duplicate titles and CJK headings. If ids regenerate unstably in any path, fix at the renderer level (MermaidMarkdown), not in the drawer.
2. Verify AC #2 (TOC + active heading): already provided by the modal TocDrawer; add task-content-specific tests to src/test/web-toc-drawer.test.tsx or a new web-task-toc test — long task description (20+ headings, default folding), duplicate headings, CJK titles, scrollspy highlight while the modal content scrolls.
3. Verify AC #3 (narrow screens): the drawer docks outside the modal at >=sm and overlays the modal's left edge (inset 8px) below sm. Check at ~360-640px widths that the panel's max-w-[calc(100vw-8rem)] keeps it usable and closable without obscuring all content; adjust the breakpoint or width if the overlay swallows small modals.
4. Run bunx tsc --noEmit, bun run check ., and the toc/modal test files.

## Out of scope
A permanent side rail or TOC for the board/list views; the floating drawer interaction from BACK-726 is the established pattern.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found and fixed a real scrollspy bug while verifying: findScrollContainer started from the content's PARENT, but in modals the scrollable element is the content container itself, so modal scrollspy listened to window scroll and never updated. Now starts from the element itself; full pages unaffected (their content containers are not scrollable). Narrow-screen check: below sm the drawer overlays the modal's left edge with an 8px inset and max-w-[calc(100vw-8rem)], leaving room to close it; at sm+ it docks outside with an 8px gap (structural test asserts the classes; JSDOM cannot do media-query layout).

Sectioned outline per review feedback: TaskDetailsModal section cards now carry id + data-toc-section attributes; collectSectionedTocItems (utils/toc.ts) turns each rendered section into a level-1 entry (scrolls to the card itself) and nests the section's internal headings below it, normalizing per-section. Without declared sections it falls back to flat heading collection, so doc/wiki/decision pages are unchanged. Covered sections: description, references (metadata panel), AC, DoD, plan, notes, comments, final summary.

Round 2 review fixes: (1) Final Summary (last entry) could not become the active outline entry — the modal content cannot scroll it across the 96px reading line; useActiveTocId now activates the last rendered entry when the scroller reaches its end (scrollTop + clientHeight >= scrollHeight - 8, guarded by scrollHeight > clientHeight so non-scrollable/jsdom cases are unaffected). (2) The metadata panel outline entry now follows the active tab (References/Documentation/Modified Files) instead of always saying References. (3) Section entries show the same counts as the modal headers: AC (checked/total), DoD (checked/total), Comments (n), and the metadata tabs (n); counts disappear when zero, exactly like the section headers.

Round 3: References, Documentation, and Modified Files are now three separate outline entries (TabButton gained a tocLabel prop that registers the tab as a [data-toc-section] with the same count format as the tab strip). Clicking one of these entries calls the tab's click handler — TocDrawer now clicks role=tab targets before scrolling — so the panel switches to the requested tab. The metadata panel wrapper no longer registers as a section itself.

Round 4: clicking an outline entry whose target is already on screen (scroller cannot move, no scroll event fires) never became the active entry — position rules kept the previous one. useActiveTocId now accepts an optional pin: TocDrawer pins the clicked id, the pin wins over every position rule (including the end-of-scroller rule), and the first real scroll event clears it, handing control back to the scrollspy. Test covers: pinned at scroller end, click selects the entry without the page moving, and a real scroll restores scrollspy control.

Round 5: after jumping to the end (Final Summary) and then clicking a tab entry, the outline highlighted Modified Files instead of the clicked tab — the smooth scroll cleared the pin and the position loop picks the LAST item above the reading line, so among the three tabs sharing one position the last one always won. Fix: items whose element is an unselected tab (role=tab, aria-selected=false) are skipped by every position rule; since clicking a tab entry also selects the tab, the clicked tab keeps the highlight after the scroll settles. Regression test reproduces the exact scenario.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kimi
created: 2026-10-01 08:02
---
Review feedback: the task modal outline must be grouped by task section (Description, References, Acceptance Criteria, Definition of Done, Implementation Plan, Implementation Notes, Final Summary, ...). Sections are top-level entries with their internal headings nested underneath; sections that are not rendered (e.g. empty or hidden in edit mode) must not appear. Reworking.
---

author: @kimi
created: 2026-10-01 08:19
---
Fixed: clicked entries are now pinned as active until the next real scroll, so a target that is already visible (page does not move) is selected immediately.
---

author: @kimi
created: 2026-10-01 08:22
---
Fixed: position rules now skip unselected tabs, so the tab you clicked (which is also the one being displayed) owns the highlight.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task content TOC with section grouping, built on the BACK-726 modal drawer.

Changes:
- useToc.ts: findScrollContainer considers the content element itself (modal scrollspy previously tracked window scroll); useActiveTocId activates the last rendered entry at the scroller's end (Final Summary can be highlighted), supports a click pin that wins over position rules until the next real scroll (entries already on screen can be selected), and skips unselected tabs so the displayed tab owns the highlight
- utils/toc.ts: new collectSectionedTocItems — every rendered [data-toc-section] element becomes a top-level outline entry with internal headings nested below; unrendered sections never appear; flat fallback for pages without declared sections
- TaskDetailsModal: section cards (description, AC, DoD, plan, notes, comments, final summary) annotated with id + data-toc-section, labels matching headers including counts (AC/DoD checked/total, Comments (n))
- TabButton: new tocLabel prop registers a tab as an outline entry; References/Documentation/Modified Files appear as three entries with the same count format as the tab strip
- TocDrawer: clicking an entry whose target is role=tab activates that tab before scrolling; clicked entries are pinned as active
- New src/test/web-task-toc.test.tsx (12 tests): anchor stability, duplicate/CJK anchors, long-outline folding, modal scrollspy, bottom-scroll activation, click-pin selection without page movement, tab position disambiguation, narrow-screen fallback, section grouping, tab listing/activation

Verification:
- 39 toc-related tests and the task-details suites pass
- bunx tsc --noEmit, bun run check ., bun run build all pass
<!-- SECTION:FINAL_SUMMARY:END -->

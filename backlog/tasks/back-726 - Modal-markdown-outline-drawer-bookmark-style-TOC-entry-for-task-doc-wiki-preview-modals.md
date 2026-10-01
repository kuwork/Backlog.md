---
id: BACK-726
title: >-
  Modal markdown outline drawer: bookmark-style TOC entry for task/doc/wiki
  preview modals
status: In Review
assignee:
  - '@kimi'
created_date: '2026-10-01 07:23'
updated_date: '2026-10-01 07:47'
labels:
  - web-ui
dependencies: []
references:
  - src/web/components/Modal.tsx
  - src/web/components/TocButton.tsx
  - src/web/utils/toc.ts
  - src/web/hooks/useToc.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/WikiDetail.tsx
  - src/web/components/FilePreviewModal.tsx
modified_files:
  - src/web/components/TocDrawer.tsx
  - src/web/components/TocRows.tsx
  - src/web/components/TocButton.tsx
  - src/web/components/Modal.tsx
  - src/web/hooks/useTocTree.ts
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/WikiDetail.tsx
  - src/web/components/FilePreviewModal.tsx
  - src/test/web-toc-drawer.test.tsx
ordinal: 296400
actual_start: '2026-10-01 07:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web UI detail pages for documents, decisions, and wiki already have a top-right outline (TocButton + TocContext + utils/toc.ts + hooks/useToc.ts, BACK-638), but every Modal-based popup — task details (TaskDetailsModal), wiki preview (WikiDetail), and file preview (FilePreviewModal) — has no outline, making long markdown content hard to navigate inside a popup.

Requirement: a bookmark-style tab protrudes from the middle of the modal's left edge; clicking it hides the tab and opens a floating outline panel to the left of the modal, as tall as the modal itself. The modal never resizes, avoiding layout jitter. Closing the panel brings the bookmark back.

Related to BACK-420 (task content TOC, tracks GitHub issue #405, assigned @alex-agent) but different scope: this task focuses on the drawer interaction inside Modal popups, reusing the existing heading-collection and scrollspy utilities.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Task details, wiki preview, and markdown file preview modals show a bookmark-style outline tab on the middle of the left edge; the tab is hidden when the content has no headings
- [x] #2 Outline entries are indented by heading level, clicking an entry smooth-scrolls to that heading, and the current heading is highlighted while scrolling (scrollspy)
- [x] #3 bunx tsc --noEmit and bun run check . pass
- [x] #4 Clicking the tab hides it and opens a floating outline panel docked to the modal's left (as tall as the modal, four rounded corners, 8px gap from the content); the modal never resizes
- [x] #5 Closing the panel brings the bookmark tab back; styling works in dark mode
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Design (final: floating side panel, no modal resize)
- The modal keeps its width at all times — no layout jitter.
- Bookmark tab: a narrow column (icon above a vertical label) protruding from the middle of the modal panel's left edge. Clicking it hides the tab and opens the outline panel.
- Outline panel: a floating panel docked to the LEFT OUTSIDE of the modal panel, as tall as the panel, four rounded corners, with an 8px gap from the modal (on narrow screens it overlays inside the left edge, inset by 8px). Header: title + fold-all toggle + close button; body: scrollable tree. Closing it brings the bookmark back.
- Heading collection stays local to the modal: Modal owns a ref on its scrollable content container and TocDrawer uses useTocItems + useActiveTocId on it. No TocContext (single slot owned by full pages).

## Steps (as implemented)
1. Extracted shared useTocTree hook (src/web/hooks/useTocTree.ts) and TocRows component (src/web/components/TocRows.tsx) from TocButton; TocButton refactored to use them, behavior unchanged.
2. New src/web/components/TocDrawer.tsx: bookmark tab + floating panel, reusing useTocTree/TocRows; entry clicks scrollIntoView({behavior:'smooth'}); drawer stays open after jumping.
3. Modal.tsx: new 'toc' boolean prop; panel restructured to a flex column whose content div is the scroll container (visual behavior unchanged), so the floating panel can match the panel height; renders TocDrawer with the content ref.
4. Enabled 'toc' on TaskDetailsModal, WikiDetail preview modal, FilePreviewModal (tab hides automatically when content has no headings, e.g. edit mode or non-markdown files).
5. Verified: bunx tsc --noEmit, bun run check ., bun run build; new src/test/web-toc-drawer.test.tsx (4 tests), existing web-toc.test.tsx (23) and 43 modal-related tests pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deviation from plan: instead of passing per-modal container refs, Modal now collects headings from its own scrollable content container, so enabling the feature is a single 'toc' boolean prop. To support a floating panel as tall as the modal, the panel no longer scrolls itself: it is a flex column whose content div is the scroll container (visual behavior unchanged). Folding logic and outline rows were extracted from TocButton into shared useTocTree hook and TocRows component, reused by both TocButton and TocDrawer. On narrow screens (<sm) the floating panel overlays the modal's left edge instead of docking outside it.

Style pass after first review: bookmark is now a narrow column with the icon above the vertical label; the floating panel uses four rounded corners and keeps an 8px gap from the modal (sm:mr-2 when docked outside, left-2 inset when overlaying on narrow screens) instead of sitting flush against it.

FilePreviewModal width raised from max-w-4xl (896px) to max-w-6xl (1152px) per user request, making it 12.5% wider than the task details modal (max-w-5xl, 1024px).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kimi
created: 2026-10-01 07:26
---
Plan revised per user request: instead of widening the modal (causes layout jitter), the outline opens as a floating panel to the left of the modal, same height as the modal; the bookmark tab hides while the panel is open and reappears when it is closed.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a bookmark-style outline drawer to Modal-based markdown previews (task details, wiki preview, file preview).

Changes:
- New TocDrawer component: bookmark tab on the modal's left edge opens a floating outline panel as tall as the modal; the tab hides while open and returns on close; the modal never resizes (no jitter)
- Modal: new 'toc' boolean prop; panel restructured to a flex column with an inner scroll container so the floating panel can match its height; headings collected locally via useTocItems/useActiveTocId (no TocContext)
- Extracted shared useTocTree hook and TocRows component from TocButton; TocButton refactored to use them, behavior unchanged
- Enabled toc on TaskDetailsModal, WikiDetail preview modal, FilePreviewModal

Verification:
- bun test: new web-toc-drawer.test.tsx (4 tests) + existing web-toc.test.tsx (23) pass; 43 modal-related tests pass
- bunx tsc --noEmit, bun run check ., bun run build all pass
<!-- SECTION:FINAL_SUMMARY:END -->

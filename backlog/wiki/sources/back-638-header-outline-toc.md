---
title: BACK-638 Add a header outline button with a floating, foldable TOC for documentation, decisions and wiki pages
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - content-viewer
  - toc
source_path: backlog/tasks/back-638 - Add-a-header-outline-button-with-a-floating-foldable-TOC-for-documentation-decisions-and-wiki-pages.md
---

# BACK-638 Add a header outline button with a floating, foldable TOC for documentation, decisions and wiki pages

Reading pages needed an outline that neither takes a permanent column nor scrolls away. This task put an outline button in the header (left of the theme toggle) that floats a foldable table of contents over the content, built in four iterations: floating panel, folding, then a master fold-all control.

## Summary

- New `src/web/contexts/TocContext.tsx` (`TocProvider` + `usePageToc`): the active reading page publishes the headings of its rendered DOM; the slot is cleared on unmount only when the page still owns it, since the replacing page mounts first
- New `src/web/components/TocButton.tsx`: renders nothing when the page published no headings (which also covers edit mode); panel anchored below the button, closes on selection, Escape and outside mousedown, capped to viewport width
- DocumentationDetail, DecisionDetail and WikiDetail register via `usePageToc(contentRef, isEditing ? null : content)` and keep full content width; the earlier sticky right-hand rail was removed before ever being committed
- Entries come from the rendered DOM (heading id + `data-heading-text`), so duplicate-heading suffixes and CJK titles always match the renderer's anchors; nesting attaches each entry to the closest preceding shallower entry because heading levels may skip
- Folding: entries owning a subtree get a chevron; outlines longer than 20 entries open with deeper levels folded; the branch holding the current section auto-opens so the scrollspy highlight stays reachable
- Master control: two-state fold-all/unfold-all in the panel header, absent for branch-less outlines; an explicit fold-all sets a `foldAllRef` flag that suppresses scroll-driven auto-expansion until the reader interacts again (a CDP run showed 1 row after fold-all vs 18 rows after scrolling without the guard)
- Scrollspy runs only while the panel is open so page scrolling doesn't re-render the header; entries share `activateHashTarget` with in-document anchor links
- i18n: toc title, chevron and expand-all/collapse-all labels in en, zh-CN, zh-TW, ja; tests: `web-toc.test.tsx` grown to 23 cases, 149 web tests pass, verified over CDP including a 720px viewport

## Acceptance Criteria

- Documentation, decision and wiki read views publish headings to a header outline button; hidden without headings and while editing
- Panel floats over content (full prose width kept), entries indent by level, click scrolls and updates the URL hash, scrollspy highlights the current section
- Long outlines open folded below the top level; the current section's branch auto-opens; a master control folds/unfolds everything and a manual fold-all survives scrolling
- Chinese headings resolve to the correct heading ids; panel closes on Escape and outside clicks

## Related Concepts

- [[concepts/web-ui-features]] — reading-page chrome and scrollspy conventions
- [[concepts/web-ui-i18n]] — label additions across the four locales
- [[concepts/markdown-pipeline]] — rendered-DOM heading ids the outline consumes

## Related Sources

- [[sources/back-637-hash-anchors-on-load]] — anchor infrastructure (`hash-target.ts`, `useHashScroll`) this builds on
- [[sources/back-536-in-document-hash-links]] — shared `activateHashTarget` scroll/hash behaviour

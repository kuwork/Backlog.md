---
id: BACK-523
title: Wiki wikilinks alias support with Markdown/HTML labels and markdown-it-attrs
status: Done
assignee:
  - kimi
created_date: '2026-06-27 19:13'
updated_date: '2026-06-27 20:45'
labels:
  - wiki
  - feature
  - frontend
dependencies: []
modified_files:
  - src/web/utils/wikiLinks.ts
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/WikiDetail.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/test/wiki-links.test.ts
  - src/test/mermaid-markdown.test.tsx
  - src/test/resolve-wiki-path.test.ts
priority: medium
ordinal: 175400
actual_start: '2026-06-27 19:14'
actual_end: '2026-06-27 20:45'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enhance the wiki wikilink parser/renderer so that the alias portion of `[[target|alias]]` supports rich formatting and so that wikilinks can be annotated with attributes via markdown-it-attrs syntax.

Currently the wiki only supports the basic form `[[path/to/page]]`. The alias form `[[target|alias]]` is explicitly documented as unsupported, and there is no way to add custom classes or inline styles to a wikilink.

Scope of work:
1. Create `src/web/utils/wikiLinks.ts` with `resolveWikiPath`, `prepareWikiMarkdown`, attribute parsing helpers, and alias inline formatting support (code, bold, italic, strikethrough, inline HTML).
2. Extend `MermaidMarkdown` with an optional `wikilinkBasePath` prop: transform `[[...]]` to raw `<a data-wikilink="true">` tags and render them through the existing `LinkComponent`, while keeping the existing local URL short-alias behavior for plain `/wiki/...` links.
3. Update `WikiDetail` to pass `page.content` directly with `wikilinkBasePath` instead of pre-replacing `[[...]]` in place.
4. Enable wikilink transformation in non-wiki contexts by passing `wikilinkBasePath="index.md"` in `TaskDetailsModal`, `DocumentationDetail`, and `DecisionDetail`.
5. Fix `resolveWikiPath` so pages already under `wiki/` or `wiki_output/` are resolved against their real directory instead of being prefixed with an extra `wiki/`.
6. Allow arbitrary inline HTML inside the alias, e.g. `<span style="color: red;">...</span>`.
7. Support markdown-it-attrs-style attribute blocks after the wikilink:
   - `[[target]]{style="color: red;"}`
   - `[[target]]{.some-class}`
8. Add/update unit tests for `resolveWikiPath` and the wikilink renderer, covering alias parsing, Markdown/HTML alias content, and attribute injection.

Reference examples:

````text
[[pages/integrations/bidirectional-links/demo|```single line code```]]
[[pages/integrations/bidirectional-links/demo|**bold prefix** middle content **bold suffix**]]
[[pages/integrations/bidirectional-links/demo|*italic prefix* middle content *italic suffix*]]
[[pages/integrations/bidirectional-links/demo|~~strikethrough prefix~~ middle content ~~strikethrough suffix~~]]
[[pages/integrations/bidirectional-links/demo|<span style="color: red;">custom HTML</span>]]
[[pages/integrations/bidirectional-links/demo|<span style="color: red;">custom HTML</span> middle content <span style="color: blue;">custom HTML</span>]]
[[demo-page]]{style="color: red;"}
[[demo-page]]{.some-class}
````
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Basic [[target|alias]] wikilinks resolve the target path and render the alias as the link text
- [x] #2 Markdown inline formatting (code, bold, italic, strikethrough) inside the alias renders correctly
- [x] #3 Inline HTML inside the alias renders correctly and is sanitized safely
- [x] #4 markdown-it-attrs syntax [[target]]{...} is parsed and applied to the rendered link element
- [x] #5 Existing [[path/to/page]] behavior remains unchanged
- [x] #6 Unit tests cover alias parsing, rich alias content, and attribute injection
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create `src/web/utils/wikiLinks.ts` with `resolveWikiPath`, `prepareWikiMarkdown`, attribute parsing helpers, and alias inline formatting support (code, bold, italic, strikethrough, inline HTML).
2. Extend `MermaidMarkdown` with an optional `wikilinkBasePath` prop: transform `[[...]]` to raw `<a data-wikilink="true">` tags and render them through the existing `LinkComponent`, while keeping the existing local URL short-alias behavior for plain `/wiki/...` links.
3. Update `WikiDetail` to pass `page.content` directly with `wikilinkBasePath` instead of pre-replacing `[[...]]` in place.
4. Enable wikilink transformation in non-wiki contexts by passing `wikilinkBasePath="index.md"` in `TaskDetailsModal`, `DocumentationDetail`, and `DecisionDetail`.
5. Fix `resolveWikiPath` so pages already under `wiki/` or `wiki_output/` are resolved against their real directory instead of being prefixed with an extra `wiki/`.
6. Add/extend unit tests in `src/test/wiki-links.test.ts`, `src/test/mermaid-markdown.test.tsx`, and `src/test/resolve-wiki-path.test.ts`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Alias formatting is implemented via a lightweight regex pipeline rather than a full remark/rehype pass. This avoids `react-markdown` stripping or re-wrapping custom elements, and keeps the output compatible with `MermaidMarkdown`'s existing link component.
- markdown-it-attrs is parsed manually: `.class`, `#id`, `style="..."`, and arbitrary `key="value"` pairs are supported. Attribute values are HTML-escaped before being written into the generated `<a>` tag.
- Unresolved wikilinks (e.g. traversal escaping the project root) render as `<del>alias</del>`.
- Plain local URLs such as `/wiki/...` still render as short aliases (WIKI#...). Wikilinks with an explicit alias override that fallback and render the custom alias text.
- `prepareWikiMarkdown` escapes stray `<` characters while protecting fenced code, inline code, and the generated `<a>` tags, preventing React crashes like the BACK-377 regression.
- `resolveWikiPath` treats the current page as living under `wiki/` only when the page path is not already inside `wiki/` or `wiki_output/`. This keeps relative links correct for both wiki pages and wiki_output pages.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented wiki wikilink alias and markdown-it-attrs support, extended it to non-wiki contexts, and fixed path resolution for wiki_output pages.

Changes:
- Added src/web/utils/wikiLinks.ts with resolveWikiPath, prepareWikiMarkdown, attribute parsing helpers, and rich alias formatting (code, bold, italic, strikethrough, inline HTML).
- Extended MermaidMarkdown with an optional wikilinkBasePath prop; wikilinks are transformed to raw <a data-wikilink="true"> tags and rendered through the existing LinkComponent.
- Updated WikiDetail to pass page.content directly with wikilinkBasePath instead of pre-replacing [[...]] in place.
- Enabled wikilink transformation in TaskDetailsModal, DocumentationDetail, and DecisionDetail by passing wikilinkBasePath="index.md".
- Fixed resolveWikiPath so pages already under wiki/ or wiki_output/ are resolved against their real directory instead of being prefixed with an extra wiki/.
- Added/extended unit tests in src/test/wiki-links.test.ts, src/test/mermaid-markdown.test.tsx, and src/test/resolve-wiki-path.test.ts.

Wiki documentation updates (wikilink.md and demo page) were handled separately in BACK-525.

Verification: targeted tests pass (44 tests).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

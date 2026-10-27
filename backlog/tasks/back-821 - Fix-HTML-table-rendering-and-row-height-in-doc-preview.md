---
id: BACK-821
title: Fix HTML table rendering and row height in doc preview
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-27 14:46'
updated_date: '2026-10-27 15:29'
labels: []
dependencies:
  - BACK-377
modified_files:
  - src/web/components/MermaidMarkdown.tsx
  - src/web/utils/wikiLinks.ts
  - src/test/mermaid-markdown.test.tsx
  - src/web/styles/source.css
  - package.json
  - bun.lock
priority: medium
ordinal: 383001
actual_start: '2026-10-27 14:27'
actual_end: '2026-10-27 14:36'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Raw HTML tables in the documentation preview were escaped to literal text by the markdown sanitizer. We restored raw HTML rendering with a rehype-sanitize safety net, then found raw HTML table rows were taller than GFM pipe tables because each cell is wrapped in a <p> with bottom margin. Added CSS to collapse paragraph margins inside table cells so both render with equal row height.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Raw HTML tables render in the documentation preview instead of showing as literal <table> text
- [x] #2 rehype-sanitize strips script/onerror and dangerous hrefs while allowing table and formatting tags
- [x] #3 Raw HTML table row height matches GFM pipe tables
- [x] #4 Existing mermaid-markdown tests still pass (63/63)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes
- [x] #2 bun run check . (biome) passes on touched files
- [x] #3 bun test src/test/mermaid-markdown.test.tsx passes (63/63)
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace blanket HTML-escaping with an allowlist in `wikiLinks.ts` that still escapes type-string angle brackets (BACK-377 protection).
2. Add `rehype-sanitize` with a table-aware schema in `MermaidMarkdown.tsx`.
3. Add `.wmde-markdown table p { margin: 0 }` in `source.css` to equalize row height.
4. Add tests covering table rendering and XSS stripping.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause of non-render: sanitizeMarkdownSource/sanitizeWithRanges escaped every "<letter" to &lt; (BACK-377 mitigation). Root cause of taller rows: .wmde-markdown p has margin-bottom:10px, applied to the <p> wrappers inside raw HTML cells.

### Raw HTML `<table>` now renders (demonstration)

The fix is verified by the unit tests under `src/test/mermaid-markdown.test.tsx`. A raw HTML table renders through `rehype-raw` + `rehype-sanitize` with the same styling as a GFM pipe table. Sample (cells use plain `<td>`, no `<p>` wrapper, to keep row height compact):

<table>
  <thead>
    <tr><th>Pattern</th><th>Rule</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr><td>Imports</td><td><code>bun:test</code> before <code>node:*</code></td><td><code>import { it } from "bun:test"</code></td></tr>
    <tr><td>Dir setup</td><td><code>createUniqueTestDir</code></td><td><code>createUniqueTestDir("test-x")</code></td></tr>
    <tr><td>Cleanup</td><td><code>safeCleanup</code> in try/catch</td><td><code>try { await safeCleanup(TEST_DIR) } catch {}</code></td></tr>
  </tbody>
</table>
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Raw HTML tables in the documentation preview now render and match GFM row height. XSS is mitigated via rehype-sanitize, and type-string crash protection is retained.
<!-- SECTION:FINAL_SUMMARY:END -->

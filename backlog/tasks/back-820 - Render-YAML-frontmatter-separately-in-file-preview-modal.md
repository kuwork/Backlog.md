---
id: BACK-820
title: Render YAML frontmatter separately in file preview modal
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-23 04:05'
labels:
  - web-ui
  - bug
dependencies: []
modified_files:
  - src/web/components/FilePreviewModal.tsx
  - src/web/utils/frontmatter-extract.ts
  - src/test/frontmatter-extract.test.ts
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
ordinal: 382001
actual_start: '2026-10-23 03:35'
actual_end: '2026-10-23 03:53'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task detail modals open referenced documents through FilePreviewModal, which streams the raw file — including its YAML frontmatter — straight into the markdown renderer. The `--- ... ---` block therefore appears as broken horizontal rules and literal text at the top of the preview, instead of being presented like a real document.

Document views never show this problem because `Document.rawContent` is already stripped of frontmatter (src/types/index.ts:55). This task makes the file preview mirror that behavior: detect a leading YAML block, render it as a separate metadata panel, and render only the body.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Files opened from task references or doc links via FilePreviewModal no longer render the raw --- YAML fence as markdown
- [x] #2 Leading YAML frontmatter is extracted and shown as a separate metadata panel above the document body
- [x] #3 The document body, with the --- fence and leading blank lines removed, renders normally through MermaidMarkdown
- [x] #4 Partial / line-range previews and files without frontmatter keep their existing behavior
- [x] #5 A display-only extractor avoids importing gray-matter into the web bundle
- [x] #6 en/zh-CN/zh-TW/ja locales add a filePreview.frontmatter label
- [x] #7 Unit tests cover the extractor (no-frontmatter, quoted keys, lists, non-leading ---, CRLF) and pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes
- [x] #2 bun run check . (biome) passes on touched files
- [x] #3 bun test passes for the frontmatter-extract suite (6/6)
- [x] #4 No new runtime dependency is added to the web bundle
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a display-only frontmatter extractor (src/web/utils/frontmatter-extract.ts) that returns `{ data, content }` for a leading `---` fenced YAML block, without pulling gray-matter into the web bundle.
2. Add unit tests (src/test/frontmatter-extract.test.ts) covering: no frontmatter, quoted keys, list values, non-leading `---`, and CRLF line endings.
3. Wire the extractor into FilePreviewModal.tsx: for full markdown previews, render the frontmatter as a `dl` metadata panel above the body; pass only the body to MermaidMarkdown.
4. Keep partial / line-range previews and frontmatter-free files unchanged.
5. Add a `filePreview.frontmatter` label to en/zh-CN/zh-TW/ja locales.
6. Verify with tsc, biome, and the unit test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
1. Created src/web/utils/frontmatter-extract.ts with a regex anchored at the very start of the source (matching `^---\n...\n---\n`) so a `---` appearing later in the body is not mistaken for a fence; list items are flattened into their parent value. Deliberately avoided reusing src/markdown/frontmatter.ts because it wraps gray-matter and would bloat the browser bundle.
2. src/test/frontmatter-extract.test.ts added with 6 cases; all pass.
3. FilePreviewModal.tsx: added the extraction via useMemo over `[content, isMarkdown]`, and inserted a metadata panel (React.Fragment keyed `dl`) before the MermaidMarkdown block, rendering only `frontmatter.content`.
4. Partial preview path (`isPartial`) and the non-markdown branch are untouched.
5. en/zh-CN/zh-TW/ja gained a `filePreview.frontmatter` label, localized to "Frontmatter" in English and Japanese and the equivalent metadata term in the Chinese locales.
6. Verification: `bunx tsc --noEmit` clean; biome clean on touched files; frontmatter-extract test 6/6.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
FilePreviewModal now renders a referenced document's YAML frontmatter as a standalone metadata panel instead of letting it leak into the markdown render area. A new lightweight extractor (frontmatter-extract.ts, intentionally gray-matter-free) splits the leading YAML block from the body; the body is forwarded to MermaidMarkdown while the metadata renders as a `dl`. Partial previews and frontmatter-free files are unaffected. All four locales expose a Frontmatter label. tsc, biome, and the new unit test are green; no new runtime dependency enters the web bundle.
<!-- SECTION:FINAL_SUMMARY:END -->

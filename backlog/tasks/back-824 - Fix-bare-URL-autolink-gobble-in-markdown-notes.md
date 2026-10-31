---
id: BACK-824
title: Fix bare URL autolink gobble in markdown notes
status: Done
assignee:
  - '@hy3'
created_date: '2026-10-28 10:41'
updated_date: '2026-10-28 10:41'
labels:
  - web
  - markdown
dependencies: []
documentation: []
modified_files:
  - src/web/components/MermaidMarkdown.tsx
  - src/test/mermaid-markdown.test.tsx
priority: medium
ordinal: 386001
actual_start: '2026-10-28 10:29'
actual_end: '2026-10-28 10:41'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task implementation notes (and any markdown rendered through `MermaidMarkdown`) that contain a bare `http(s)://` URL written flush against CJK text or full-width punctuation render as a broken hyperlink.

Root cause: GFM `autolink-literal` linkifies a bare URL greedily. When the URL sits flush against CJK prose / full-width punctuation, it swallows the trailing text into one giant `<a>` (all the way to the next `[`), which (a) produces a wrong/over-long link and (b) consumes the leading `[` of any following `[text](dest)` link, leaving that link as broken literal text `](dest)`. This is why an earlier `:range` colon fix alone did not resolve the visible symptom — the colon fix only matters once the autolink gobble is removed, because the gobble masks it.

The fix bounds every bare URL at a hard boundary so it is its own clean, clickable link and the rest of the line renders normally.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A bare `http(s)://` (or `www.`) URL flush against CJK text / full-width punctuation renders as its own clean `<a href>` pointing exactly at the URL, not swallowing the following prose.
- [x] #2 A bare URL immediately followed by a `[text](dest)` link no longer breaks that link; the `[text](dest)` link renders as a normal link.
- [x] #3 Bare URLs already inside a link destination `](https://…)`, inline code, or fenced code blocks are left untouched (no double-wrapping).
- [x] #4 `bunx tsc --noEmit` and `bun test src/test/mermaid-markdown.test.tsx` pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 `bunx tsc --noEmit` passes (TypeScript touched).
- [x] #2 `bun test src/test/mermaid-markdown.test.tsx` passes (new regression test included).
- [x] #3 Modified files recorded.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `linkifyBareUrls(source)` in `src/web/components/MermaidMarkdown.tsx`: a preprocessing pass that wraps bare `http(s)://` / `www.` URLs in explicit `[url](url)` markdown links.
2. Boundary rule: the URL body stops at whitespace, `<` `>` `]`, quotes/backtick, CJK ideographs (U+4E00–U+9FFF), and full-width / CJK punctuation (U+3000–U+303F, U+FF01–U+FF5E), so prose can never be swallowed. Use a negative lookbehind `(?<![(\s])` so URLs already inside a link destination `](…)` are skipped, and reuse `getMarkdownCodeRanges` to protect code blocks / inline code.
3. Wire `linkifyBareUrls` into the render preprocessing: compute `processed = linkifyBareUrls(source)` first, then feed `processed` into the existing `encodeLocalFileLinkDestinations` / `sanitizeRawHtmlAngleBrackets` (non-wiki path) and `prepareWikiMarkdown` (wiki path) so both paths get the same treatment.
4. Add a regression test rendering a note fragment with a bare URL flush against CJK text followed by a `[text](dest)` link, asserting the URL is a clean link, the trailing prose stays outside it, and the following link renders as a link.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Pipeline order (in `MermaidMarkdown`): `linkifyBareUrls(source)` -> `encodeLocalFileLinkDestinations(processed)` -> `sanitizeRawHtmlAngleBrackets(encoded, getMarkdownCodeRanges(encoded))` (non-wiki) or `encodeLocalFileLinkDestinations(prepareWikiMarkdown(processed, wikilinkBasePath))` (wiki). The earlier `:range` colon fix in `encodeLocalFileLinkDestinations` (prefix `./` for bare destinations whose first `:` precedes any `/`) now actually takes effect because the preceding autolink gobble no longer masks it.
- `linkifyBareUrls` regex:
  ```
  /(?<![(\s])((?:https?:\/\/|www\.)[^\s<>\]"'`\u0060\u4e00-\u9fff\u3000-\u303f\uff01-\uff5e]+)/gi
  ```
  For `www.` matches the href is prefixed with `http://`; `https?://` matches are kept as-is.
- Verified with the full unified pipeline (remark-parse + remark-gfm + remark-rehype + rehype-sanitize with `SAFE_HTML_SCHEMA`): a bare URL flush against CJK text renders as its own `https://…` `<a>` with the trailing full-width punctuation and prose outside the link, and a following `[text](dest)` link renders as a normal link.
- `bunx tsc --noEmit` clean; `bun test src/test/mermaid-markdown.test.tsx` 64/64 (was 63/63 before; +1 regression test).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
- Follow-up (not done here, needs user approval): clicking a relative `.md:range` file link currently renders as a link but has no in-file line-range router — only `/documentation/`, `/task/`, `/draft/`, `/decisions/`, `/wiki/` `:range` links are consumed. Clicking a plain `.md:range` link falls back to `window.open` / fetch failure. Wire `:range` stripping + `FilePreview` scroll if in-file jump is wanted.
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed a markdown rendering bug where a bare `http(s)://` URL written flush against CJK text / full-width punctuation was swallowed by GFM autolink-literal into one giant link and, by consuming the next `[`, also broke any following `[text](dest)` link.

Added `linkifyBareUrls` in `src/web/components/MermaidMarkdown.tsx`: a preprocessing pass that wraps bare URLs in explicit `[url](url)` links bounded at whitespace, `<>` `]`, quotes/backtick, CJK ideographs, and full-width / CJK punctuation — so the URL is its own clean clickable link and prose after it renders normally. URLs inside link destinations or code are skipped. Wired into both the wiki and non-wiki render paths.

Changes: `src/web/components/MermaidMarkdown.tsx`, `src/test/mermaid-markdown.test.tsx`.

Verification: `bunx tsc --noEmit` passes; `bun test src/test/mermaid-markdown.test.tsx` 64/64 (added a regression test for the bare-URL-gobble scenario). commit/push by user.
<!-- SECTION:FINAL_SUMMARY:END -->

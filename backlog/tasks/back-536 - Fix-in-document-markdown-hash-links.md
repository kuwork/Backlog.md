---
id: BACK-536
title: Fix in-document markdown hash links
status: Done
assignee:
  - '@kimi'
created_date: '2026-04-25 12:14'
updated_date: '2026-08-01 15:19'
labels:
  - migration
dependencies: []
references:
  - src/web/components/MermaidMarkdown.tsx
  - src/markdown/hash-links.ts
modified_files:
  - src/web/components/MermaidMarkdown.tsx
  - src/test/mermaid-markdown.test.tsx
  - src/markdown/hash-links.ts
  - src/test/hash-links.test.ts
  - src/web/components/DecisionDetail.tsx
  - src/web/components/DocumentationDetail.tsx
  - backlog/docs/migration/doc-5 - A类上游任务迁移分析报告（v1.47.1-..-v1.48.0）.md
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/mcp/documents.md
priority: medium
actual_start: '2026-08-01 09:27'
actual_end: '2026-08-01 22:19'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rendered markdown in tasks/documents/decisions uses `<base href="/">`, which causes in-document heading links (`[link](#heading)`) to leave the current view and navigate to the app root instead of the current document context.

Fix the shared markdown renderer so that hash-only links are resolved against the current browser route and query string, keeping same-page navigation inside the current document context.

Additionally, align heading anchor generation with upstream by using github-slugger for all heading IDs, while preserving human-friendly anchor resolution. Section-prefixed headings (e.g. '1.1 Section Title', 'A1: Section Title', '1.1. Section Title', '1.2、 Section Title') record their prefix and full title as metadata so that humans can write maintainable table-of-contents links. For simple prefix anchors use `[A1](#A1)`. For full-heading-title anchors that contain spaces or special characters, use the angle-bracket form `[A1: Section Title](<#A1: Section Title>)`. When a document or decision is saved through the Web UI, these human-readable hash anchors are automatically rewritten to the corresponding github-slugger slugs (e.g. `[A1: Section Title](#a1-section-title)`) so the saved source remains standard markdown while the heading text stays unchanged. Direct markdown editing outside the Web UI may keep the human-readable prefix or angle-bracket form because the renderer resolves both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.47.1..v1.48.0 --grep BACK-426` and `git show 51a7033` as implementation reference.
- [x] #2 Rendered markdown headings use github-slugger IDs for upstream compatibility.
- [x] #3 Links using `#anchor` navigate within the rendered document without leaving the current document context unexpectedly.
- [x] #4 Human-friendly anchors like `#A1` and `#A1: Section Title` resolve to the matching github-slugger heading.
- [x] #5 Web UI save of documents/decisions normalizes human-readable TOC anchors to github-slugger slugs without changing headings.
- [x] #6 Tests cover github-slugger heading IDs, prefix/full-title anchor resolution, and save-time normalization.
- [x] #7 Migration report doc-5 uses human-readable prefix-based TOC links.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect MermaidMarkdown heading-anchor / link handling and confirm <base href="/"> is still present.
2. Re-implement hash-only link resolution: intercept href="#..." and resolve it to current browser route + query string + hash, keeping same-page navigation inside the task/document/decision view.
3. Replace the prefix-only heading ID plugin with a metadata plugin that assigns github-slugger IDs to all headings and stores `data-heading-prefix` and `data-heading-text` for prefixed headings.
4. Extend the hash click handler to resolve human-friendly anchors (`#A1`, `#A1: Section Title`, full heading text) via heading metadata when the raw anchor does not match a github-slugger ID.
5. Add `normalizeMarkdownHashLinks` in `src/markdown/hash-links.ts` using remark/unified and github-slugger; wire it into `DocumentationDetail.tsx` and `DecisionDetail.tsx` so Web UI saves rewrite human-readable TOC anchors to github-slugger slugs without changing headings.
6. Update migration report doc-5 TOC to use human-readable prefix links.
7. Add regression tests for github-slugger heading IDs, prefix/full-title anchor resolution, and save-time normalization.
8. Run `bun test src/test/mermaid-markdown.test.tsx src/test/hash-links.test.ts`, `bunx tsc --noEmit`, and scoped `bunx biome check`; document the global `bun run check .` blocker if it only reports pre-existing warnings in unrelated files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Hash-only link fix
- Added an early branch inside MermaidMarkdown LinkComponent for href values starting with '#'.
- Resolves the href to `${window.location.pathname}${window.location.search}${href}` so that the page-level <base href="/"> no longer sends anchor links to the application root.
- The click handler prevents default browser navigation, smooth-scrolls to the target element when present, updates the URL via history.pushState, and falls back to a full location change if the target element is missing.

### Heading github-slugger IDs with prefix metadata
- Replaced the prefix-only heading ID plugin with `rehypeHeadingMetadata`.
- All headings now receive IDs generated by github-slugger for upstream compatibility.
- The plugin also records `data-heading-prefix` and `data-heading-text` on each prefixed heading.
- The click handler uses these attributes as a fallback so human-friendly anchors like `#A1`, `#A1: Section Title`, or full-heading-title anchors written with angle brackets (`<#A1: Section Title>`) still scroll to the correct heading even though the rendered ID is a github-slugger slug.
- The click handler decodes percent-encoded URLs (markdown-it encodes spaces in `<...>` link destinations) and supports prefix-based starts-with matching so partial heading-title anchors resolve.

### Web UI save-time normalization
- Added `normalizeMarkdownHashLinks` in `src/markdown/hash-links.ts`.
- It parses the document with remark/unified, computes github-slugger slugs for every heading, and rewrites hash-only TOC links that use a heading prefix or full title to the corresponding slug.
- Angle-bracket link destinations (`<#A1: Section Title>`) are also normalized and the angle brackets are removed because github-slugger slugs never contain spaces.
- Integrated into `DocumentationDetail.tsx` and `DecisionDetail.tsx` so documents/decisions saved through the Web UI store standard github-slugger anchors while keeping headings and link text human-readable.

### Tests
- Existing hash-link regression test now passes.
- Updated heading tests to expect github-slugger IDs and verify prefix metadata.
- Added a new interactive test verifying that a click on `#A1` resolves to the github-slugger heading.
- Added another interactive test verifying that an angle-bracket full-title anchor (`<#A1: Section Title (details)>`) decodes and resolves to the matching heading.
- Added `src/test/hash-links.test.ts` covering prefix, full-title, already-normalized, numeric, duplicate, external-link, and angle-bracket cases.
- Updated migration report doc-5 TOC to use human-readable prefix links like `[A1：BACK-355 任务类型字段](#A1)`.

### Documentation
- Added a section to `src/guidelines/cli-instructions/documents.md` explaining how to write in-document markdown hash links, including prefix anchors, angle-bracket full-title anchors, and github-slugger slugs, plus the Web UI normalization behavior.
- Added a "Complex content with backticks or shell-sensitive characters" subsection to the CLI document explaining that documents should be created without content and the body appended with a text editor/file-writing tool when the markdown contains backticks or other shell-sensitive characters, keeping the YAML frontmatter block present. The frontmatter contents may be overwritten if needed, but the block itself must not be removed. The reason is that backticks trigger shell command substitution when passed through `--content` / `--append-content`.
- Synchronized the in-document hash links and local backlog links guidance to `src/guidelines/mcp/documents.md` (without the backtick workaround, since MCP passes content as JSON and has no shell escaping layer).
- Combined the hash-link guidance with BACK-511's local URL alias behavior, documenting how `/task/:id`, `/documentation/:id`, `/decisions/:id`, `/draft/:id`, and `/wiki/:path` paths are rendered as short aliases (`TASK#:id`, `DOC#:id`, etc.) in documents. Empty link text falls back to the default alias, while custom labels are preserved. The examples in `documents.md` were simplified to use the ID-only path form (e.g. `[TASK#506](/task/506)`) because the title slug is optional and ignored when generating the alias.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed hash-only markdown links in MermaidMarkdown and added Web UI save-time normalization. Rendering now uses github-slugger for all heading IDs (upstream-compatible) while keeping human-friendly anchors working via `data-heading-prefix` and `data-heading-text` metadata. The click handler resolves `#A1`, `#A1: Section Title`, and angle-bracket `<#A1: Section Title>` style anchors to the matching github-slugger heading, decoding percent-encoded URLs and using prefix-based starts-with matching. Added `normalizeMarkdownHashLinks` and wired it into document/decision save paths so the Web UI rewrites human-readable TOC anchors (including angle-bracket forms) to plain github-slugger slugs without changing heading text. Updated migration report doc-5 to use clean prefix-based TOC links. Added documentation to `src/guidelines/cli-instructions/documents.md` covering in-document hash links and combining it with BACK-511's local URL alias behavior; empty link text falls back to the default alias, while custom labels are preserved. The documented local-link examples use the ID-only path form (e.g. `[TASK#506](/task/506)`) because the title slug is optional and ignored when generating the alias. Also documented the CLI backtick/shell-sensitive-content workaround (create without content, append body with a text tool while keeping the YAML frontmatter block present) because backticks inside `--content` / `--append-content` arguments trigger shell command substitution. Synchronized the links guidance to `src/guidelines/mcp/documents.md` without the backtick workaround, since MCP passes content as JSON and has no shell escaping layer. Validation: `bun test src/test/mermaid-markdown.test.tsx` (44 pass), `bun test src/test/hash-links.test.ts` (9 pass), `bunx tsc --noEmit` (pass), scoped `bunx biome check` passes; global `bun run check .` still reports 3 pre-existing warnings in unrelated `src/core/assets.ts`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched.
- [x] #2 Scoped Biome check passes for touched files; global `bun run check .` only reports 3 pre-existing warnings in unrelated `src/core/assets.ts`.
- [x] #3 `bun test src/test/mermaid-markdown.test.tsx` and `bun test src/test/hash-links.test.ts` pass.
- [x] #4 Migration report doc-5 uses human-readable prefix-based TOC links.
- [x] #5 Web UI document/decision save paths normalize hash links to github-slugger slugs.
<!-- DOD:END -->

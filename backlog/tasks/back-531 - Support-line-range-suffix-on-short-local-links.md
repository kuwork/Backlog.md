---
id: BACK-531
title: Support line-range suffix on short local links
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-28 07:55'
updated_date: '2026-07-28 23:11'
labels:
  - enhancement
dependencies:
  - BACK-511
references:
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/FilePreviewModal.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/TaskDetailsModal.tsx
priority: medium
ordinal: 184400
actual_start: '2026-07-28 07:57'
actual_end: '2026-07-28 23:11'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the short local URL syntax used in rendered Markdown (e.g., /documentation/5, /task/42, /draft/3, /decisions/7, /wiki/foo) so users can append a colon-prefixed line range such as :19-29 or :15.

Desired display behavior:
- When a short local link has a custom Markdown label (e.g., ```[doc-5 A1](/documentation/5:16-27)```), render that custom label as-is and do not replace it with the system alias.
- When a short local link has no custom label (e.g., ```[/documentation/5:16-27](/documentation/5:16-29)``` or the link text is the URL itself), render the system short alias with the line range appended, such as DOC#5:16-27, TASK#42:15, or WIKI#concepts/demo:10-20.
- When a short local link has no line-range suffix, keep the existing BACK-511 short-alias behavior (e.g., DOC#5, TASK#42).
- Relative project file paths (e.g., backlog/docs/migration/doc-5.md) must not be treated as short local links; they keep their own text and open the file preview modal on click.

Click behavior:
- Clicking a short local link that has a line-range suffix should open the referenced entity in a preview modal, scoped to the requested line range, instead of navigating to a full page.
- Links without a line-range suffix continue to behave exactly as before (modal or navigation according to their existing handlers).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Short local URLs in Markdown accept a trailing :N-M or :N suffix and are parsed correctly
- [x] #2 Links with a line-range suffix open a preview modal for the referenced entity
- [x] #3 The preview displays the requested line range for markdown and code content
- [x] #4 Works for /doc/*, /task/*, /draft/*, /decisions/*, and /wiki/* short links
- [x] #5 Links without the suffix continue to behave exactly as before
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend parseLocalUrl in MermaidMarkdown.tsx to parse trailing :N or :N-M line ranges and pass range to existing click handlers.
2. Add apiClient helpers to resolve a short local link (task/draft/doc/decision/wiki) to a project file path and fetch its preview content with line range.
3. Add server support: /api/drafts/:id endpoint and include filePath in decision responses.
4. Wire DocumentationDetail.tsx and TaskDetailsModal.tsx to open FilePreviewModal for line-range links instead of navigating.
5. Add tests for parsing and rendering, then run tsc/check/tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Latest iteration: refined link label handling for short local links.

1. parseLocalUrl now builds the alias with the line range suffix when a range is present (e.g. DOC#5:16-27, TASK#42:15).
2. LinkComponent prefers a custom markdown label when it looks like a real label (non-empty string, not a URL, not a path, and different from href). For example, [doc-5 A1](/documentation/5:16-27) renders as 'doc-5 A1'.
3. If no custom label is provided (link text is the URL/path itself, or is empty), the system alias with range is used instead.
4. Wikilinks keep their explicit alias behavior unchanged.

Verification: bun test src/test/mermaid-markdown.test.tsx (35 pass, 0 fail); bunx tsc --noEmit (pass).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented line-range suffix support for short local Markdown links and fixed related label/click behavior.

Changes:
- Extended parseLocalUrl in MermaidMarkdown.tsx to detect trailing :N or :N-M ranges on /task/*, /draft/*, /documentation/*, /decisions/*, and /wiki/* links.
- The alias returned by parseLocalUrl now includes the range suffix when present (e.g. DOC#5:16-27, TASK#42:15).
- Short local links prefer a real custom markdown label when provided; otherwise they fall back to the system alias. A custom label is a non-empty string that is not a URL, not a path, and not identical to the href.
- Wired DocumentationDetail.tsx and TaskDetailsModal.tsx to open FilePreviewModal for line-range links via preview:// instead of navigating.
- Added server-side /api/preview support and fetchPreview API helper to resolve short links to file paths with ranges.
- Relative file paths (e.g. backlog/docs/...) are not misidentified as short local links; they keep their custom text and open the file preview modal.
- encodeLocalFileLinkDestinations percent-encodes spaces in local file link destinations so markdown-it parses them, and the file-preview click handler decodes the href before fetching.

Files touched: src/web/components/MermaidMarkdown.tsx, src/web/components/DocumentationDetail.tsx, src/web/components/TaskDetailsModal.tsx, src/web/components/FilePreviewModal.tsx, src/web/lib/api.ts, src/server/index.ts, src/test/mermaid-markdown.test.tsx, src/test/server-preview-endpoint.test.ts.

Verification:
- bun test src/test/mermaid-markdown.test.tsx: 35 pass, 0 fail
- bunx tsc --noEmit: pass
- Scoped web tests (image-lightbox, server-preview-endpoint, web-board-filters): 55 pass, 0 fail
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

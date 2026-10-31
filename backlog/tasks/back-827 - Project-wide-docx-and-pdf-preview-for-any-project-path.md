---
id: BACK-827
title: Project-wide docx and pdf preview for any project path
status: Done
assignee:
  - '@hy3'
created_date: '2026-10-29 15:31'
updated_date: '2026-10-29 15:59'
labels:
  - web
  - docs
dependencies: []
modified_files:
  - src/web/components/Layout.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/binaryOfficeFile.ts
  - src/server/index.ts
priority: medium
ordinal: 389001
actual_start: '2026-10-29 15:24'
actual_end: '2026-10-29 15:31'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The in-app preview for Word (.docx) and PDF opened a modal only for links under /assets/*, because that was the single static route serving binary bytes. Markdown/code files, by contrast, already preview from any project-relative path through MermaidMarkdown's onFileClick plus /api/file-content. Docx and PDF should follow the same default handling: clicking a same-origin .docx or .pdf link anywhere in the project opens the preview modal, not just files placed in backlog/assets.
The bytes are fetched by the file's project-relative path (e.g. backlog/docs/report.pdf) through a new raw-bytes endpoint, /api/raw-file, which mirrors /api/file-content but returns the bytes with a content-type. Word's save-back keeps using the project-relative path, so editing works for non-/assets/ files too.
External (cross-origin) docx/pdf links are left to the browser; modifier-key and target=_blank/download clicks still open in a new tab; non-previewable office types (.doc, .ppt, .xls families) still show the unsupported notice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a same-origin .docx or .pdf link at any project path opens the preview modal
- [x] #2 The file is fetched by project-relative path via /api/raw-file (raw bytes, content-type set)
- [x] #3 Word save-back works for non-/assets/ paths through the existing save endpoint
- [x] #4 Non-previewable office links still show the notice; other links keep default behavior
- [x] #5 External and modifier/target=_blank docx/pdf links are not intercepted
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 tsc --noEmit, biome check, and bun scripts/build.ts pass
- [x] #2 Preview verified in the running web UI for a non-/assets/ docx and pdf
- [x] #3 Modified files and summary recorded; actual start/end filled on completion
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
binaryOfficeFile: build fileUrl as /api/raw-file?path=<projectRelative> instead of /assets/*, for both docx and pdf.
Layout interceptor: remove the /assets/ gate, add a same-origin guard, and route docx/pdf and non-previewable-office branches for any same-origin project path; compute filePath as backlog<pathname> and fileUrl via /api/raw-file.
Server: add GET /api/raw-file that streams raw bytes by project-relative path, traversal-guarded and restricted to the backlog/ data directory, with a content-type map (docx, pdf, common images).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Markdown/code preview already works project-wide through MermaidMarkdown.handleClick -> onFileClick -> FilePreviewModal, which reads by project path via /api/file-content. This change makes docx/pdf consistent with that path instead of being pinned to the /assets/* static route.
The /assets/* static route is kept for default-behavior assets (images) that are not intercepted.
Security: /api/raw-file rejects path traversal and anything outside backlog/, so repo files (package.json, .env, source) stay private; the same-origin guard keeps external links out of the app.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the /assets/* restriction from the global docx/pdf click interceptor and added a same-origin guard, so any project-relative .docx or .pdf link now opens the preview modal (not only files under backlog/assets). Bytes are fetched by project-relative path through the new GET /api/raw-file endpoint, which streams raw bytes with a content-type and is traversal-guarded to the backlog/ data directory. binaryOfficeFile now builds fileUrl via /api/raw-file for both formats, so the four detail-modal callers and the interceptor behave identically; Word save-back keeps working for non-/assets/ paths. This makes docx/pdf preview consistent with the existing project-wide markdown/code preview path. tsc, biome, and the production build all pass.
<!-- SECTION:FINAL_SUMMARY:END -->

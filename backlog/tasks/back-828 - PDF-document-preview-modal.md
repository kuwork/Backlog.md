---
id: BACK-828
title: PDF document preview modal
status: Done
assignee:
  - '@hy3'
created_date: '2026-10-29 16:01'
updated_date: '2026-10-29 16:10'
labels:
  - web
  - docs
dependencies: []
modified_files:
  - src/web/components/PdfPreviewModal.tsx
  - src/web/components/Layout.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/MilestoneDetailsModal.tsx
  - src/web/vendor/pdf.mjs
  - src/web/vendor/pdf.worker.min.mjs
  - package.json
  - bun.lock
priority: medium
ordinal: 390001
actual_start: '2026-10-29 16:01'
actual_end: '2026-10-29 16:03'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Render .pdf files opened from the web UI in a dedicated modal built on pdf.js. The PDF is drawn page by page on canvases; the library is self-hosted at /vendor/pdf.mjs and loaded at runtime (never bundled), with its worker at /vendor/pdf.worker.min.mjs, so preview stays out of the initial bundle.
When a PDF embeds an outline (table of contents), a clickable sidebar styled like the task modal's in-page outline (TocRows) appears on the left and scrolls the target page into view; its rows use indented levels, a chevron fold control, a left accent border, and a blue active highlight.
The preview supports a CSS fullscreen that fills the viewport, and the page area clips to the modal rounded-corner radius with no extra margin. Pages use fit-to-width so the document never needs horizontal scrolling, even when the outline sidebar expands or collapses; a cap keeps very wide windows from zooming the page absurdly large.
The global link interception that opens this modal for project-wide .pdf links is delivered separately (BACK-827); this task owns the modal component, the callers' pdf branch, and the self-hosted pdf.js assets plus the pdfjs-dist dependency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a .pdf link opens the dedicated PDF preview modal (project-wide wiring in BACK-827)
- [x] #2 PDF pages render with pdf.js and fit-to-width so the page never needs horizontal scrolling, even with the outline open
- [x] #3 PDFs with an outline show a clickable left sidebar styled like the task modal in-page outline; clicking scrolls the target page into view
- [x] #4 Fullscreen toggle fills the viewport with rounded-corner content
- [x] #5 Outline sidebar and page area clip to the modal rounded corners, matching the task modal outline styling
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 tsc --noEmit, biome check, and bun scripts/build.ts pass
- [x] #2 PDF preview verified in the running web UI for a sample with and without an outline
- [x] #3 Modified files, actual start/end, and summary recorded in the task
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Create PdfPreviewModal.tsx from the PDF branch of DocPdfPreviewModal: runtime import of /vendor/pdf.mjs, worker src /vendor/pdf.worker.min.mjs, page-by-page canvas rendering, fit-to-width via ResizeObserver, outline sidebar (TocRows styling), fullscreen + rounded-corner clipping.
Delete DocPdfPreviewModal.tsx.
Update the four callers (Layout, TaskDetailsModal, DocumentationDetail, MilestoneDetailsModal) to import and render PdfPreviewModal for the pdf branch instead of DocPdfPreviewModal.
Commit the self-hosted pdf.js assets (src/web/vendor/pdf.mjs, pdf.worker.min.mjs) and the pdfjs-dist dependency (package.json, bun.lock).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
pdf.js is loaded at runtime via import('/vendor/pdf.mjs') so it never enters the bundle; the worker is /vendor/pdf.worker.min.mjs. The vendor assets are served from the /vendor static route and embedded in the single binary via Bun.build HTMLBundle.
The outline sidebar reuses the visual language of the task modal in-page outline (TocRows): indented rows, chevron fold, left accent border, blue active highlight.
fit-to-width is computed from the container client width (which already reflects the outline sidebar in the flex layout), clamped to [0.5, 2.2]; recomputed on ResizeObserver and outline toggle.
The project-wide interception that opens this modal for any same-origin .pdf link is BACK-827; this task does not alter the interceptor.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the dedicated PDF preview modal (PdfPreviewModal) built on pdf.js: pages render on canvases, the library is self-hosted at /vendor/pdf.mjs and loaded at runtime (never bundled), worker at /vendor/pdf.worker.min.mjs. PDFs with an outline show a clickable left sidebar styled like the task modal in-page outline (TocRows) that scrolls the target page into view; fit-to-width via ResizeObserver keeps the page within the viewport with no horizontal scroll even when the outline toggles, capped at 2.2x. Fullscreen toggle fills the viewport with rounded-corner clipping. Deleted the interim DocPdfPreviewModal.tsx and repointed the four callers (Layout, TaskDetailsModal, DocumentationDetail, MilestoneDetailsModal) to PdfPreviewModal. Committed the self-hosted pdf.js assets (src/web/vendor/pdf.mjs, pdf.worker.min.mjs) and the pdfjs-dist dependency. Combined with BACK-827 (project-wide wiring), any same-origin .pdf now previews in-app. tsc, biome, and the production build all pass.
<!-- SECTION:FINAL_SUMMARY:END -->

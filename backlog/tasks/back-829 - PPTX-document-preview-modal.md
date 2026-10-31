---
id: BACK-829
title: PPTX document preview modal
status: Done
assignee:
  - '@hy3'
created_date: '2026-10-30 02:28'
updated_date: '2026-10-30 07:16'
labels:
  - web
  - docs
dependencies:
  - BACK-827
modified_files:
  - src/web/components/PptxPreviewModal.tsx
  - src/web/components/binaryOfficeFile.ts
  - src/web/components/Layout.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/MilestoneDetailsModal.tsx
  - src/web/components/TaskDetailsModal.tsx
  - package.json
  - bun.lock
priority: medium
ordinal: 390002
actual_start: '2026-10-30 02:35'
actual_end: '2026-10-30 07:09'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Render .pptx files opened from the web UI in a dedicated read-only modal built on @aiden0z/pptx-renderer (Apache-2.0). The renderer parses OOXML into HTML/SVG DOM with high fidelity — rich text, shapes, images, tables, 2D charts, SmartArt, equations, gradients, OOXML color inheritance — and mounts slides windowed (IntersectionObserver) so large decks stay responsive.
The modal ships three pieces: the viewer, a thumbnail directory for jumping between slides, and an edge-to-edge play mode with WPS-style navigation. This task also adds the renderer dependency, removes .pptx from the non-previewable office set, and reuses BACK-827's project-wide link interceptor to open the modal for same-origin .pptx links.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a .pptx link opens the dedicated PPTX preview modal (project-wide wiring reuses BACK-827 interceptor)
- [x] #2 Slides render with pptx-renderer at high fidelity (text, shapes, images, tables) and fit the modal width
- [x] #3 Large decks mount windowed so scrolling stays smooth (no full up-front parse)
- [x] #4 The modal reuses the same open/close + z-layer contract as PdfPreviewModal/DocPreviewModal
- [x] #5 .pptx is removed from the non-previewable office set (no longer shows the unsupported-type toast)
- [x] #6 A thumbnail directory lists every slide (scaled preview + "幻灯片 N" label); clicking a thumbnail jumps the main view to that slide
- [x] #7 A play button enters an edge-to-edge fullscreen presentation mode with no top toolbar (the slide fills the viewport). Navigation mirrors WPS: → ↓ Space PageDown Enter / wheel down / left click = next; ← ↑ PageUp Backspace / wheel up = prev; Home / End = first / last; Esc (or the floating 退出 button) = exit. A floating bottom-left hint shows the page number and the key legend and auto-dims after idle.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 tsc --noEmit, biome check, and bun scripts/build.ts pass
- [x] #2 PPTX preview verified in the running web UI for a sample deck (text + shape + image slide)
- [x] #3 Modified files, actual start/end, and summary recorded in the task
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add @aiden0z/pptx-renderer to package.json / bun.lock and import it through the bundler so Bun.build resolves JSZip + ECharts (no vendored standalone artifact).
2. PptxPreviewModal.tsx: fetch the raw bytes from /api/raw-file?path=<project-relative>, then PptxViewer.open(arrayBuffer, container, { zipLimits, listOptions: { windowed: true }, onSlideChange }); call viewer.destroy() on close. Keep the scroll container mounted at all times — loading and error render as an absolute overlay so the open effect always has a container to attach to.
3. Zip limits: start from RECOMMENDED_ZIP_LIMITS (entry count / media total / concurrency guards) and raise the per-entry, total and media ceilings so decks with embedded video or large images preview instead of tripping the 32 MiB zip-bomb cap.
4. binaryOfficeFile.ts: add a "pptx" branch to kindFromName and the props helper (fileUrl via /api/raw-file), and drop the .pptx family from NON_PREVIEWABLE_OFFICE_EXTS.
5. Wire the .pptx branch in the Layout link interceptor plus the four callers (Layout, TaskDetailsModal, DocumentationDetail, MilestoneDetailsModal), matching the pdf/docx pattern.
6. Thumbnail directory: after open() resolves, read viewer.slideCount and render one preview per slide with viewer.renderThumbnailToContainer(i, thumbEl, { width: measuredWidth }); keep the SlideHandle list and dispose every handle when the directory closes or the component unmounts. Clicking a thumbnail calls viewer.goToSlide(i); onSlideChange drives the active-slide highlight and the page counter.
7. Play mode: portal a fixed inset-0 overlay with no toolbar and a full-viewport stage. Render one slide at a time via viewer.renderSlideToContainer(index, stage, scale) with scale = min(stageW/slideW, stageH/slideH), re-measured on resize, clearing the stage (after disposing the previous handle) before each render. Bind WPS-style controls and show a floating bottom-left hint that auto-dims.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Viewer API: PptxViewer.open(buffer, container, options) parses, builds and mounts the deck windowed. It exposes slideCount / slideWidth / slideHeight / currentSlideIndex, a goToSlide(index) that scrolls the list, and an onSlideChange(index) option that fires on list scroll for active-slide tracking.
Per-slide API: renderThumbnailToContainer(index, el, opts) and renderSlideToContainer(index, el, scale) both return a caller-owned SlideHandle. dispose() must be called when the slide is no longer needed — viewer.destroy() does not dispose externally rendered handles.
renderSlideToContainer is append-only: it appends the slide node and never clears the container, and its dispose() frees chart/blob resources but leaves the DOM node behind. Play mode therefore clears the stage (el.replaceChildren()) after disposing the previous handle before each render.
`width` in renderThumbnailToContainer is exact: the renderer lays the slide out at presentation.width * (width / presentation.width), so the generated div is exactly `width` px wide. Thumbnails are rendered at the box's measured clientWidth; the box is w-full and uses the slide's real aspect ratio (slideHeight/slideWidth). A fixed pixel width overflows the sidebar (w-44 minus padding and scrollbar ≈ 135 px) and spills past the active-slide ring, and [scrollbar-gutter:stable] keeps the measured width stable as the list grows.
Play overlay geometry: rendered through createPortal(document.body) as fixed inset-0 z-[100] with no toolbar; the stage is absolute inset-0 so the slide fills the viewport (the modal itself is only 72vh). The renderer applies transform: scale(s) with origin top-left; the overlay sets left/top 50% + translate(-50%,-50%) scale(s) with origin center, which keeps the scaled slide centered.
Play controls: next = → ↓ Space PageDown Enter / wheel down / left click; prev = ← ↑ PageUp Backspace / wheel up; Home / End = first / last; Esc or the floating 退出 button exits. Wheel is throttled (~350 ms) and ignores Ctrl+wheel so browser zoom still works; Escape is handled in the capture phase with stopPropagation so it leaves only the play overlay. A bottom-left hint shows the page number and key legend and dims after 4 s of mouse idle.
Placeholder cleanup: the renderer paints pictures with no image data as a dashed grey box labelled "No image data". hideEmptyPictures() hides the surrounding shape container (matched on a leaf div carrying that exact text) so a stray block does not cover the slide; it runs after the first paint, on rendercomplete, and through a MutationObserver for lazily mounted slides.
Thumbnail sidebar: the <aside> needs min-h-0 so the flex child can shrink and scroll instead of pushing the modal open.
Scope: read-only preview only — pptx-renderer has no edit API. The library is Apache-2.0 and browser-only; the npm entry resolves JSZip and ECharts through the bundler.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered a read-only .pptx preview modal on @aiden0z/pptx-renderer, wired through BACK-827's project-wide link interceptor and the four pdf/docx callers (Layout, TaskDetailsModal, DocumentationDetail, MilestoneDetailsModal).
PptxPreviewModal.tsx fetches the deck from /api/raw-file and opens it windowed; zip limits keep the entry-count / media-total / concurrency guards but raise the per-entry, total and media ceilings so decks with embedded video preview instead of tripping the 32 MiB zip-bomb cap.
A thumbnail directory renders every slide at the box's measured width (fluid box, real slide aspect ratio, min-h-0 scroll sidebar), clicking jumps the main view, and onSlideChange drives the active highlight and page counter.
Play mode is a body-portalled fixed inset-0 overlay with no toolbar: one slide at a time, fit-to-contain and re-measured on resize, with WPS-style navigation (→ ↓ Space PageDown Enter / wheel down / left click next, ← ↑ PageUp Backspace / wheel up prev, Home / End first/last, Esc or the floating 退出 button exits) plus a bottom-left hint that dims after idle.
hideEmptyPictures suppresses the renderer's "No image data" placeholder so template shapes with no embedded image don't paint a stray block. binaryOfficeFile gained a pptx branch and dropped the .pptx family from NON_PREVIEWABLE_OFFICE_EXTS.
Scope is read-only; pptx-renderer has no edit API. tsc --noEmit, biome check and bun run build all pass, and the modal was exercised in the running web UI against a real multi-slide deck.
<!-- SECTION:FINAL_SUMMARY:END -->

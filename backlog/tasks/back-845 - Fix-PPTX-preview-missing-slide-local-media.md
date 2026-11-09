---
id: BACK-845
title: Fix PPTX preview missing slide-local media
status: Done
assignee:
  - '@kuwork'
created_date: '2026-11-09 10:55'
updated_date: '2026-11-09 10:57'
labels:
  - web
dependencies: []
references:
  - src/web/utils/pptxMediaNormalize.ts
  - src/web/components/PptxPreviewModal.tsx
modified_files:
  - src/web/utils/pptxMediaNormalize.ts
  - src/web/utils/pptxMediaNormalize.test.ts
  - src/web/components/PptxPreviewModal.tsx
ordinal: 404004
actual_start: '2026-11-09 09:30'
actual_end: '2026-11-09 10:50'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A .pptx deck that stores pictures under the non-standard but PowerPoint-legal ppt/slides/media/ directory renders pictures as empty because @aiden0z/pptx-renderer@1.4.0 only resolves media under ppt/media/, while PowerPoint allows slide-local ppt/slides/media/. This fix normalizes those pictures in-memory to ppt/media/ before rendering, leaving the on-disk file untouched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PPTX decks with pictures under ppt/slides/media/ (non-standard but PowerPoint-legal) render their images instead of empty boxes
- [x] #2 On-disk .pptx files are never modified; normalization happens only on the in-memory buffer before PptxViewer.open
- [x] #3 Decks that already use the canonical ppt/media/ path pass through with zero re-zip overhead (identity buffer)
- [x] #4 Relationship Targets in every *_rels/*.rels are rewritten to point at the relocated media so the renderer resolves them
- [x] #5 A unit test covers relocation plus Target rewrite for slide-local media and the pass-through path for canonical media
- [x] #6 tsc --noEmit, biome check, and the new unit test all pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 tsc --noEmit, biome check, and bun test pass
- [x] #2 Verified against a real deck with slide-local media: 12 pictures relocated to ppt/media/, slide3/slide4 rels Target rewritten
- [x] #3 Modified files, actual start/end, and summary recorded in the task
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/web/utils/pptxMediaNormalize.ts: scan the loaded zip for media entries whose path is not under ppt/media/ (e.g. ppt/slides/media/), relocate each to ppt/media/<sanitized-unique-name> via JSZip, rewrite every Relationship Target in *_rels/*.rels to the new relative path, and return the re-zipped buffer. When no off-path media exists, return the original buffer untouched (zero overhead for canonical decks).
2. Wire normalizePptxMedia into PptxPreviewModal.tsx PptxViewerInner: after fetching the arrayBuffer, normalize before PptxViewer.open so the renderer resolves all media from ppt/media/.
3. Add src/web/utils/pptxMediaNormalize.test.ts covering the slide-local relocation + Target rewrite and the canonical pass-through (identity buffer), run with bun test (--timeout 30000).
4. Verify against a real deck with slide-local media: confirm 12 pictures relocated to ppt/media/, slide3/slide4 rels Target rewritten, then run tsc --noEmit and biome check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: @aiden0z/pptx-renderer@1.4.0 hard-codes media resolution to ppt/media/ — its internal rv() collector only registers parts whose path starts with ppt/media/, and the gs() lookup rewrites relationship targets to ppt/media/ as well. PowerPoint permits slide-local media at ppt/slides/media/ (the relationship Target is relative to the slide), so this deck's 12 SVG pictures were never collected and rendered as the renderer's "No image data" placeholder, then hidden by hideEmptyPictures().
SVG format itself is supported by the renderer (svg → image/svg+xml → <img src=blob:>); the failure is purely the non-standard media path, not the image type. The renderer's public open() does not forward a custom mediaResolver (the internal presentation.mediaResolver is consumed but never wired through the constructor/parse), so a resolver-based fix was not viable through the public API.
Fix shape: in-memory normalization only — the on-disk .pptx is never written. JSZip (already a direct dependency, used by xlsxSnapshotWriter.ts) rebuilds the archive in the browser; relocated names are derived from the source path with a collision-safe prefix so two slides cannot clobber each other. Relative Targets are recomputed from the slide's directory to ppt/media/.
Long-term: the clean upstream fix is a pptx-renderer PR that teaches its media indexer to honor slide-local media directories; this in-memory shim is the project-side workaround.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed PPTX preview showing empty pictures for decks that store images under the non-standard but PowerPoint-legal ppt/slides/media/ directory. Root cause: @aiden0z/pptx-renderer@1.4.0 only resolves media under ppt/media/, so the 12 SVG pictures in this deck were never collected and fell back to the renderer's "No image data" placeholder (then hidden by hideEmptyPictures()).
Added src/web/utils/pptxMediaNormalize.ts, which scans the in-memory zip for off-path media, relocates each to ppt/media/<unique-name> via JSZip, and rewrites every Relationship Target in *_rels/*.rels to the new relative path — returning the original buffer untouched when no off-path media exists (zero overhead for canonical decks). PptxPreviewModal.tsx now normalizes the fetched buffer before PptxViewer.open; the on-disk file is never modified. Added src/web/utils/pptxMediaNormalize.test.ts (relocation + Target rewrite, and canonical pass-through) — bun test passes.
Verified on a real deck with slide-local media: all 12 pictures relocated to ppt/media/, slide3/slide4 rels Target rewritten to ../media/ppt_slides_media_*.svg. tsc --noEmit and biome check both pass.
<!-- SECTION:FINAL_SUMMARY:END -->

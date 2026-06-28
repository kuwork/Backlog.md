---
id: BACK-524
title: 'Add media wikilink support for images, video, and audio'
status: Done
assignee:
  - kimi
created_date: '2026-06-27 22:01'
updated_date: '2026-06-27 23:42'
labels:
  - web-ui
dependencies: []
modified_files:
  - src/web/utils/wikiLinks.ts
  - src/web/components/MermaidMarkdown.tsx
  - src/server/index.ts
  - src/test/wiki-links.test.ts
  - src/test/mermaid-markdown.test.tsx
  - src/test/image-lightbox.test.tsx
  - src/test/server-assets.test.ts
ordinal: 176400
actual_start: '2026-06-27 22:01'
actual_end: '2026-06-27 23:37'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Support Obsidian-style media wikilinks to embed images, videos, and audio files in wiki pages and other markdown-rendered views.

Syntax:
```
![[path]]
![[path|alt]]
![[path|W]]
![[path|alt|W]]
![[path|alt|WxH]]
```

Parameter meaning:
- `path`: resource path relative to the backlog project root or to the current wiki page.
- `alt`: optional alternative text / caption.
- `W`: shorthand width in pixels, equivalent to `Wx0` (width only). Only applies to images and videos.
- `WxH`: optional display dimensions, e.g. `200x200` (width and height), `200x0` (width only), `0x200` (height only). Only applies to images and videos.

Supported media types (detected by file extension):
- Image: png, jpg, jpeg, gif, svg, webp, avif, bmp, ico
- Video: mp4, webm, ogv, mov, mkv
- Audio: mp3, wav, ogg, m4a, flac, aac, opus, wma

Path resolution rules:
- `assets/photo.png` is treated as project-root-relative and served at `/assets/photo.png`.
- `./photo.png` and `../assets/photo.png` are resolved relative to the current wiki page directory.

Images reuse the existing lightbox preview. Video and audio are rendered with native `<video>` / `<audio>` controls. Audio does not support explicit dimensions and always renders with full-width controls.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `![[assets/file.png]]` renders as an <img> tag pointing to /assets/file.png
- [x] #2 `![[assets/file.mp4]]` renders as a <video> tag with controls
- [x] #3 `![[assets/file.mp3]]` renders as an <audio> tag with controls
- [x] #4 Dimension syntax `![[path|alt|WxH]]` applies width/height attributes to images and videos
- [x] #5 Shorthand width syntax `![[path|W]]` and `![[path|alt|W]]` applies width only to images and videos
- [x] #6 Wikilink images open in the existing lightbox preview
- [x] #7 Server serves video/audio assets with correct MIME types
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the wikilink regex in prepareWikiMarkdown to match ![[...]] media links.
2. Add resolveMediaPath to resolve media paths relative to the current wiki page.
3. Detect media type (image/video/audio) from the file extension.
4. Generate raw <img>, <video>, or <audio> HTML with optional WxH dimensions.
5. Register VideoPlayer and AudioPlayer components in MermaidMarkdown.
6. Extend the server's asset MIME type map to support video and audio formats.
7. Add tests for parsing, component rendering, lightbox preview, and server MIME types.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reused the existing LightboxImage component for wikilink image preview, so no new dependency is required.
Paths starting with assets/ map directly to /assets/...; other resolved paths are also served under /assets/...
Fixed a flaky existing test in mermaid-markdown.test.tsx by switching class assertions from toContain to toMatch.
Verified end-to-end with bun src/cli.ts browser using the project's own assets/ images and video.
Audio controls do not support explicit dimensions; width/height specs are ignored for audio.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Obsidian-style media wikilinks for images, video, and audio.

Changes:
- Extended src/web/utils/wikiLinks.ts with getMediaType, resolveMediaPath, parseDimensions, and buildWikilinkMediaHtml to parse `![[path|alt|WxH]]`, `![[path|W]]`, and `![[path|alt|W]]` syntax.
- Supported media types by extension: image (png/jpg/jpeg/gif/svg/webp/avif/bmp/ico), video (mp4/webm/ogv/mov/mkv), audio (mp3/wav/ogg/m4a/flac/aac/opus/wma).
- Added shorthand width syntax where `W` is equivalent to `Wx0`; sizes apply to images and videos, audio ignores dimensions.
- Registered VideoPlayer and AudioPlayer components in MermaidMarkdown; images reuse LightboxImage for lightbox preview.
- Extended BacklogServer.handleAssetRequest MIME type map for video and audio formats.
- Added/updated tests in src/test/wiki-links.test.ts, src/test/mermaid-markdown.test.tsx, src/test/image-lightbox.test.tsx, and src/test/server-assets.test.ts.

Verification: bunx tsc --noEmit passes; scoped tests pass (63 tests across wiki-links and mermaid-markdown).
<!-- SECTION:FINAL_SUMMARY:END -->

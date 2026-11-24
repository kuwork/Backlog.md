---
id: BACK-863
title: Update local favicon from pages site
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-24 16:06'
updated_date: '2026-11-24 16:13'
labels:
  - web
  - branding
dependencies: []
modified_files:
  - src/web/favicon.png
  - .github/favicon.png
ordinal: 422004
actual_start: '2026-11-24 16:06'
actual_end: '2026-11-24 16:13'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use the new square application icon from D:\git\backlog-md-pages to replace the existing local favicon assets without changing their public paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Replace src/web/favicon.png and .github/favicon.png with the new icon while preserving their paths
- [x] #2 Verify PNG integrity and the web production build
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun run web:build passes and the emitted favicon matches the source
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Copy the 512px source icon into both existing favicon locations.
2. Verify hashes and image decoding.
3. Build the web bundle and inspect the resulting favicon asset.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Copied icon-512.png unchanged into both existing favicon paths. Both PNGs decode as 512x512 RGBA and match the source SHA-256 dcc95636722fe1b49fe6b18fe3b67dd6f48979bc4cf45cc99bd4930cf85970af. bun run web:build passed in 256646ms; emitted favicon-sbxeffz2.png also matches the source exactly. TypeScript and Biome checks were not applicable because only binary PNG assets changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the Web and GitHub favicon assets with the new 512px icon from backlog-md-pages, preserving existing paths and leaving the horizontal backlog-logo.png unchanged.

Verification:
- Both replacement PNGs match the source hash.
- bun run web:build passed.
- Built favicon-sbxeffz2.png matches the source icon exactly.
<!-- SECTION:FINAL_SUMMARY:END -->

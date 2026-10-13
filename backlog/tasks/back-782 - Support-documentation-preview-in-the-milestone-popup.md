---
id: BACK-782
title: Support documentation preview in the milestone popup
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 03:21'
updated_date: '2026-10-13 03:22'
labels:
  - bug
  - web-ui
dependencies:
  - BACK-619
priority: medium
ordinal: 341001
actual_start: '2026-10-13 03:16'
actual_end: '2026-10-13 03:22'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The milestone details popup rendered a local (non-URL) `documentation` entry as inert text, so it could not be opened in-app, whereas the task popup already let you click an entry to preview the file. This brings the milestone popup to parity with the task popup: local entries become clickable preview controls that open the shared in-app file preview, while `http(s)` entries stay external links. Builds on the milestone documentation field introduced in BACK-619.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Local (non-URL) documentation entries in the milestone popup open the in-app file preview on click, reusing the shared taskDetails.clickToPreview affordance.
- [x] #2 http(s) entries keep rendering as external links opened in a new tab; the file preview is not used for them.
- [x] #3 The preview resets when the popup opens on another milestone and cannot outlive the closed popup.
- [x] #4 Empty documentation keeps the existing placeholder hint.
- [x] #5 tsc/biome/tests green; a component test asserts the entry is a clickable preview control that issues a file-content request for its path.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the task popup preview wiring (FilePreviewModal plus a local previewPath state) in MilestoneDetailsModal.
2. Swap the local documentation entry span for a clickable button using the shared taskDetails.clickToPreview title; keep http(s) entries as anchors.
3. Reset previewPath when the popup opens on another milestone, and gate the preview on isOpen.
4. Add a component test and narrow the existing remove-entry test selector, which assumed the entry was not a button.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: MilestoneDetailsModal rendered non-URL documentation entries as an inert span (a styled label), whereas TaskDetailsModal rendered them as a button wired to FilePreviewModal, so the milestone popup had no way to preview a doc. Fix: mirror the task popup - add a previewPath state and a FilePreviewModal sibling, make local entries buttons with title=Click to preview, and leave external URLs as target=_blank anchors. The preview resets on milestone switch (existing reset effect) and is gated on isOpen so it cannot outlive the popup. The existing web-milestone-timestamps remove-entry case located its control with docRow.querySelector(button); that now matched the entry button, so it was narrowed to the remove control by title.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
MilestoneDetailsModal now previews local documentation entries in the shared in-app file preview modal, matching the task popup. Local entries are clickable preview controls (title Click to preview); http(s) entries remain external links. previewPath resets when the popup targets another milestone, and the preview is gated on isOpen. Added src/test/web-milestone-details-modal-documentation.test.tsx (3 cases) and updated the existing remove-entry case for the new button. tsc clean, biome clean, 23 tests green across the milestone/task documentation suites.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-825
title: Word document preview and inline editing modal
status: Done
assignee:
  - '@hy3'
created_date: '2026-10-29 14:51'
updated_date: '2026-10-30 10:07'
labels:
  - web
  - docs
dependencies: []
modified_files:
  - package.json
  - bun.lock
  - src/web/components/DocPreviewModal.tsx
  - src/web/components/binaryOfficeFile.ts
  - src/web/components/Modal.tsx
  - src/web/lib/api.ts
  - src/server/index.ts
  - scripts/build.ts
  - src/types/css.d.ts
  - src/web/locales/docx/zh-TW.ts
  - src/web/locales/docx/ja.ts
  - src/web/components/Layout.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/MilestoneDetailsModal.tsx
priority: medium
ordinal: 387001
actual_start: '2026-10-28 09:00'
actual_end: '2026-10-29 14:38'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Render .docx files opened from the web UI in a dedicated modal built on docx-editor, showing true paginated A4 pages on a neutral background.
Default to read-only preview; an Edit action switches to editing mode with toolbar, margin guides, and ruler; Save writes changes back to the original file after a confirmation guard; Exit edit returns to preview.
The header states the current mode explicitly, matching the spreadsheet preview: a grey read-only badge while viewing, a blue edit-mode badge once editing, so the state never has to be inferred from the chrome.
Support a CSS fullscreen that fills the viewport; modal content is clipped to the modal rounded corners with no extra page margin.
Localize the docx-editor UI across the apps four languages (en, ja, zh-CN, zh-TW); supply self-built zh-TW and ja override packages merged over the built-in locales so missing keys fall back to English.
Intercept /assets/*.docx links globally to open the preview modal instead of downloading.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening a .docx link shows a paginated preview modal instead of a raw download
- [x] #2 Edit mode shows toolbar, margin guides, and ruler; Save persists edits to the source file after confirmation
- [x] #3 Fullscreen toggle fills the viewport with rounded-corner content
- [x] #4 Editor UI text follows the active app locale for en, ja, zh-CN, and zh-TW
- [x] #5 docx-editor is code-split so it stays out of the initial bundle
- [x] #6 The header shows a read-only badge while viewing and an edit-mode badge while editing
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 tsc --noEmit, biome check, and bun scripts/build.ts all pass
- [x] #2 Word preview, edit, and save verified in the running web UI across all four locales
- [x] #3 Modified files, actual start/end times, and summary recorded in the task
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add shared binaryOfficeFile helper (kindFromName, isBinaryOfficeFile, binaryOfficeFileProps).
Create DocPreviewModal with React.lazy docx-editor, i18n mapping via key remount, viewing/editing modes, and save through POST /api/docx/save.
Add Modal fullscreen and noPadding props for rounded-corner clipping.
Add server /api/docx/save with path-traversal guard and Bun.write back to the original file.
Add apiClient.saveDocx as an octet-stream POST.
Build: alias jszip to dist/jszip.min.js to avoid the readable-stream require blocker; rely on React.lazy code splitting.
Add locales/docx zh-TW and ja override packages.
Update the four callers (Layout, TaskDetailsModal, DocumentationDetail, MilestoneDetailsModal) docx branches to DocPreviewModal.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
docx-editor bundles jszip, which pulls readable-stream and breaks the bun HTMLBundle build with require(stream); fixed by a targeted jszip alias plus code splitting.
i18n: docx-editor ships zh-CN but not zh-TW or ja; built self-merged override packages where missing keys fall back to English via PartialLocaleStrings.
Locale switching uses key={locale} remount because i18n is read at mount time.
The preview endpoint may intermittently return 500 if the model provider is unavailable; a retry succeeds.
Mode badge: the header carries the same state pill the spreadsheet preview uses (grey `read-only preview`, blue `edit mode`). Views over a document look alike whether or not they can be edited, so the state is stated instead of implied by the presence of a toolbar. The badge shares the XLSX wording and colours on purpose — the two previews should not disagree about how a read-only state looks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered a dedicated Word preview modal (DocPreviewModal) with true pagination, read-only preview by default, and an edit mode that saves back to the original file after confirmation. The header states the mode with the same badge used by the spreadsheet preview. Fullscreen with rounded corners, four-language i18n via self-built zh-TW/ja overrides, and code-split docx-editor. Edits persist through a path-traversal-guarded /api/docx/save endpoint.
<!-- SECTION:FINAL_SUMMARY:END -->

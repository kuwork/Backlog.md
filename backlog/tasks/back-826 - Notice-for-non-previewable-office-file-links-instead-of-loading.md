---
id: BACK-826
title: Notice for non-previewable office file links instead of loading
status: Done
assignee:
  - '@hy3'
created_date: '2026-10-29 15:07'
updated_date: '2026-10-29 15:50'
labels:
  - web
dependencies:
  - BACK-825
modified_files:
  - src/web/components/binaryOfficeFile.ts
  - src/web/components/Layout.tsx
  - src/web/components/SuccessToast.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
priority: low
ordinal: 388001
actual_start: '2026-10-29 15:09'
actual_end: '2026-10-29 15:14'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The global /assets/* link interceptor only opens a preview modal for .docx and .pdf; every other extension silently falls through to the browser default (navigate or download) with no feedback, so clicking a .doc or another office type the app cannot preview just loads or downloads the file.
For known office file types that the in-app preview cannot render, intercept the click, preventDefault, and show a non-blocking notice (toast) stating the format is not supported for preview and suggesting conversion to .docx where applicable, instead of letting the browser load or download it.
Keep existing behavior: .docx and .pdf open the preview modal; modifier-key clicks and target=_blank or download links still open in a new tab.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a .doc link shows a notice and does not navigate or download the file
- [x] #2 .docx and .pdf links still open the preview modal unchanged
- [x] #3 Ctrl/Cmd/Shift/Alt-click and target=_blank still open in a new tab
- [x] #4 The notice text is localized for en, ja, zh-CN, and zh-TW
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 tsc --noEmit, biome check, and bun scripts/build.ts pass
- [x] #2 Notice verified in the running web UI for an unsupported office link
- [x] #3 Modified files and summary recorded; actual start/end filled on completion
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Enumerate non-previewable office extensions in binaryOfficeFile (e.g. isNonPreviewableOffice(path)); keep isBinaryOfficeFile for the previewable set.
In the Layout interceptor, after the /assets/ check, branch: previewable -> open modal (existing); non-previewable office -> preventDefault and show a toast; otherwise -> leave default browser behavior.
Add a localized notice message; reuse existing toast infra if present, otherwise add a lightweight notice.
Localize via the app i18n (en, ja, zh-CN, zh-TW).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: Layout.tsx:69 returns early for anything not .docx/.pdf, so .doc is silently loaded by the browser; kindFromName already returns unsupported but is never reached for these links.
Keep open-in-new-tab working (modifier keys, target=_blank, download) exactly as before.
This is a separate concern from BACK-825 (Word preview/edit) and should not alter the docx/pdf happy path.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Intercepted non-previewable office links (legacy .doc, the PowerPoint and Excel families, plus macro and template variants) in the global /assets/* click handler. Clicking one now calls preventDefault and shows a localized amber warning toast suggesting conversion to .docx or .pdf, instead of letting the browser download or open it. .docx and .pdf still open the preview modal, and modifier-key or target=_blank/download clicks still open in a new tab. Added isNonPreviewableOffice to binaryOfficeFile, a warning variant to SuccessToast, and a localized filePreview.unsupportedType string across en, ja, zh-CN, and zh-TW.
<!-- SECTION:FINAL_SUMMARY:END -->

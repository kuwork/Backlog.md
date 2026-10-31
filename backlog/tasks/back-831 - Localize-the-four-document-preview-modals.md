---
id: BACK-831
title: Localize the four document preview modals
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-10-30 10:17'
updated_date: '2026-10-30 10:34'
labels:
  - web-ui
  - i18n
dependencies: []
modified_files:
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/web/components/DocPreviewModal.tsx
  - src/web/components/PptxPreviewModal.tsx
  - src/web/components/XlsxPreviewModal.tsx
  - src/web/components/PdfPreviewModal.tsx
  - src/web/components/MemoBoard.tsx
  - src/web/components/CypherResultGraph.tsx
priority: medium
ordinal: 391003
actual_start: '2026-10-30 10:20'
actual_end: '2026-10-30 10:34'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Switching the app language to English leaves the DOCX, PPTX, XLSX and PDF preview modals in Chinese: every string in these four components is a hardcoded literal, so they ignore the active locale entirely. Roughly 60 lines carry CJK text today, spread over buttons, tooltips, aria-labels, confirm/alert dialogs and loading/error states.

Scope:

1. All user-visible text in DocPreviewModal, PptxPreviewModal, XlsxPreviewModal and PdfPreviewModal moves into the translation dictionaries: action buttons, tooltips (title), aria-labels, confirmation and alert dialogs, loading and error states, the read-only and edit-mode badges, the PPTX outline and player chrome, and the PDF outline pane.
2. Dynamic strings become placeholder templates instead of concatenation: page X of Y, slide index, save-failure message, render-failure message, file-type-specific error text.
3. Reuse before adding. `common` already carries the generic verbs and states these modals need — `save`, `saving`, `edit`, `close`, `cancel`, `loading`, `retry`, `expand`, `collapse`, `confirm`, `failedToLoad`, `failedToSave`, `unsavedChanges` — all present in the four locales and already used this way elsewhere (`{isSaving ? t.common.saving : t.common.save}`). Those are read from `common` instead of being redefined. Only wording `common` does not have goes into the new namespace: exit edit, saved, read-only preview, edit mode, missing file address, plus the format-specific labels (PPTX player and outline, XLSX parsing and render states, PDF outline pane, DOCX load and export errors). The `fullscreen` / `exitFullscreen` pair is the exception that moves up instead of staying put: it is already defined twice, under memos and under the graph pane. Either way a string is defined once, so the four previews cannot drift apart.
4. en.ts stays the source of truth; zh-CN, zh-TW and ja are completed in the same pass. Key parity is already enforced by the TranslationDict type, so a missing key is a compile error rather than a silent fallback.
5. Out of scope: document content, file names in the modal title, and the docx-editor built-in UI, which localizes itself through its own locale packages.

The PPTX player hint lists physical keys (Space, arrows, Home, End, Esc). It is translated as one sentence per locale rather than assembled from key names in code, because word order differs across languages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With the app set to English, no Chinese text appears anywhere in the four preview modals
- [x] #2 Buttons, tooltips, aria-labels, confirm dialogs and alert dialogs all read from the dictionary instead of literals
- [x] #3 Dynamic values use placeholder templates (page x of y, slide index, error message) rather than string concatenation
- [x] #4 Generic verbs and states are read from `common` where they already exist instead of being duplicated into a preview namespace, and the existing duplicate fullscreen keys are promoted rather than joined by more copies
- [x] #5 en, zh-CN, zh-TW and ja all carry the new keys, and a missing key fails tsc
- [x] #6 A CJK grep over the four components returns no user-visible literal
- [x] #7 Preview behaviour is unchanged apart from language: layout, keyboard shortcuts and the save flow still work
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory: grep CJK over DocPreviewModal, PptxPreviewModal, XlsxPreviewModal and PdfPreviewModal, then sort every hit into one of three buckets — shared wording, format-specific wording, and physical key names. Comment lines are excluded; only strings the user can see count.
2. Dictionary shape, in two layers. First map every literal onto an existing key where one fits: `common.save` / `common.saving` / `common.edit` / `common.close` / `common.cancel` / `common.loading` / `common.retry` / `common.expand` / `common.collapse` / `common.confirm` / `common.failedToLoad` / `common.failedToSave` / `common.unsavedChanges`. That inventory is already complete in all four locales, so no new key is minted for "save" or "close". Then promote the keys that already exist more than once in unrelated sections — `fullscreen` / `exitFullscreen` are defined separately under memos and under the graph pane — up to `common`, and repoint those two call sites, so the four previews share one definition instead of adding a third and fourth copy. Finally add a `preview` namespace holding only what remains: a `shared` block (readOnlyPreview, editMode, saved, exitEdit, missingFileUrl) and one block per format (`docx`, `pptx`, `xlsx`, `pdf`). One namespace keeps the four sets of format strings discoverable together instead of scattering them across unrelated sections.
3. Placeholders: dynamic text uses the same `{name}` convention the rest of the dictionaries already use, replaced at the call site (`pageOfPages: "Page {current} of {total}"`, `slideIndex: "Slide {index}"`, `saveFailed: "Save failed: {message}"`, `renderFailed: "{format} render failed: {message}"`). No `+` concatenation and no template literal that stitches a translated fragment onto a number.
4. Wiring: each modal reads `const { t } = useI18nContext()`. DocPreviewModal, PptxPreviewModal and PdfPreviewModal currently call the hook nowhere; XlsxPreviewModal needs it for the badge and dialog text. The hook is already the project-wide entry point (Modal.tsx uses the older `useI18n` wrapper), so no new plumbing is introduced.
5. Dialogs: `window.confirm` / `window.alert` bodies are localized too — they are the most visible strings when saving and the easiest to forget. The xlsx "no changes detected" alert keeps its own key because it names an editor-state problem, not a save failure.
6. PPTX player: the hint line that lists Space, arrows, Home, End and Esc is one sentence per locale, not a list of key names joined in code — key names are physical and stay in Latin, but the surrounding verbs differ in word order per language. The page indicator and the outline labels (outline / hide outline / slide N) follow the same template treatment.
7. PDF outline: the pane title, the folded/expanded aria-labels and the collapse-all/expand-all toggle become keys; the outline item text itself is document content and stays untouched.
8. Locale parity: fill zh-CN, zh-TW and ja in the same pass. `TranslationDict` is derived from en.ts, so the other three files stop compiling the moment a key is missing — the compiler is the check, not a manual diff.
9. Verify: `bunx tsc --noEmit`, `biome check` on the touched files, `bun run build`, then open each of the four previews with the app set to English and to Chinese and confirm every label follows, including the save-confirmation dialogs. A final CJK grep over the four components must return only comment lines.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reuse first, add second. Everything the four modals say that already had a key now reads it: save / saving / edit / loading / close / cancel / expand / collapse from `common`, plus `common.failedToSave` for the bare state. The CJK sweep over the four files ended at zero, so nothing user-visible is left outside the dictionaries.
Promoted rather than copied: `fullscreen` / `exitFullscreen` existed twice (memos board, graph result pane). Both moved to `common`; the memos copy was deleted and its call site repointed, the graph copy keeps only `exitFullscreen` because its text carries an extra "(hold Esc)" hint. Net effect is one shared definition instead of four.
`preview.shared` holds the cross-format sentences — read-only preview, edit mode, saved, exit edit, missing file URL, load failed, render failed, save failed, the three confirmation dialogs, rendering. Format blocks keep what only one preview says.
`renderFailed` takes `{format}` instead of being copied three times, so "XLSX failed to render: …" and "PDF …" differ only in the argument.
Dialogs are localized too, not just the chrome: the save confirmation, the unsaved-changes prompts on exit and close, and both failure alerts. These are the strings a user reads at the exact moment something goes wrong, and they were the easiest to miss.
PPTX shortcut hint is a whole sentence per locale. The key names (Space, arrows, Home, End, Esc) stay Latin in every language — they are physical keys — but the verbs around them are translated rather than concatenated.
XLSX needed a second translator. The Univer workbench localizes itself and the file had `LocaleType.ZH_CN` hardcoded, so the ribbon stayed Chinese in every language. It now maps the app locale onto Univer's own packs (en → enUS, ja → jaJP, zh-CN → zhCN, zh-TW → zhTW), and `locale` joined the viewer effect's dependencies so switching language rebuilds the instance rather than leaving the old one mounted. Importing the three extra packs costs ~1.9 MB in the binary (179.8 → 181.8 MB) — the price of the workbench following the app language.
`biome`'s useExhaustiveDependencies flagged every hook that reads `t`; `t` was added to the dependency lists rather than the deep paths it suggested. `t` changes identity only when the locale changes, so this is the correct granularity.
zh-TW reuses the wording the existing dictionary already has for "save" instead of switching to the regional convention, so the new keys match what `common.saving` shows. That inconsistency is pre-existing and was explicitly left alone; fixing it means touching every occurrence in that file, which is a separate change.
Verification: tsc --noEmit, biome check on the ten touched files, bun run build (181.8 MB) and the existing xlsxSnapshotWriter suite (8 pass) are green. The browser click-through — switch to English, open each of the four previews, save once — still needs a restarted instance; this session's sandbox proxies loopback, so a headless browser cannot reach the dev server.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The four preview modals now follow the app language instead of being pinned to Chinese. Every string moved into the dictionaries: badges, buttons, tooltips, aria-labels, loading and error states, the confirmation and failure dialogs, the PPTX outline and player, and the PDF outline pane.
Generic verbs come from `common` rather than being redefined, and the duplicated `fullscreen` keys were promoted there instead of being copied a third and fourth time. Only preview-specific wording lives in the new `preview` namespace, with `{message}` / `{format}` / `{current}` / `{total}` / `{index}` placeholders for the dynamic parts.
The spreadsheet preview needed more than strings: Univer's workbench had ZH_CN hardcoded, so its ribbon ignored the app language entirely. It now maps to Univer's own en / ja / zh-CN / zh-TW packs and rebuilds when the language changes.
A CJK grep over the four components returns nothing. tsc, biome, the build and the existing writer tests pass; the click-through in a running instance remains for the user to confirm.
<!-- SECTION:FINAL_SUMMARY:END -->

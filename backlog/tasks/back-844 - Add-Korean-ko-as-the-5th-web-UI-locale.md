---
id: BACK-844
title: Add Korean (ko) as the 5th web-UI locale
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-09 06:56'
updated_date: '2026-11-09 07:02'
labels: []
dependencies: []
references:
  - src/web/locales/ko.ts
  - src/web/locales/index.ts
  - src/web/components/Settings.tsx
  - src/core/state-machine.ts
  - src/web/components/XlsxPreviewModal.tsx
  - src/web/components/DocPreviewModal.tsx
  - src/web/locales/docx/ko.ts
modified_files:
  - src/web/locales/ko.ts
  - src/web/locales/index.ts
  - src/web/components/Settings.tsx
  - src/core/state-machine.ts
  - src/web/components/XlsxPreviewModal.tsx
  - src/web/components/DocPreviewModal.tsx
  - src/web/locales/docx/ko.ts
  - src/test/state-machine.test.ts
  - src/test/office-range-label.test.ts
  - src/test/web-initialization-cursor.test.tsx
ordinal: 403004
actual_start: '2026-11-09 06:04'
actual_end: '2026-11-09 06:57'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md previously shipped four web-UI locales (en, ja, zh-CN, zh-TW). This adds Korean (ko) as the fifth so Korean-locale users get a fully localized experience.

Scope: main UI dictionary, language picker, default state-machine mapping, spreadsheet preview, and the DOCX editor chrome. The @eigenpal/docx-editor-i18n package ships no Korean locale, so docx/ko.ts is a project-owned partial override deep-merged onto the bundled en locale (missing keys fall back to English).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ko is registered in the Locale union, dictionaries, DEFAULT_STATE_MACHINES, and isValidLocale in src/web/locales/index.ts
- [x] #2 Settings language dropdown lists 한국어
- [x] #3 state-machine detectDefaultLocale and defaultStateMachineForLocale map ko* to ko
- [x] #4 XlsxPreviewModal wires the Univer ko-KR locale pack via LocaleType.KO_KR
- [x] #5 DocPreviewModal returns the docx/ko.ts override for ko (missing keys fall back to en)
- [x] #6 bunx tsc --noEmit and biome check pass; locale-related tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit existing i18n: src/web/locales/{en,ja,zh-CN,zh-TW}.ts, index.ts, Settings.tsx, state-machine.ts, DocPreviewModal.tsx, XlsxPreviewModal.tsx.
2. Create src/web/locales/ko.ts mirroring en.ts (complete TranslationDict plus a Korean defaultStateMachine).
3. Register ko in index.ts (Locale union, dictionaries, DEFAULT_STATE_MACHINES, isValidLocale) and the Settings language dropdown.
4. Map ko* to ko in state-machine.ts detectDefaultLocale and defaultStateMachineForLocale.
5. Wire the Univer ko-KR pack in XlsxPreviewModal.tsx via LocaleType.KO_KR.
6. Add src/web/locales/docx/ko.ts partial override mirroring docx/ja.ts and register it in DocPreviewModal.tsx; the package ships no Korean locale so missing keys fall back to en.
7. Update 3 locale-iteration tests; run tsc, biome, and the test suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions
 - docx-editor-i18n ships only en/de/fr/he/hi/id/pl/pt-BR/tr/zh-CN. ko/ja/zh-TW are project-owned PartialLocaleStrings deep-merged onto en; ja and zh-TW already existed and ko was added to match.
 - defaultStateMachine status names kept English per the existing zh-CN/ja convention; only the when/if/requires/evidence prose was localized.
 - References use bare project-root-relative paths (no line numbers) per project convention.

Validation
 - bunx tsc --noEmit passes.
 - biome check passes.
 - Locale-related tests pass (state-machine, office-range-label, web-initialization-cursor).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Korean (ko) as the 5th web-UI locale across the full app surface.

Changes
 - src/web/locales/ko.ts: complete Korean TranslationDict (1421 lines) plus a Korean defaultStateMachine (status names kept English per convention; prose localized).
 - src/web/locales/index.ts: ko added to the Locale union, dictionaries, DEFAULT_STATE_MACHINES, and isValidLocale.
 - src/web/components/Settings.tsx: added 한국어 option to the language dropdown.
 - src/core/state-machine.ts: detectDefaultLocale and defaultStateMachineForLocale now map ko* to ko.
 - src/web/components/XlsxPreviewModal.tsx: wired the Univer ko-KR pack via LocaleType.KO_KR so spreadsheet preview is Korean.
 - src/web/components/DocPreviewModal.tsx + src/web/locales/docx/ko.ts: Korean DOCX editor chrome via a project-owned partial override (mirrors docx/ja.ts, 880 lines) deep-merged onto the bundled en locale; missing keys fall back to English.
 - Updated 3 locale-iteration tests (state-machine, office-range-label, web-initialization-cursor).

Verification
 - bunx tsc --noEmit passes.
 - biome check passes.
 - Locale-related tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->

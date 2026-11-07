---
id: BACK-838
title: Support Office page and sheet ranges in Markdown links
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-06 19:14'
updated_date: '2026-11-07 09:38'
labels:
  - web-ui
  - markdown
dependencies: []
documentation:
  - quickstart/BacklogMD产品说明书.docx
  - quickstart/BacklogMD对外宣讲.pptx
  - quickstart/BacklogMD快速上手速查手册.pdf
  - quickstart/Strata硬件测试结果集.xlsx
modified_files:
  - src/web/components/binaryOfficeFile.ts
  - src/web/components/OfficeEmbedInline.tsx
  - src/web/components/MarkdownLinkPreview.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/DocPreviewModal.tsx
  - src/web/components/FilePreviewModal.tsx
  - src/web/components/PdfPreviewModal.tsx
  - src/web/components/PptxPreviewModal.tsx
  - src/web/components/XlsxPreviewModal.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/MilestoneDetailsModal.tsx
  - src/web/components/Layout.tsx
  - src/web/components/officeRangeLabel.ts
  - src/web/utils/markdown-paths.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/office-link-range.test.ts
  - src/test/office-range-label.test.ts
  - src/test/markdown-paths.test.ts
  - src/test/mermaid-markdown.test.tsx
  - backlog/docs/PRDS/OfficeLinkCheck/doc-35 - Office-Link-Check.md
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/mcp/documents.md
priority: high
ordinal: 397004
actual_start: '2026-11-06 19:00'
actual_end: '2026-11-07 09:35'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Markdown bodies can link an Office file, but the link only ever opens the whole document: there is no way to point at pages 1-4 of a report, at slides 3-8 of a deck, or at one named sheet of a workbook, and a Markdown image whose destination is a document falls through to the image lightbox and renders nothing. The render-time join pass also treats a P-prefixed range such as `report.docx:P1-P4` as an opaque URI scheme and collapses the link into a dead `#` anchor, so relative Office references with a range never resolve.

This task extends the Office link contract with an optional `:range` suffix (page range for docx/pptx/pdf, sheet index or sheet name for xlsx/xlsm), threads the parsed range into the four Office viewers, and turns a Markdown image pointing at an Office file into an inline embed instead of a lightbox image.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A docx, pptx or pdf link opens the Office preview popup; a `:P1-P4` / `:P1` suffix scopes the preview to those pages and never reaches the file path or the byte URL, while a bare `:1-4` keeps its plain-text line meaning and is not read as pages
- [x] #2 docx scrolls to the first requested page, pptx renders only the requested slides, and pdf renders only the requested page window
- [x] #3 A workbook link accepts `:p1` and `:p1-p2` (1-based sheet index) and `:sheetName`; the viewer activates the first requested sheet and keeps the other tabs reachable, and a percent-encoded sheet name resolves to the literal name
- [x] #4 A Markdown image whose destination is an Office file embeds the viewer inline with a caption showing the file name and the range label, while a non-Office image keeps the lightbox
- [x] #5 A relative Office destination such as `../../../assets/report.docx:P1-P4` survives the render-time join pass with the range intact instead of becoming a dead `#` anchor
- [x] #6 Every Markdown surface routes the parsed range: task details, milestone details, documentation, decision and wiki pages, and a nested file preview
- [x] #7 Range labels are localized in en, zh-CN, zh-TW and ja
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Link parsing: add an `OfficeRange` union and `parseOfficeLink` to the shared binary-Office module so a destination splits into a clean file path plus a page or sheet range; keep `kindFromName` extension-anchored so a range token never hides the real extension.
2. Join pass: accept `P1-P4` page tokens for paged formats and any sheet token for workbooks in the extension-anchored range split, keep bare `1-4` as a plain-text line range on every other extension, percent-encode a spaced sheet name, and keep refusing range-looking tokens on extensions that have no ranges.
3. Viewers: thread `officeRange` into the docx, pptx, pdf and xlsx viewers - scroll to the first page, hide out-of-window slides, render only the requested pdf pages, and activate the first requested sheet.
4. Click contract: pass the parsed range through `useMarkdownLinkPreview`, task details, milestone details and nested file previews.
5. Inline embed: render a Markdown image whose destination is an Office file as an inline viewer with a caption instead of a lightbox image.
6. Tests and i18n: cover parsing, the join pass and the click contract; add the range labels to the four locales.
7. Global interceptor: route the document-level capture-phase Office link handler in `Layout.tsx` through the shared parser so a `:range` token never reaches the byte URL and the modal title stays a clean file name.
8. Fixture and verification: add the `doc-35` acceptance page under `PRDS/OfficeLinkCheck` referencing four real files in the repository-root `quickstart/` directory, then cover parsing, the join pass, the click contract and the range labels with unit tests and headless-browser checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Link parsing. `binaryOfficeFile.ts` gains an `OfficeRange` union (a `pages` window or a `sheets` list), `parseOfficeLink` - which splits `<path>.<office-ext>:<token>` into a clean path, the kind and the range - and a private `parseRangeToken`. Paged formats read `P1-P4` and `P1` only - the `P` is required precisely because a bare `1-4` already means lines 1-4 on a text file, so dropping it would make a document claim the plain-text meaning; workbooks read `p1` / `p1-p2` (1-based, expanded into `pN` items) or a sheet name, and a percent-encoded sheet name is decoded once before it reaches Univer. `kindFromName` now tolerates a `:range` suffix by matching it up to the next path separator, so a sheet name holding a space no longer hides the extension, and `binaryOfficeFileProps` strips any stray suffix before it builds the byte URL.

Join pass. `splitTarget` in `markdown-paths.ts` decides whether an extension-anchored token is a range by extension: workbooks accept any token, paged formats accept `P1-P4` only, every other extension keeps its `12-20` line range, and everything else stays part of the path, so a range-looking token on an extension without ranges is still refused. Before this change `docs/report.docx:P1-P4` fell through to the URI-scheme branch, looked like an opaque `docs:` scheme and collapsed into a dead `#` anchor. The accepted token is percent-encoded on the way out, which keeps a spaced or bracketed sheet name inside the destination.

Viewers. `OfficeRange` is threaded into the four modals as `officeRange`. docx positions the requested `.layout-page` inside the editor's scroll container with a bounded retry that survives a late relayout - the library's `scrollToPage` targets its own container, which is not the one the modal scrolls, so calling it alone left the view on page 1. pdf renders only the requested page window, clamps an out-of-range request into `numPages` and reports the page count back so the header badge shows the page it actually renders (`:P9-P12` on a 3-page PDF reads `Page 3`). pptx projects a clamped `slideWindow`, hides out-of-window `[data-slide-index]` nodes with a `MutationObserver` because the renderer mounts slides lazily, and scopes both the thumbnail strip and the play overlay's counter to that window. xlsx activates the first requested sheet with a bounded retry; `setActiveSheet(string)` expects a sheet **id** rather than a name, so both index and name tokens are resolved to an `FWorksheet` first. A `officeRangeLabel` helper builds the same page/sheet badge in every viewer and in the inline embed; `preview.shared.pageSingle` / `pageRange` and `preview.xlsx.sheetIndex` / `sheetRange` / `sheetName` carry the labels in en, zh-CN, zh-TW and ja.

Click contract and inline embed. The file variant of `PreviewTarget` carries the parsed range, so task details route it explicitly (falling back to parsing the stored path), milestone details parse the doc-chip path, and a nested link inside `FilePreviewModal` now dispatches Office destinations to their own viewer instead of the text preview. `OfficeEmbedInline` renders the same viewer inside a `<figure>` whose caption is the clean file name plus the range badge - the descriptive `alt` text is kept as a tooltip instead, so a caption such as "报告 第 1-2 页" no longer repeats the badge right next to it. `MarkdownImage` swaps the lightbox for the embed whenever the destination parses to an Office kind, so `![deck.pptx](/deck.pptx:P1-P4)` embeds slides 1-4 in place.

Global click interceptor. `Layout.tsx` has a document-level capture-phase handler for every same-origin Office link; it runs before any Markdown handler and calls `stopPropagation`, so it is the path that actually opens most Office previews. It used to build `/api/raw-file?path=<href>` from the raw destination, which made every ranged link request `...docx:P1-P4` and fail with HTTP 404 (a bare `:3-7` happened to survive because the resolver understands line ranges). Its modal title was the basename including the range, so it also duplicated the range badge. It now uses `parseOfficeLink` + `binaryOfficeFileProps`, keeps the range in a separate state field, passes `officeRange` to the four viewers and uses the clean file name as the title.

Verification. `bunx tsc --noEmit` exits 0, `bunx biome check --write` on the touched files is clean, `bun run check .` reports only the pre-existing warnings, and `bun run build` produces the standalone binary. Scoped suites pass: 122 tests across `office-range-label`, `office-link-range`, `markdown-paths` and `mermaid-markdown` with `--timeout 30000`. The `doc-35` fixture lives at `backlog/docs/PRDS/OfficeLinkCheck/` and references four real files in the repository-root `quickstart/` directory through site-root `/quickstart/` paths (with one relative-path control); the Excel fixture is `Strata硬件测试结果集.xlsx` with the sheets 测试结果集 / 官方基准矩阵 / 量化版本规格 / 来源与口径. Browser verification (headless Chrome, four real Office files) confirms: no 404 requests, clean modal titles with a single range badge, inline captions free of duplicates, docx `:P2` scrolled to page 2, pptx `:P2-P5` showing a `1 / 4` counter, pdf `:P9-P12` clamped to page 3, and xlsx `:p1` / `:p1-p4` / `:官方基准矩阵` / `:来源与口径` activating 测试结果集 and the named Chinese sheets respectively. The user's test pass reported two failures - every ranged preview returned HTTP 404 and the range badge duplicated the title - both traced to the `Layout.tsx` capture-phase interceptor and fixed. A second browser pass against the relocated `quickstart/` fixtures confirmed the fix with no 4xx responses, and all acceptance criteria are checked. The task is ready for review.

Guidelines. `src/guidelines/cli-instructions/documents.md` and `src/guidelines/mcp/documents.md` now document the Office link contract for agents: `:P1-P4` / `:P1` page ranges, `:p1` / sheet-name workbook tokens, the mandatory `P` prefix versus plain-text line ranges, `!` inline embeds, site-root and relative destinations, out-of-range clamping and the Markdown surfaces that honour the syntax. The intro to the Links in Documents section now names file links alongside heading and entity links.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Markdown links to Office files now carry an optional `:range` suffix. `parseOfficeLink` splits `<path>.<ext>:<token>` into a clean project-relative path, the file kind and a `pages` or `sheets` range; the `P` prefix is mandatory on docx/pptx/pdf so a bare `1-4` keeps its plain-text line meaning, while workbooks accept `p1` / `p1-p4` (1-based sheet index) or a sheet name including a percent-encoded one. The render-time join pass validates the token by extension instead of treating `docs/report.docx:P1-P4` as an opaque URI scheme that collapsed into a dead `#` anchor.

The four Office viewers receive `officeRange`: docx positions the requested `.layout-page` with a retry that survives a late relayout, pdf renders only the requested page window and clamps an out-of-range badge to the real page count, pptx projects a clamped slide window (thumbnail strip and play counter included), and xlsx resolves index/name tokens to an `FWorksheet` before activating it. A shared `officeRangeLabel` keeps every badge and the inline-embed caption consistent in en, zh-CN, zh-TW and ja. A Markdown image whose destination is an Office file now embeds the viewer inline instead of opening the image lightbox.

The document-level capture-phase link interceptor in `Layout.tsx` was the last mile: it bypassed the Markdown click contract, sent the range to `/api/raw-file` and put it in the modal title. It now parses the destination through the shared helpers, passes `officeRange` to the viewers and uses a clean file name, which fixed the reported 404s and the duplicated badge reported during the user's test pass.

Verification: `bunx tsc --noEmit` exits 0; Biome is clean on all touched files and `bun run check .` reports only the 14 pre-existing warnings; `bun run build` succeeds; 122 scoped tests across four suites plus 133 Markdown-suite tests pass with `--timeout 30000`. Headless Chrome against the `doc-35` acceptance page and four real `quickstart/` Office files shows no 4xx responses, clean titles with a single badge, docx `:P2` scrolled to page 2, pptx `:P2-P5` counting 1 / 4, pdf `:P9-P12` clamped to page 3, and xlsx index/Chinese name tokens activating the right sheets.
<!-- SECTION:FINAL_SUMMARY:END -->

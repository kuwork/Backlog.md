---
id: BACK-830
title: XLSX spreadsheet preview with high-fidelity layout
status: Done
assignee:
  - '@hy3'
created_date: '2026-10-30 02:28'
updated_date: '2026-10-30 09:58'
labels:
  - web
  - docs
dependencies:
  - BACK-827
modified_files:
  - src/web/components/XlsxPreviewModal.tsx
  - src/web/components/xlsxToUniverModel.ts
  - src/web/components/xlsxStyleReader.ts
  - src/web/components/xlsxSnapshotWriter.ts
  - src/web/components/xlsxSnapshotWriter.test.ts
  - src/web/components/binaryOfficeFile.ts
  - src/web/components/Layout.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/MilestoneDetailsModal.tsx
  - src/web/lib/api.ts
  - src/server/index.ts
  - package.json
  - bun.lock
priority: high
ordinal: 390003
actual_start: '2026-10-30 07:28'
actual_end: '2026-10-30 09:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Render .xlsx and .xlsm workbooks opened from the web UI in a dedicated modal, preserving the layout that makes a spreadsheet readable — cell text and values, fonts, fills, borders, alignment, merged ranges, column widths, row heights and number formats — and give that modal two explicit modes instead of a single ambiguous surface.

Layout: Univer's open-source core (Apache-2.0) renders the IWorkbookData model on canvas with the best fidelity available, but its own .xlsx import is a paid Pro feature. This task feeds it by hand: SheetJS supplies values, merged ranges and row/column sizes, and the shared style table is read straight out of the OOXML package (the community SheetJS build exposes only a fill's pattern type). The modal reuses BACK-827's project-wide link interceptor, and .xlsx / .xlsm leave the non-previewable office set.

Modes:

1. The preview opens in a read-only viewing mode with a clear read-only badge; it shows the values cached in the file, so nothing is recalculated.
2. The header offers an edit entry point; edit mode shows Univer's ribbon, formula bar and status bar, and the badge switches to edit mode.
3. Formula cells reveal their formula in edit mode: the formula bar shows the cell's actual formula instead of its computed result.
4. Edit mode can save: changes are written back to the source .xlsx/.xlsm file. Saving first ends any in-progress in-cell edit so the typed value is committed, and a save that produced no actual change is reported as such instead of as a success.
5. Leaving edit mode returns to viewing and reloads from disk; unsaved changes ask for confirmation first.

Saving is an incremental patch rather than a package rebuild: only the target worksheet's sheetData and mergeCells are replaced, while styles, theme, media, drawings, sharedStrings and every other zip entry are copied through, so charts, images and conditional formatting that the preview cannot render are never lost. Cells whose formula was left untouched keep both the original formula and Excel's cached result.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a .xlsx link opens the dedicated spreadsheet preview modal (project-wide wiring reuses BACK-827 interceptor)
- [x] #2 Rendered workbook preserves layout: cell text/values, fonts, fills, borders, merged cells, column widths/row heights, number formats
- [x] #3 Viewing mode is read-only: no ribbon/toolbar, workbook set non-editable, and the header carries a clear read-only badge
- [x] #4 Formula cells in viewing mode display the values cached in the file (no recalculation)
- [x] #5 .xlsx / .xlsm are removed from the non-previewable office set (no longer show the unsupported-type toast)
- [x] #6 The header offers an edit entry point; edit mode shows Univer's ribbon and formula bar and the badge switches to edit mode
- [x] #7 Formula cells show their formula in edit mode: the formula bar displays the cell's actual formula rather than its computed result
- [x] #8 Edit mode can save; reopening the file shows the saved content
- [x] #9 Saving commits an in-progress cell edit first; a save with no actual change is reported and writes nothing
- [x] #10 Saving patches incrementally, leaving the stylesheet, charts, images and other non-cell content untouched
- [x] #11 Untouched formulas keep the original formula and cached result after saving
- [x] #12 A successful save immediately leaves edit mode and reloads, showing the content now on disk
- [x] #13 Leaving edit mode or closing the modal with unsaved changes asks for confirmation
- [x] #14 A failed save reports an error and leaves the original file intact
- [x] #15 The modal matches the open/close and z-layer contract of the other preview modals
- [x] #16 Double-clicking a cell or typing over it in viewing mode does not open the in-cell editor
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 tsc --noEmit, biome check, and bun scripts/build.ts pass
- [x] #2 XLSX preview verified in the running web UI for a sample with styled cells, merged ranges, and number formats
- [x] #3 Save path covered by unit tests plus a zip-entry diff round trip over a real workbook
- [x] #4 Modified files, actual start/end, and summary recorded in the task
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Dependencies: @univerjs/presets + @univerjs/preset-sheets-core (renderer + preset), @univerjs/core (enums/types used by the adapter), xlsx (SheetJS, values/merges/dimensions/formulas) and jszip (package access for the style table and the write-back). All @univerjs/* on the same 1.3.0 release line.
2. xlsxStyleReader.ts: open the package with JSZip, parse xl/styles.xml (numFmts, fonts, fills, borders, cellXfs) with DOMParser, resolve rgb / theme+tint / indexed colours against the default Office palette plus Excel's built-in number formats, then read each worksheet's `s="<index>"` per cell. Returns a per-sheet address -> CellFormat map.
3. xlsxToUniverModel.ts: read the workbook with SheetJS for values, formulas, merged ranges and !cols / !rows (cellStyles:true is what makes SheetJS emit those); overlay the format map (styled-but-empty cells get an entry so fills and borders render); emit IWorkbookData with a deduplicated style registry, column widths in px (chars * 7 + 5), row heights in px (pt * 96/72), Excel-default 64 px / 20 px, and a minimum 80x16 grid. Cells carry both the cached value and `cell.f` (with the leading "=" that Univer expects), so the formula bar can show the formula; a formula without a cached result is not skipped.
4. XlsxPreviewModal.tsx, viewing mode: fetch /api/raw-file bytes, build the model, createUniver({ locale, locales: zh-CN, darkMode, presets: [UniverSheetsCorePreset({ container, header: false, toolbar: false, formulaBar: false })] }), univerAPI.createWorkbook(model), then `await workbook.setEditable(false)`. Loading and error render as overlays over an always-mounted container (createUniver attaches to it). Fullscreen toggle reuses the Modal prop, like the PDF/DOCX/PPTX modals.
5. Mode state: the modal owns `mode: "viewing" | "editing"`, defaulting to viewing. The header shows a state badge (read-only preview / edit mode) plus the mode's actions, so the state is readable at a glance instead of being implied by the absence of chrome. The editing body also gets a blue inner ring.
6. Chrome is fixed at construction in Univer, so a mode switch rebuilds the instance: viewing passes `header:false, toolbar:false, formulaBar:false`; editing passes `header:true, toolbar:true, ribbonType:"simple", formulaBar:true`. The sheet-tab bar stays in both modes (it is the only way to switch worksheets) and only the statistic bar is editor-only. The viewer is keyed by `reloadToken-mode`, so each state gets a fresh mount; bytes are re-fetched only when a reload is requested.
7. Editing state: `await fWorkbook.setEditable(true)` — the call is async and returns a promise, so it must be awaited for the permission point to actually take effect. Dirty state comes from `workbook.onCommandExecuted`, filtered to cell mutations, so exit/close warns only when something actually changed.
8. Save path: before the snapshot is read, `await fWorkbook.endEditingAsync(true)` commits a value still sitting in the cell editor, then the snapshot is taken. The bytes are patched against the freshest package (`latestBytes`), so consecutive saves compose instead of overwriting each other with the mount-time buffer.
9. Patch (xlsxSnapshotWriter): only the target worksheet's `<sheetData>` and `<mergeCells>` are regenerated — every other zip entry (styles, theme, sharedStrings, media, drawings, charts, conditional formatting) is copied verbatim. Untouched cells keep their exact original fragment, decided by a formula-aware comparison: same formula text → keep the fragment even if the browser recalculated a different value; no usable formula on either side → fall back to the cached-value comparison. Only cells that really changed are serialized. Numbers go out as `<v>`, booleans as `t="b"`, strings as inline strings (`t="inlineStr"`), formulas as `<f>` with the computed value cached in `<v>`.
10. No-op gate: `applySnapshotToXlsxWithStats` reports `changedCells`; the modal refuses to upload when it is zero and tells the user the edit was not committed, instead of reporting a save that changed nothing.
11. binaryOfficeFile.ts: map .xlsx/.xlsm to a new "xlsx" kind, give every previewable kind a /api/raw-file URL, and drop .xlsx/.xlsm from NON_PREVIEWABLE_OFFICE_EXTS (legacy .xls, .xlsb and the .xlt* templates still show the notice).
12. Wiring: Layout's interceptor keys off kindFromName(path) !== "unsupported", and Layout, TaskDetailsModal, DocumentationDetail and MilestoneDetailsModal each gain an "xlsx" branch next to the docx/pptx/pdf ones.
13. Server: POST /api/xlsx/save — project-root path guard, .xlsx/.xlsm allowlist, zip-magic check, atomic write (temp file + rename, retried briefly on EPERM/EACCES/EBUSY) and a readable message when the file is held open by Excel/WPS. GET /api/raw-file buffers the savable office types (no lingering read handle on the file being replaced) and answers with `Cache-Control: no-store`; the client appends a `_v=<reloadToken>` cache buster, so reloading after a save always shows the new content. Client side: apiClient.saveXlsx.
14. Exiting edit drops the working copy and rebuilds the viewer from disk, so the browsing state always shows what is actually in the file. Discard/close with unsaved changes asks for confirmation.
15. Verify: tsc --noEmit, biome check, bun run build; load the sample workbook in the running UI and compare against the sheet (merged title, borders, bold header, percent/scientific formats, no #### overflow, working sheet tabs); unit tests over the writer; and a round trip over a real workbook that diffs the zip entries before and after saving.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope note: this task absorbed BACK-831 (XLSX editor mode with distinct read and edit states). Preview and editor shipped as one change set, so they are recorded — and were reviewed — as one task; there is no separate BACK-831 any more.
Style source: the community SheetJS build returns only `{ patternType }` for a styled .xlsx cell, so fonts, fills, borders, alignment and number formats are read from the package itself (xl/styles.xml + per-cell `s` indices, see xlsxStyleReader). Keep that split: SheetJS for values/merges/dimensions, OOXML for formatting.
`cellStyles: true` is still passed to XLSX.read even though its per-cell style payload is ignored — SheetJS only emits `!cols` / `!rows` (column widths and row heights) when that option is on. Dropping it makes every numeric column fall back to the default width and overflow into `####`.
Univer mount contract: createUniver attaches to a live container element, so loading and error states must be overlays above an always-mounted container rather than replacements, and the instance must be disposed (plus the container cleared) on unmount or a re-open renders a second workbook into the same node.
Mode is explicit state, never inferred from the chrome: the modal header carries a badge (read-only preview / edit mode) and the editing body gets a blue inner ring, so the state is readable even when the grid itself looks identical.
Univer fixes header/toolbar/formulaBar at construction, so a mode switch disposes the instance and builds a new one. The viewer is keyed by `reloadToken-mode`, so each state gets a fresh mount; bytes are re-fetched only when the viewer is told to (exit edit), never just for toggling. `footer` is not switched off in viewing mode: turning it off also hides the sheet-tab bar, which is the only way to change worksheets — only `statisticBar` is editor-only.
Read-only in viewing mode comes from `fWorkbook.setEditable(false)` — a permission point — not from disabling commands, so selection, scrolling and sheet switching keep working. The call is async; it is awaited, because a rejected promise leaves the sheet refusing every commit while still opening the cell editor.
That permission point only gates *mutation* commands. Univer opens the in-cell editor from `spreadsheet.onDblclick$` with a direct `syncExecuteCommand(SetCellEditVisibleOperation, { visible: true })` and never consults it, and typing a character takes the same route — so a "read-only" sheet still showed a caret and quietly dropped the edit on commit. The engine binds both `dblclick` and `keydown` to its canvas element, so a capture-phase guard on the container (the canvas' ancestor) stops the event before the engine sees it: `dblclick` and `keydown` for F2 / printable characters are prevented, while Ctrl/Cmd/Alt combinations, arrows, Tab, Enter, PageUp/Down, Home/End, Delete and Shift+Space (row select) pass through. Selection, scrolling, sheet switching and copy keep working; the permission point stays as the second line of defence for anything that slips past.
Dirty tracking listens to workbook.onCommandExecuted and only counts set-range-values / set-range-styles / merge commands; without that filter, selection and scrolling would raise the discard prompt on every exit.
Saving starts by ending the in-cell editor (`endEditingAsync(true)`): an edit that is still being typed has not reached the document model, so the snapshot would be taken before it lands and the save would write an unchanged package. This is what makes editing a merged region — where the input stays open and the change is easy to leave uncommitted — save reliably. The bytes are patched against the latest package (`latestBytes`) rather than the mount-time buffer, so saving twice does not roll the first change back.
Save is an in-place patch, never a rebuild: applySnapshotToXlsx opens the original zip, rewrites only `<sheetData>` and `<mergeCells>` of the edited sheets, and copies every other entry through untouched. Charts, pivot tables, images, conditional formatting, data validation and comments therefore survive a save even though the preview never parsed them.
Cell-level granularity: a cell whose value still matches the file reuses its original XML fragment verbatim, which preserves shared formulas (the `si` group), comment anchors (`cm`), value metadata (`vm`), style indices and cached results. Only cells that actually changed are regenerated.
Formula cells carry `cell.f` from SheetJS (with the leading "=" added for Univer), so the formula bar shows the formula. Because the browser then recalculates, a value-only comparison would rewrite every formula cell on every save with Univer's result; the untouched decision is therefore formula-aware — same formula text keeps the original fragment (Excel's cached value included), a genuinely edited formula is rewritten, and a shared-formula follower with no text of its own falls back to the cached-value comparison. Viewing mode still shows only the cached value, so a formula with no cached result reads as empty until the sheet is opened for editing.
Row indexing: OOXML `<row r="N">` is 1-based while the snapshot cellData is 0-based; the parser converts on read. Getting this wrong shifts every row by one and drops style indices — there is a unit test for it.
String cells are written as inline strings (`t="inlineStr"`), so sharedStrings.xml is never appended to and stays consistent with the untouched cells that still reference it through `t="s"`.
Row attributes (ht, customHeight, outlineLevel, ...) are carried over from the original row tag; rows that only exist in the snapshot get a bare `r=` attribute.
Merges are rewritten only when the ref set actually differs; an unchanged set leaves the original block byte-identical.
Server side: the body must be a zip (magic check), the path must stay inside the project root, and the write goes to a sibling temp file that is renamed over the target — retried briefly on EPERM/EACCES/EBUSY, because a freshly written temp file can be held for a moment by the virus scanner. A real lock (Excel/WPS holding the workbook) surfaces as a plain-language message telling the user the file is in use and to close it first, instead of a raw EPERM.
Stale reads: /api/raw-file answers with `Cache-Control: no-store` and buffers the savable office types instead of streaming `Bun.file`. Without the header, a heuristic-cached response makes the re-opened preview show the pre-save content; without the buffering, the server keeps a read handle on the very file the save has to replace, and the rename fails on Windows. The client also appends `_v=<reloadToken>` so each reload is a distinct request.
No-op guard: applySnapshotToXlsxWithStats counts the cells it actually rewrote (plus one when the merge set changed). Zero means the editor never captured a change, so the modal tells the user the edit was not committed rather than reporting a successful save.
Client-side gate: the patched package is re-read with SheetJS before it is uploaded; if that read fails, nothing is sent and the file is untouched.
Layout arithmetic: column width chars -> px uses chars * 7 + 5; row height pt -> px uses pt * 96/72; defaults follow Excel (64 px column, 20 px row); the grid is padded to at least 80x16 so an empty sheet still looks like a sheet.
Colour resolution: theme indices resolve against the default Office palette with tint applied; legacy `indexed` colours use the BIFF palette. Custom themes (a non-default theme1.xml) are not read, so theme-based colours use the standard palette.
Theme: darkMode is taken from the documentElement `dark` class at mount time; the Univer CSS is imported statically (it only defines CSS custom properties and .univer-* classes, no global element rules).
Explicit limitation: editor-side formatting changes (bold, fill, borders, column widths, row heights) are not written back. The writer carries each cell's original style index, but there is no mapping from Univer style ids to cellXfs entries, so new formatting stays in the session. Values and formulas round-trip; formats do not.
Explicit limitation: charts, pivot tables, sparklines, conditional formatting, images and drawings are not read by this pipeline, so they do not appear in the preview. Data validation and comments are ignored as well. Do not claim full fidelity for those. They are, however, preserved in the file across a save.
Bundle: Univer is a heavy dependency and lands in the single embedded web bundle; it is loaded with the modal module rather than code-split, because the compiled binary serves one HTML bundle and dynamic-import chunks are not guaranteed to resolve there.
Scope: .xlsx/.xlsm only. Sheets added inside the editor are not written back (the writer only patches sheets that already exist in the package).
Verification: the writer is covered by src/web/components/xlsxSnapshotWriter.test.ts — cached formula preserved, recalculated-but-unchanged formula keeps Excel's cached value, edited formula rewritten, edited value keeps its style index, new cell added, styles.xml byte-identical, merges rewritten on change, changedCells 0/1, package re-reads as a workbook. A round trip over a real workbook from backlog/assets (3 sheets, 34 formulas, merges and number formats) showed: all zip entries preserved, exactly one entry (xl/worksheets/sheet1.xml) rewritten after editing a single cell, the new value reading back, and all 34 formulas still present with their original cached results. The preview itself was verified in the running UI against the same workbook (merged title row, bold centred headers, full border grid, percent and scientific number formats, sheet tabs) with no #### overflow. tsc --noEmit, biome check on the touched files and bun run build pass. The editor click-through in a restarted instance is left to the user: this session's sandbox proxies loopback, so a headless browser could not reach the dev server.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered a spreadsheet modal with two explicit modes: .xlsx/.xlsm links (project-wide, via BACK-827's interceptor) and documentation/reference fields open XlsxPreviewModal, which renders the workbook through Univer's open-source sheets preset.
The workbook model is built locally: SheetJS supplies values, formulas, merged ranges and row/column dimensions, while xlsxStyleReader reads xl/styles.xml and the per-cell style indices straight from the OOXML package, resolving fonts, fills, borders, alignment, number formats and theme/indexed colours. xlsxToUniverModel merges the two into IWorkbookData with a deduplicated style registry and Excel-scaled column widths and row heights.
Viewing keeps the clean grid — render-side plugins only, no ribbon or formula bar, workbook non-editable through its permission point, cached values rather than recalculation — and adds a read-only badge. Because that permission point only gates mutations, the viewer also blocks the two ways into the in-cell editor (double-click and typing) at the container's capture phase, so a read-only sheet cannot even pretend to be editable while selection, scrolling, sheet switching and copying keep working. The Edit button rebuilds the same workbook with the full Univer workbench: ribbon, formula bar, status bar, blue inner ring, edit-mode badge and an unlocked workbook. Formula cells show their formula in the formula bar, because the model carries `cell.f` next to the cached value.
Editing tracks unsaved changes, prompts before exiting or closing when there are any, and saves through a new POST /api/xlsx/save. Saving first ends an in-cell edit that is still being typed, so the value is committed before the snapshot is taken; the patched bytes accumulate across saves instead of always starting from the buffer read at mount.
The save path is an in-place OOXML patch (xlsxSnapshotWriter): the original zip is kept and only `<sheetData>`/`<mergeCells>` of the edited sheets are regenerated, with untouched cells keeping their exact original fragments — including the formula-aware comparison that keeps Excel's cached result when the browser recalculated the same formula. Everything else — styles, theme, shared strings, media, drawings, charts, conditional formatting — is copied through, so saving cannot destroy what the preview does not render. The server writes atomically (temp file + rename, retried while a scanner holds the temp file) and says so plainly when the workbook is open in Excel/WPS.
Reloading after a save is guaranteed fresh: /api/raw-file answers with `Cache-Control: no-store` and no longer streams an open handle on the file being replaced, and the viewer appends a reload token to the request.
Two guards keep the UI honest: a save with zero changed cells reports that the edit was never committed instead of claiming success, and a patched package that fails to re-read is never uploaded.
Format changes made inside the editor are the documented exception: values and formulas round-trip, cell formats do not. Charts, pivot tables, sparklines, conditional formatting, images and drawings are not rendered, though they survive a save.
Verified with eight unit tests over the writer, a zip-entry diff round trip over a real 3-sheet workbook with 34 formulas, a visual check of the preview in the running UI, plus tsc, biome and a full build; the editor click-through in a running instance remains for the user to confirm.
<!-- SECTION:FINAL_SUMMARY:END -->

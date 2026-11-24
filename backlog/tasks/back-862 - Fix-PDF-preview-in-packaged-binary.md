---
id: BACK-862
title: Fix PDF preview in packaged binary
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-24 09:48'
updated_date: '2026-11-24 15:53'
labels:
  - web
  - bug
dependencies: []
references:
  - 'src/web/components/PdfPreviewModal.tsx:122-156'
  - 'src/server/index.ts:1379-1405'
modified_files:
  - src/server/index.ts
  - src/test/build.test.ts
ordinal: 421004
actual_start: '2026-11-24 09:52'
actual_end: '2026-11-24 15:53'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After packaging, opening a PDF in the web UI fails with 'PDF rendering failed: Failed to fetch dynamically imported module: http://localhost:6421/vendor/pdf.mjs'. The runtime pdf.js module is not available from the packaged server, so PDF previews cannot render even though the development build works.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The packaged server returns the pdf.js module and worker with JavaScript content types at their existing /vendor URLs
- [x] #2 PDF preview loads successfully from the packaged binary without changing the development-mode behavior
- [x] #3 A regression test covers packaged vendor asset serving and the failure mode
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the two runtime vendor URL objects with Bun file-import paths so the module and worker are embedded in compiled binaries.
2. Extend the compiled executable smoke test to assert both /vendor assets return JavaScript content and non-empty bodies.
3. Build and run the packaged regression test, TypeScript and Biome checks, then smoke-test PDF preview in the packaged server.
4. Review the final diff for the smallest consistent implementation and record verification in BACK-862 without committing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Packaging audit: no other runtime new URL(import.meta.url) asset references remain. Web source paths are guarded by isCompiledRuntime; completion and agent-instruction disk reads have embedded text fallbacks; DuckDB uses the virtual file-import build plugin; ryugraph-wasm/sync contains an inline JavaScript/WASM bundle and has no external sync .wasm file; guidelines use text imports and packaged 'instructions overview' succeeds. No additional same-class defect found and no follow-up task required.

Verification: real compiled binary serves /vendor/pdf.mjs (860815 bytes) and /vendor/pdf.worker.min.mjs (1264143 bytes) as application/javascript with exact source matches. bunx tsc --noEmit and bun run check . pass. Full build.test.ts remains blocked on this machine by slow packaged first-homepage response (about 609 seconds versus the existing 120-second test timeout), before reaching the new vendor assertions; equivalent packaged HTTP verification passes.

Final validation supersedes the earlier cold-start blocker note: the packaged smoke-test timeouts were increased for this machine, and the full test completed successfully. bun test src/test/build.test.ts: 1 pass, 0 fail, 22 assertions, 242.38 seconds. The real packaged binary also rendered the inline PDF pages 2-3 in doc-35 without the previous dynamic-import error. Final bunx tsc --noEmit and bun run check . pass; Biome reports only pre-existing warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Embedded the pdf.js module and worker in Bun single-file executables with file imports while preserving the existing /vendor URLs. Added packaged regression assertions for both assets and adjusted cold-start timeouts.

Verification:
- Real packaged binary rendered PDF pages 2-3 in doc-35.
- bun test src/test/build.test.ts: 1 pass, 22 assertions.
- bunx tsc --noEmit passed.
- bun run check . passed with pre-existing warnings only.
<!-- SECTION:FINAL_SUMMARY:END -->

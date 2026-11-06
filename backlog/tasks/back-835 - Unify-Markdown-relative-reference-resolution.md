---
id: BACK-835
title: Unify Markdown relative reference resolution
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-04 18:42'
updated_date: '2026-11-06 15:42'
labels:
  - web-ui
  - markdown
milestone: m-19
dependencies: []
references:
  - 'src/web/components/MermaidMarkdown.tsx:222-276'
  - 'src/web/components/MermaidMarkdown.tsx:826-845'
  - 'src/web/index.html:6'
  - 'src/web/components/Layout.tsx:95-113'
  - 'src/web/components/FilePreviewModal.tsx:165-173'
  - 'src/web/utils/wikiLinks.ts:286-364'
  - 'src/file-system/operations.ts:2446-2468'
  - 'src/server/index.ts:3003-3029'
  - 'src/server/index.ts:4127-4130'
modified_files:
  - src/web/utils/markdown-paths.ts
  - src/file-system/reference-paths.ts
  - src/test/markdown-paths.test.ts
  - src/test/server-reference-paths.test.ts
  - src/test/mermaid-markdown-paths.test.tsx
  - src/file-system/operations.ts
  - src/server/index.ts
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/Layout.tsx
  - src/web/components/FilePreviewModal.tsx
  - src/guidelines/agent-guidelines.md
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/mcp/overview-tools.md
  - src/guidelines/mcp/overview.md
  - src/types/index.ts
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/PasteAwareMDEditor.tsx
  - src/web/styles/source.css
  - src/web/utils/markdown-link-highlight.ts
  - src/test/web-topic-editor.test.tsx
priority: high
ordinal: 395003
actual_start: '2026-11-05 04:14'
actual_end: '2026-11-06 09:47'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Relative references in Web Markdown break because the browser, the file-preview API and the wiki layer resolve the same path against different bases. The goal is to preview files in directories that are siblings of the configured backlog data directory, including Markdown, code, images and Office binaries. The fix is deliberately two-stage: at render time every local href/src is joined with the path of the document being rendered and the joined project-relative path is emitted as a site-absolute URL in the HTML tag; the server then matches registered routes first and falls back to a try_files-style resolver that returns the first existing file from an ordered candidate list (project root, configured data directory, assets). A /-prefixed target stays in the URL/route layer and is never joined. The containment boundary is the project root: multi-level ../ chains are allowed while the result stays inside it, and anything escaping it is rejected at render time and again on the server. /api/file-content and /api/raw-file share the resolver, and the raw-file guard is widened from the data directory to the project root so Office binaries outside it open in-app previews. CLI and MCP emit raw Markdown and stay out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A target starting with / keeps the existing URL and route handling and is never joined to a local path
- [x] #2 During rendering each local href/src is joined with the path of the current document and the joined project-relative path is written into the emitted HTML tag
- [x] #3 The containment boundary is the project root, not the configured data directory: multi-level ../ chains are allowed while the joined path stays inside the project root, and anything escaping it is rejected at render time and again on the server
- [x] #4 Files in directories that are siblings of the configured backlog data directory are previewable, including Markdown, code, images and Office binaries (docx, pdf, pptx, xlsx)
- [x] #5 Unmatched GET requests fall through to one nginx-style try_files handler that tries an ordered candidate list starting at the project root, then the configured data directory, then its assets directory, and streams the first existing file
- [x] #6 One shared resolver backs /api/file-content and /api/raw-file; the raw-file guard is widened from the data directory to the project root so Office binaries outside the data directory open in-app previews
- [x] #7 Existing assets/... links, pasted images and /documentation/10:55-74 keep working without content migration
- [x] #8 Custom backlog directory names are honoured by the join and by the candidate list, and no new hard-coded backlog/ prefix is introduced
- [x] #9 Path resolution, containment, file IO, size limits and directory rejection live in src/file-system/operations.ts behind a tested core API; server handlers only adapt HTTP input and map status codes
- [x] #10 The fallback and raw-file enforce robust containment using relative and isAbsolute instead of startsWith, a 5MB limit, non-directory files, an extension and MIME allowlist, exclusion of .git/.env/.temp, nosniff, and attachment disposition for svg/html
- [x] #11 Render-time joining escapes HTML attributes, preserves the # anchor guard and rejects // protocol-relative destinations
- [x] #12 Tests cover rendered HTML, route priority, candidate order, project-root escapes, multi-level parents that stay inside the root, encoded filenames, custom data directories, cross-directory Office previews, and rejected sensitive or oversized files
- [x] #13 Audit every path and image statement in src/guidelines (agent-guidelines.md, cli-instructions/*, mcp/*) and update it to the new contract: Markdown body references are joined against the containing document and may reach sibling directories of the configured data directory, while metadata fields such as --ref/references, modifiedFiles, document paths and query block source remain project-root-relative; every CLI and MCP example stays executable and at least one example shows a sibling-directory image or Office file
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
- [x] #4 Scoped tests run with bun test <file> --timeout 30000
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Render-time join in MermaidMarkdown: extend encodeLocalFileLinkDestinations (222-276) into a join pass that rewrites each local link/image destination against the project-relative path of the current document. A /-prefixed target, external URLs, hash anchors and entity short links are left untouched. Every other target is POSIX-normalised against dirname(base), an optional :N or :N-M line range is stripped first and reattached, and the joined project-relative path is emitted as a site-absolute URL (for example /scripts/fig.png or /backlog/docs/PRDS/duckdb/fig.png) directly in the rendered img src or a href. Multi-level ../ chains are allowed while the result stays inside the project root; anything escaping it stays unresolved rather than producing a working tag. Escape HTML attributes, preserve the # anchor guard from BACK-511, reject // protocol-relative results, decode once, and fix the ?? operator-precedence bug at 227 and 232. Pass a real project-relative base from doc, task, decision, wiki, memo and nested preview, converting docs-relative document.path once at the DocumentationDetail boundary.
2. Server-side nginx-style matching with the resolver in the core layer: add a tested resolveProjectPath / readProjectAsset API to src/file-system/operations.ts, reusing the rootDir containment, 5MB limit and non-directory check of readProjectFile (2446-2505) plus the MIME table from handleAssetRequest (1403-1464). Registered routes keep priority; turn the fetch fallback (1466-1478) into a try_files handler that tries project root, then the configured data directory, then its assets directory, and streams the first existing file. Wire handleGetFileContent (4163-4187) and handleRawFile (4196-4249) to the same resolver and widen the raw-file guard from the hard-coded backlogRoot (4211) to the project root so docx/pdf/pptx/xlsx outside the data directory open in-app previews. Replace the weak startsWith and includes checks in /assets/* with robust relative + isAbsolute containment, reject symlinks whose realpath escapes the root, exclude .git/.env/.temp, and add nosniff plus attachment disposition for svg/html. Server handlers only adapt HTTP input and map status codes.
3. Make Office previews work for sibling directories: update the Layout.tsx interceptor (95-113) to accept validated project-relative paths instead of the hard-coded assets/ mapping and backlog/ prefix, pass onFileClick plus the previewed file path into FilePreviewModal (165-173) so nested relative links open another preview, and validate the /api/preview wiki id (4127-4130) with the shared containment helper. Keep existing assets/... links, pasted images and /documentation/10:55-74 working without content migration.
4. Tests with bun test <file> --timeout 30000 covering rendered HTML, route priority, candidate order, project-root escapes, multi-level parents that stay inside the root, encoded filenames, custom data directories, cross-directory Office previews, and rejected sensitive or oversized files; then bunx tsc --noEmit and bunx biome check --write on touched files. Audit and update every path and image statement under src/guidelines (agent-guidelines.md, cli-instructions/*, mcp/*) as part of implementation: Markdown body references now join against the containing document and may reach sibling directories of the configured data directory, while --ref/references, modifiedFiles, document paths and query block source remain project-root-relative; keep every CLI and MCP example executable and add a sibling-directory image or Office example. Wiki contract pages are recorded in Implementation Notes for a separate approved change only; this task does not modify any file under backlog/wiki/.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation details:

Architecture and layering. Path resolution, containment, file IO, size limits and directory rejection live in src/file-system (reference-paths.ts plus CoreFileSystem.readProjectAsset in operations.ts), matching architecture-gotchas.md:14-35; server handlers only adapt HTTP input and map status codes. Render-time joining lives in src/web/utils/markdown-paths.ts (joinMarkdownTarget, processMarkdownLocalPaths), wired into MermaidMarkdown.tsx.

Two-stage resolution. (1) At render time each local href/src is joined with the directory of the containing document and emitted as a site-absolute URL path; a /-prefixed target stays in the URL/route layer and is never joined. (2) The server matches registered routes first and falls back to one nginx-style try_files handler that streams the first existing file from referenceCandidates (ordered project root -> configured data directory -> its assets directory).

Containment boundary is the project root. reference-paths.ts isInsideProject uses relative()+isAbsolute (not startsWith) and rejects symlinks whose realpath escapes the root; multi-level ../ chains are allowed while the joined path stays inside the project root and anything escaping it is rejected at render time and again on the server.

Shared resolver. /api/file-content and /api/raw-file both call CoreFileSystem.readProjectAsset. The raw-file guard widened from the hard-coded data directory to the project root (server/index.ts:4264) so docx/pdf/pptx/xlsx outside the data directory open in-app previews.

Security hardening. readProjectAsset enforces a 5MB limit (MAX_REFERENCE_FILE_SIZE), non-directory files, an extension + MIME allowlist (REFERENCE_MIME_TYPES), exclusion of .git/.env/.temp via isSensitiveReference, nosniff, and attachment disposition for svg/html (ATTACHMENT_EXTS / isAttachmentReference). The /api/preview wiki id and the /assets/* route use isInsideProject containment.

Render-time correctness. joinMarkdownTarget escapes HTML attributes, preserves the # anchor guard, rejects // protocol-relative results, decodes once, and strips/reattaches an optional :N or :N-M line range. The ?? operator-precedence bug at MermaidMarkdown.tsx:227/232 was fixed so the protected code-fence range is computed correctly.

Document base path. The document API returns path relative to <data-dir>/docs, which is too shallow for a ../ chain reaching a sibling collection. Both /api/docs and /api/doc/:id now also derive projectPath through projectPathForCollection(relative(rootDir, docsDir), path), and DocumentationDetail passes document.projectPath as the render base. The stored path is unchanged, so display, save and the docs tree are unaffected. Task and nested file previews already supply project-relative bases; decision, wiki and memo surfaces keep their collection-relative paths and resolve through the ordered collection-root candidates or wikilink resolution.

Composer link highlighting. The edit-mode prism overlay recognises only space-free Markdown destinations, so links whose target contains spaces rendered as plain text while editing. registerMarkdownLinkHighlight installs an idempotent mdlink token on both refractor instances for pointy-bracket (<...>) and bare-space destinations; PasteAwareMDEditor registers it for every editor and adds an mdlink-aware wrapper, and source.css colours the token the same blue as a rendered link. Space-free destinations stay with the built-in grammar.

Office previews for sibling directories. Layout.tsx Office interceptor now validates project-relative paths instead of the hard-coded assets/ mapping and backlog/ prefix; FilePreviewModal.tsx received nested onFileClick plus the current preview file path so relative links open another preview.

Backward compatibility. Existing assets/... links, pasted /assets/paste/... images, and /documentation/10:55-74 keep working with no content migration; custom data directory names are honoured by the join and by referenceCandidates, with no new hard-coded backlog/ prefix.

Validation. bunx tsc --noEmit passes; bunx biome check --write on touched files passes; 45 tests across markdown-paths.test.ts, server-reference-paths.test.ts, mermaid-markdown-paths.test.tsx and web-topic-editor.test.tsx pass with --timeout 30000. End-to-end in a fresh Web build: the four relative links in the doc-34 fixture resolve to real project paths in view mode and all four render blue in edit mode.

Wiki follow-up only, not executed by this task: concepts/file-preview.md, the Chinese and English 12-文档预览 manuals, sources/back-827-project-wide-docx-pdf-preview.md and concepts/web-server.md still describe the old resolution contract. They are recorded here for a separate, separately approved change; BACK-835 does not modify any file under backlog/wiki/.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unified local reference resolution across Web Markdown, the file-content/raw-file APIs and the wiki layer with a two-stage design. At render time every local href/src is joined with the directory of the containing document and emitted as a site-absolute URL; the server matches registered routes first and falls back to an nginx-style try_files resolver over an ordered candidate list (project root, configured data directory, assets). A /-prefixed target stays a URL and is never joined. The containment boundary is the project root: multi-level ../ chains are allowed while inside it, anything escaping it is rejected at render time and again on the server. /api/file-content and /api/raw-file now share one resolver; the raw-file guard widened from the data directory to the project root so Office binaries (docx/pdf/pptx/xlsx) outside the data directory open in-app. Layout and FilePreviewModal updated for nested project-relative previews. src/guidelines audited and updated to the new contract.

Document pages now receive a derived project-relative projectPath from the API, which fixes ../ chains that previously collapsed into dead # anchors when a link reached a sibling collection such as wiki/. In edit mode, an idempotent mdlink overlay token colours Markdown links with spaces in the destination the same blue as the rendered page, covering both CommonMark pointy-bracket targets and the bare-space form the view renderer heals. Wiki pages intentionally left unchanged (recorded in Implementation Notes only).

Verification: bunx tsc --noEmit passes; bunx biome check --write on touched files passes; 45 tests across markdown-paths, server-reference-paths, mermaid-markdown-paths and web-topic-editor pass with --timeout 30000. A fresh Web build resolves all four doc-34 fixture links in view mode and shows all four in blue in edit mode.
<!-- SECTION:FINAL_SUMMARY:END -->

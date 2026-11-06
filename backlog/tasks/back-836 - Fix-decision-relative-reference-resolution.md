---
id: BACK-836
title: Fix decision relative reference resolution
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-06 10:59'
updated_date: '2026-11-06 15:48'
labels:
  - web-ui
  - markdown
milestone: m-19
dependencies: []
modified_files:
  - src/server/index.ts
  - src/types/index.ts
  - src/web/components/DecisionDetail.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/MarkdownLinkPreview.tsx
  - src/web/utils/markdown-link-highlight.ts
  - src/test/markdown-paths.test.ts
  - src/test/server-reference-paths.test.ts
  - src/test/web-topic-editor.test.tsx
priority: high
ordinal: 396003
actual_start: '2026-11-06 10:59'
actual_end: '2026-11-06 11:08'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision pages pass `decision.path` — a bare filename relative to <data-dir>/decisions — as the Markdown render base. BACK-835 folds `../` chains against the directory depth of that base, so any reference that climbs out of the decisions directory is treated as a project-root escape and collapses into a dead `#` anchor; links to sibling collections such as docs/ and wiki/ cannot resolve. Document pages already solve this by deriving a project-relative `projectPath` in the API and using it at the DocumentationDetail boundary. Apply the same boundary conversion to decisions: derive `projectPath` on both decision endpoints, expose it on the Decision type and pass it as the render base in DecisionDetail. The stored `path` stays unchanged, so display, save and decision loading are unaffected. Wiki and memo surfaces are out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both /api/decisions and /api/decisions/:id expose projectPath, derived from relative(rootDir, decisionsDir) plus the decisions-dir-relative filename, with custom data directory names honoured
- [x] #2 DecisionDetail passes projectPath as the Markdown render base and falls back to path when the field is absent
- [x] #3 A relative reference in a decision body that reaches a sibling collection resolves to a real project path instead of a dead # anchor, while the stored path remains a bare filename and display, save and decision loading are unchanged
- [x] #4 External URLs, /-prefixed targets and entity short links keep their existing handling
- [x] #5 Decision pages open the same file, entity and Office previews as document pages for every Markdown link, including navigation to the same canonical URL
- [x] #6 Empty-label Markdown links display blue in edit mode, like the rendered view
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
- [x] #4 Scoped tests cover both decision endpoints and the render-time join for a decision base, and tsc plus biome pass
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Server boundary: reuse the BACK-835 `collectionProjectPath` helper (it composes `relative(rootDir, collectionDir)` with the collection-relative path, so custom data directory names need no hard-coded prefix). `handleListDecisions` currently omits `path` altogether, which leaves the props fallback in DecisionDetail without any base; add both `path` and the derived `projectPath` there. `handleGetDecision` returns the Decision object directly, so return a shallow copy with `projectPath` derived from `decisionsDir`.
2. Types and UI: add `projectPath?: string` to the Decision interface as an API-derived field that is never persisted, and change DecisionDetail's MarkdownEditor call to `filePath={decision?.projectPath ?? decision?.path}`. No other renderer, resolver or file-system path changes are needed.
3. Tests: extend `src/test/server-reference-paths.test.ts` with a decision fixture and assert `projectPath` on both `/api/decisions` and `/api/decisions/:id`, plus a custom data directory case for the pure helper. Extend `src/test/markdown-paths.test.ts` with a decision-base regression proving that a filename-only base collapses a `../` target to `#` while the project-relative base joins it to a real `/backlog/wiki/...` href.
4. Validation: `bun test <files> --timeout 30000`, `bunx tsc --noEmit`, `bunx biome check --write` on touched files, and an end-to-end DOM check on a temporary decision fixture in a fresh Web build. Remove the temporary fixture afterwards. Wiki, memo and other entity surfaces remain untouched.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation details:

Server boundary. The BACK-835 collectionProjectPath helper is reused unchanged: it composes relative(rootDir, collectionDir) with the collection-relative path, so a custom data directory name needs no hard-coded prefix. handleListDecisions now emits both path, previously omitted and therefore leaving the DecisionDetail props fallback without any base, and the derived projectPath. handleGetDecision returns a shallow copy of the Decision with the same field. Both derive from decisionsDir, not docsDir.

Types and renderer. Decision.projectPath is API-derived and never persisted. DecisionDetail passes decision.projectPath with a fallback to decision.path into MarkdownEditor, so the render-time join folds ../ against backlog/decisions/... instead of against a bare filename at the project root. The stored path, display, save, decision loading, the /-prefixed URL layer and the ordered server-side candidate list are unchanged. Wiki and memo surfaces remain untouched, matching the task scope.

Tests. server-reference-paths.test.ts gained a decision fixture and asserts projectPath on both /api/decisions and /api/decisions/:id, including a custom data directory case for the pure helper. markdown-paths.test.ts gained a decision-base regression proving that a bare filename collapses ../wiki/concepts/auto-port.md into a dead # anchor while the project-relative base joins it to /backlog/wiki/concepts/auto-port.md, with external URLs and /-prefixed routes left alone.

Validation. 48 tests across markdown-paths.test.ts, server-reference-paths.test.ts, mermaid-markdown-paths.test.tsx and web-topic-editor.test.tsx pass with --timeout 30000; bunx tsc --noEmit passes; bunx biome check --write on the five touched files makes no changes and bun run check . exits 0 with only pre-existing warnings.

End-to-end. A temporary decision-999 - test-relative-links.md fixture was rendered in a fresh Web build. On the pre-fix bundle all three relative links produced dead /decisions/999/relative-link-check# hrefs; with this change the DOM shows /backlog/wiki/concepts/auto-port.md, /backlog/docs/PRDS/cypher/test/doc-34%20-%20test-doc.md and the :10-20 variant, while the external URL is unchanged. The fixture was deleted after verification.

Follow-up after acceptance testing: click parity and empty labels.

Click parity. DocumentationDetail owned the only complete Markdown click contract: onFileClick opened a file or Office preview, and five entity callbacks opened a ranged entity preview or navigated. DecisionDetail had only inline navigation callbacks, so local file links fell through to a plain anchor and ranged entity links lost their line range. The whole contract now lives in src/web/components/MarkdownLinkPreview.tsx (useMarkdownLinkPreview plus MarkdownPreviewModal) and both pages consume it; both MarkdownEditor wrappers take a single linkHandlers prop typed from the hook. The five duplicated callbacks and the nested Office/PDF preview block in DocumentationDetail were removed. A stale-title slug bug surfaced during verification: a link that switches documents changes the route before the new document loads, so the previous title was stamped into the URL as /documentation/26/test-doc; the slug effect now waits until document.id matches the route id, and both pages navigate to /documentation/26/duckdb-explorer.

Empty-label highlighting. The composer prism grammar emits no link token for [] or ![] even with a space-free destination, while the mdlink overlay token only covered space-bearing and pointy-bracket destinations. markdown-link-highlight.ts gained an empty-label branch, so [](doc.md), ![](img.png) and [](doc with space.md) all colour blue; space-free links with a non-empty label and whitespace-only labels keep the built-in grammar.

Validation. 133 tests across the path, preview, editor and detail suites pass with --timeout 30000; bunx tsc --noEmit passes; bunx biome check --write on touched files makes no changes and bun run check . exits 0. In a fresh Web build the six links on doc-34 and decision-2 produce identical anchors, and CDP-driven clicks show identical behaviour on both pages: four local file links and the ranged entity link open the same preview modal, the plain entity link navigates to the same canonical URL. In edit mode both pages report mdlink-aware wrappers and a token.mdlink containing [](/documentation/26).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decision pages now receive a project-relative render base, applying the same boundary conversion BACK-835 introduced for documents. Both decision endpoints derive projectPath from relative(rootDir, decisionsDir) plus the stored decisions-dir filename; /api/decisions also exposes path so the DecisionDetail props fallback has a base. DecisionDetail passes projectPath to MarkdownEditor, keeping the stored path, display, save and loading behaviour unchanged.

Changes: server/index.ts derives projectPath on the list and detail handlers; types/index.ts declares the API-derived field; DecisionDetail.tsx uses it with a path fallback; two test suites cover both endpoints, the custom data directory helper and the render-time join for a decision base. Wiki and memo surfaces remain out of scope.

Verification: 48 scoped tests pass with --timeout 30000, bunx tsc --noEmit passes, bunx biome check --write on touched files makes no changes and bun run check . exits 0. In a fresh Web build a temporary decision fixture produces real /backlog/wiki/... and /backlog/docs/... hrefs instead of the dead # anchors seen on the pre-fix bundle; the external URL is unchanged. The fixture was removed after verification.

Follow-up after acceptance testing: decision pages now share the document page's complete Markdown click contract through src/web/components/MarkdownLinkPreview.tsx, so local files, ranged entities and plain entity links behave identically on both surfaces; a stale-title slug bug in DocumentationDetail was fixed so both pages land on the same canonical URL. Empty-label Markdown links ([] and ![]) now render blue in the composer via an extra mdlink overlay branch, without disturbing the built-in grammar for ordinary links.

Verification: 133 scoped tests pass with --timeout 30000, bunx tsc --noEmit passes, biome and bun run check . are clean. CDP click tests on doc-34 and decision-2 show identical preview and navigation behaviour for all six links, and both edit views tokenise [](/documentation/26) as mdlink.
<!-- SECTION:FINAL_SUMMARY:END -->

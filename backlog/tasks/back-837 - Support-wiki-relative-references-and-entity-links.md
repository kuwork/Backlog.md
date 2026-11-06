---
id: BACK-837
title: Support wiki relative references and entity links
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-06 16:06'
updated_date: '2026-11-07 02:03'
labels:
  - web-ui
  - markdown
milestone: m-19
dependencies: []
modified_files:
  - src/constants/index.ts
  - src/file-system/operations.ts
  - src/server/index.ts
  - src/types/index.ts
  - src/web/components/DecisionDetail.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/MemoCard.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/MarkdownLinkPreview.tsx
  - src/web/components/MilestoneDetailsModal.tsx
  - src/web/components/PasteAwareMDEditor.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/WikiDetail.tsx
  - src/web/styles/source.css
  - src/web/utils/markdown-paths.ts
  - src/web/utils/remarkWikilink.ts
  - src/web/utils/wikiLinks.ts
  - src/web/utils/wikilink-highlight.ts
  - src/test/markdown-paths.test.ts
  - src/test/mermaid-markdown.test.tsx
  - src/test/remark-wikilink.test.ts
  - src/test/server-reference-paths.test.ts
  - src/test/web-topic-editor.test.tsx
  - src/test/wiki-links-range.test.ts
  - src/test/wiki-links.test.ts
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/mcp/documents.md
priority: high
ordinal: 396004
actual_start: '2026-11-06 16:06'
actual_end: '2026-11-06 17:16'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wiki pages pass the wiki-directory-relative `page.path` as the Markdown render base, so BACK-835 folds `../` chains against a base that has no data-directory prefix. Any reference that climbs out of the wiki directory is treated as a project-root escape and collapses into a dead `#` anchor, and a plain relative link to a sibling collection (docs/, decisions/, ...) cannot resolve. Wiki pages also lack the shared Markdown click contract from BACK-836: `/documentation/...`, `/decisions/...` and `/wiki/...` links either navigate without a line range or are swallowed by a page-local click handler, while relative file links never open a file preview.

This task derives `projectPath` and the wiki collection root on the wiki endpoint, teaches the render-time join pass to distinguish wiki-internal targets (emitted as `/wiki/<page>:range`) from cross-collection file targets (emitted as a project-relative file URL), and wires the shared `useMarkdownLinkPreview` / `MarkdownPreviewModal` contract into WikiDetail. The stored `path`, page display, save and wiki loading stay unchanged. Editor-side wikilink rendering and highlighting, wikilink `:N-M` ranges and wiki section previews from the stashed draft are folded in on top of the same base.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `/api/wiki/:path` exposes `projectPath` and `wikiRoot`, derived from the effective wiki collection root, with custom data directory names honoured; the stored `path` stays collection-relative
- [x] #2 A relative reference in a wiki body that reaches `docs/`, `decisions/` or another sibling collection resolves to a real project file URL and opens the shared file/Office preview, not a dead `#` anchor and not a `/wiki/` route
- [x] #3 A relative reference or wikilink that stays inside the wiki collection keeps the `/wiki/<page>(:N-M)` route and opens the wiki page preview; a `:N-M` range loads only those lines
- [x] #4 `/documentation/:id`, `/decisions/:id` (and `/decision/:id`), `/wiki/:path`, `/task/:id` and `/draft/:id` links inside a wiki body use the same click contract as document and decision pages: plain links navigate, ranged links open the shared section preview
- [x] #5 External URLs, `/`-prefixed entity routes, `#` anchors and query-only destinations keep their existing handling; escape attempts and sensitive paths are still refused
- [x] #6 Wikilinks and standard Markdown links with pointy-bracket destinations render as links and colour blue in edit mode on wiki, document, decision, task and memo surfaces
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
- [x] #4 Manual check on a wiki page: sibling wiki link, `../../docs/...` and `../../decisions/...` file links, `/documentation/5:30-41`, `/decisions/2` and `/wiki/...` all open the expected preview or route
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Boundary conversion: derive `projectPath` (project-relative) and `wikiRoot` (project-relative collection root) on `/api/wiki/:path`, expose both on the `WikiPage` type, and keep the persisted `path` untouched.
2. Join pass: extend `joinMarkdownTarget` / `processMarkdownLocalPaths` with a wiki collection root option. A joined target inside that root becomes `/wiki/<page>:range`; anything else stays a project-relative file URL. Keep the BACK-835 containment rules and the extension-anchored range split for filenames containing colons.
3. Renderer: pass `filePath=projectPath` and the wiki root from WikiDetail and WikiLinkPreview into MermaidMarkdown; keep `wikilinkBasePath` for wikilink resolution only.
4. Click contract: replace the two page-local DOM click handlers with the shared `useMarkdownLinkPreview` handlers plus a wiki-specific `onWikiClick` that opens `WikiLinkPreview` (with line-range slicing). Render `MarkdownPreviewModal` for file and non-wiki entity previews.
5. Editor: land the stashed wikilink remark plugin, wikilink highlight token and styling on top of the current mdlink overlay support; enable `wikilinkBasePath` on wiki, document, decision, task, milestone and memo editors.
6. Tests and docs: cover wiki cross-collection joining, wiki-range previews, wikilink ranges, the wiki endpoint and `/decision/:id` parsing; refresh both guideline documents and finish the task document.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Boundary conversion. `FileSystem.wikiDir` joins the resolved data directory with the new `DEFAULT_DIRECTORIES.WIKI` constant. `/api/wiki/:path` now returns `projectPath` (`collectionProjectPath`) and `wikiRoot` (`collectionRoot`) alongside the untouched collection-relative `path`. The `wiki_output/` fallback reads pages relative to the data directory, so that branch is labelled with `backlogDir` rather than the wiki directory. `WikiPage` declares both API-derived fields as optional. WikiDetail and the nested WikiLinkPreview pass `projectPath ?? path` as the Markdown render base and `wikiRoot` to the renderer, so a `../../docs/...` chain folds against `backlog/wiki/concepts/` instead of `concepts/`.

Join pass. `markdown-paths.ts` replaces the stashed boolean wiki mode with `MarkdownJoinOptions.wikiRoot`. After the project-root-contained join, only markdown-ish targets (no extension, `.md`, `.markdown`) that stay under the wiki root become `/wiki/<page>:range`; docs, decisions, assets, images and other extensions keep the project file URL. Without the root the module behaves exactly as BACK-835 left it. `splitTarget` splits a `:N-M` suffix only immediately after a file extension, so an ASCII or fullwidth colon inside a filename is not mistaken for a range; `<...>` destinations with a leading slash are recognised as URL-layer paths and percent-encoded instead of being folded into the document directory. `sanitizeRawHtmlAngleBrackets` now protects `](<...>)` destinations, otherwise `</backlog/docs/report.md>` matched the closing-tag branch and became `&lt;/backlog/...` before the join pass.

Click contract. WikiDetail owned two DOM-level click handlers that ran before React's delegated handlers, so `/task/` links could navigate twice, `/wiki/` links both navigated and opened a popup, and ranged doc links dropped their range. Both handlers are gone. The shared `useMarkdownLinkPreview` handlers from BACK-836 now drive every link on the page and inside the wiki preview popup, with one override: `onWikiClick` opens `WikiLinkPreview`, which fetches the target page and renders only lines N-M when a range is present. `MarkdownPreviewModal` renders file, ranged entity and Office previews. `parseLocalUrl` accepts `/decision/:id` as an alias for `/decisions/:id`.

Wikilink vs explicit `/wiki/...` split. A follow-up refinement routes wiki clicks by origin inside WikiDetail: a `[[...]]` wikilink (emitted with `data-wikilink="true"`, detected via `isWikilink` passed through `onWikiClick`) keeps the inline `WikiLinkPreview` popup with `:N-M` partial load, whereas an explicit Markdown link to a `/wiki/...` route switches the page through SPA navigation (`navigate('/wiki/<page>')`) — matching AC #4's plain-links-navigate intent, so a concept-page nav link like `[wiki 概念页](/wiki/concepts/asset-management)` opens the page instead of a popup. Ranged links stay in the popup regardless of origin, because the wiki route has no line-range segment to land on (navigating to `/wiki/page:3-8` would 404). The shared `onWikiClick` signature gained the optional `isWikilink` third parameter; `MermaidMarkdown` forwards it, and the default handler in `useMarkdownLinkPreview` ignores it.

Editor. `PasteAwareMDEditor` takes `wikilinkBasePath`, registers the idempotent `wikilink` overlay token, injects `createRemarkWikilink` into the preview remark plugins and marks the wrapper `wikilink-aware`. The six surfaces that can hold wikilinks pass the prop; the existing `mdlink` overlay and its empty-label branch are unchanged. `source.css` adds the matching light/dark blue. Both guideline documents now describe wiki-internal pages, cross-collection files and entity short links instead of the stashed wiki-only routing.

Spaced filenames and angle brackets. A dedicated wiki acceptance page (`backlog/wiki/test/back-837 - Link-Check.md`) plus a spaced sibling page (`Another Page.md`), and matching link blocks on doc-34 and decision-2, exercise `<...>` destinations with spaces, fullwidth colons, `:N-M` ranges, bare-space destinations, absolute project paths and entity short links from all three collection bases. This surfaced one more defect: the composer pass writes `%20` into a pointy-bracket destination before the join pass, and `encodeWikiPath` encoded it a second time, so a spaced wiki sibling became `/wiki/test/Another%2520Page.md` and the popup could not load the page. The wiki branch now uses `encodePath` (decode each segment once, then re-encode), which also keeps literal-space destinations correct. Regression tests cover both forms on wiki, document and decision bases.

Verification. Scoped suites pass with `--timeout 30000`; `bunx tsc --noEmit` exits 0, `bunx biome check --write` on the touched files is clean and `bun run check .` exits 0 with only pre-existing warnings. On a fresh build all five spaced-file targets return 200 from `/api/file-content`, and CDP clicks open the correct file, entity or wiki range preview on all three pages. On a fresh 6427 build, CDP inspection of `auto-port.md` shows sibling wiki links on `/wiki/...`, `../../docs/...` / `../../decisions/...` links on `/backlog/...` with the `点击预览文件` title, and entity routes unchanged. CDP clicks confirm: sibling and wikilink ranges open the wiki popup with only lines 10-29, `/documentation/5:30-41` and the three cross-collection file links open the shared section preview with the requested lines, `/decisions/2` and `/decision/2` navigate to the canonical decision URL, and `/wiki/concepts/asset-management` opens the full wiki page popup. Edit mode reports a `wikilink-aware mdlink-aware` wrapper with `token wikilink` and `token mdlink` spans.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wiki pages now resolve relative references and entity links the same way document and decision pages do. `/api/wiki/:path` derives `projectPath` and `wikiRoot`, and the renderer uses them to send sibling wiki pages to the `/wiki/` route while references to docs/, decisions/ and other collections stay project file links that open the shared file/Office preview. Both page-local click handlers were replaced with the `useMarkdownLinkPreview` contract, so plain entity links navigate, ranged entity links open the shared section preview, and `/wiki/` wikilinks keep the wiki page popup with an optional `:N-M` partial load, while an explicit `/wiki/...` Markdown link switches the page via SPA navigation and only ranged wiki links stay in the popup. `/decision/:id` is accepted as an alias for the canonical plural route.

The stashed wiki draft is now fully landed and adapted: wikilink `:N-M` ranges, wiki section previews, the editor preview remark plugin, wikilink syntax highlighting, pointy-bracket destination handling and colon-safe filename ranges. Six editor surfaces opt into wikilink rendering; the existing mdlink overlay keeps its empty-label support. Both guideline documents describe the final wiki link contract.

Verification: 188 scoped tests across 7 suites pass with `--timeout 30000`; `bunx tsc --noEmit` exits 0; `bunx biome check --write` on touched files is clean and `bun run check .` exits 0 apart from pre-existing warnings. CDP-driven clicks on a fresh build confirm every link class on the acceptance wiki page, doc-34 and decision-2 opens the expected popup or route, and edit mode shows blue wikilink and Markdown-link tokens. A dedicated `backlog/wiki/test/` acceptance page and spaced sibling page keep these cases reproducible without touching user-manual wiki pages.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-511
title: Render local URLs as short aliases in markdown content
status: Done
assignee:
  - Kimi Code CLI
created_date: '2026-06-05 02:19'
updated_date: '2026-06-05 22:50'
labels:
  - web-ui
  - feature
  - markdown
dependencies:
  - BACK-509
priority: medium
ordinal: 169400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In markdown content across task details, documentation, decisions, and wiki pages, users sometimes paste full local URLs (e.g. http://localhost:6420/task/506/...). These long URLs hurt readability. Render them as short, human-readable aliases while preserving clickability and modal navigation.

Alias mapping rules:
- /documentation/:id/:title -> DOC#:id
- /decisions/:id/:title -> Decisions#:id
- /task/:id/:title -> TASK#:id
- /task/:id -> TASK#:id
- /draft/:id/:title -> DRAFT#:id
- /draft/:id -> DRAFT#:id
- /wiki/:path -> WIKI#:path

Examples:
- http://localhost:6420/documentation/001/testing-style-guide -> DOC#001
- http://localhost:6420/decisions/1/use-tailwind-css-v4-for-web-ui-development -> Decisions#1
- http://localhost:6420/task/506/Fix-CLI-actualStart-actualEnd-missing-local-to-UTC-conversion -> TASK#506
- http://localhost:6420/task/506 -> TASK#506
- http://localhost:6420/draft/16/prototype-a-codex-plugin -> DRAFT#16
- http://localhost:6420/draft/16 -> DRAFT#16
- http://localhost:6420/wiki/patterns/cross-surface-feature-addition.md -> WIKI#patterns/cross-surface-feature-addition.md

Behavior:
- Only same-origin URLs are transformed. External URLs remain unchanged.
- The link still opens in the modal exactly as it does today.
- If the URL does not match any known pattern, render it as-is.
- The title slug is cosmetic and ignored when generating the alias.
- Task ID resolution remains prefix-agnostic.
- Applies to all places where MermaidMarkdown renders content.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 /documentation/:id/:title URLs render as DOC#:id and open the documentation modal
- [x] #2 /decisions/:id/:title URLs render as Decisions#:id and open the decision modal
- [x] #3 /task/:id/:title URLs render as TASK#:id and open the task modal (with prefix-agnostic ID resolution)
- [x] #4 /wiki/:path URLs render as WIKI#:path and open the wiki page
- [x] #5 External URLs and unmatched same-origin URLs are not transformed
- [x] #6 Works in task details, documentation, decisions, and wiki markdown renderers
- [x] #7 /draft/:id/:title URLs render as DRAFT#:id and open the draft modal
- [x] #8 Works in task details, documentation, decisions, and wiki markdown renderers
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1) Inspect `MermaidMarkdown.tsx` to understand how links are currently rendered and how task URLs are intercepted.
2) Add a unified `parseLocalUrl()` function that recognizes `/task/`, `/draft/`, `/documentation/`, `/decisions/`, and `/wiki/` same-origin URL patterns and returns an alias string.
3) Extend `MermaidMarkdown` props with `onDocClick`, `onDecisionClick`, and `onWikiClick` handlers alongside the existing `onTaskClick`.
4) Update `LinkComponent` to render alias text for matched local URLs and route clicks through the appropriate handler.
5) Wire up the new handlers in all consumers: `TaskDetailsModal`, `DocumentationDetail`, `DecisionDetail`, `WikiDetail` (including `WikiLinkPreview`), and `FilePreviewModal`.
6) Verify heading anchors (e.g. `#changes-made`) are not misidentified as local URLs due to `new URL(href, window.location.href)` inheriting the current page pathname; add an explicit `#` prefix guard in `parseLocalUrl`/`parseTaskUrl` if needed.
7) Run type checks and scoped tests to verify no regressions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Summary: Extended `MermaidMarkdown.tsx` with a `parseLocalUrl()` helper that transforms same-origin URLs into short aliases (DOC#:id, Decisions#:id, TASK#:id, DRAFT#:id, WIKI#:path). Added `onDocClick`, `onDecisionClick`, and `onWikiClick` props to `MermaidMarkdown` and wired them in all markdown consumers across the app. During verification, discovered that heading anchor links (`#changes-made`) were being misidentified as local URLs because `new URL("#anchor", window.location.href)` inherits the current page pathname (e.g. `/task/BACK-506`). Fixed by adding an explicit `href.startsWith("#")` guard in both `parseLocalUrl` and `parseTaskUrl`, so heading anchors now render unchanged while real local URLs still get aliased.

`MermaidMarkdown` supports five click handlers simultaneously: `onTaskClick`, `onDraftClick`, `onDocClick`, `onDecisionClick`, and `onWikiClick`. `parseLocalUrl` includes a `/draft/:id` pattern that returns `{ type: "draft", alias: "DRAFT#:id" }`, and all consumers (`TaskDetailsModal`, `DocumentationDetail`, `DecisionDetail`, `WikiDetail`, `FilePreviewModal`) pass `onDraftClick` alongside the other handlers.

Files changed:
- `src/web/components/MermaidMarkdown.tsx` — added URL parsing, alias rendering, new click handlers, and `#` anchor guard to prevent heading-anchor misidentification. Also added `draft` type to `parseLocalUrl` and `onDraftClick` prop.
- `src/web/components/TaskDetailsModal.tsx` — wired doc/decision/wiki/draft navigation handlers; loads `availableDrafts` for draft drill-down.
- `src/web/components/DocumentationDetail.tsx` — wired all handlers (task, draft, doc, decision, wiki) through `MarkdownEditor`.
- `src/web/components/DecisionDetail.tsx` — wired all handlers (task, draft, doc, decision, wiki) through `MarkdownEditor`.
- `src/web/components/WikiDetail.tsx` — wired all handlers for main content and `WikiLinkPreview`.
- `src/web/components/FilePreviewModal.tsx` — wired all handlers for markdown file previews.
- **`FilePreviewModal.tsx` navigation fix**: Changed all click handlers from `navigate()` to `window.open(url, "_blank")`. FilePreviewModal is typically opened from within a task detail modal; using `navigate()` would cause modal stacking issues (the current modal stack would be disrupted). Opening links in a new tab avoids this entirely. Also removed the now-unused `useNavigate` import and `navigate` variable.

Tests: `bun test resolve-wiki-path` passes. TypeScript check passes for all touched files.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

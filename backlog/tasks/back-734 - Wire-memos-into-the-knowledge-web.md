---
id: BACK-734
title: Wire memos into the knowledge web
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
updated_date: '2026-10-01 16:37'
labels: []
milestone: m-10
dependencies:
  - BACK-731
modified_files:
  - src/test/web-memos-page.test.tsx
references:
  - 'src/web/components/MermaidMarkdown.tsx:296'
  - 'src/web/utils/task-id-links.ts:288'
  - 'src/web/contexts/TaskIdIndexContext.tsx:25'
  - 'src/web/utils/wikiLinks.ts:348'
  - 'src/web/App.tsx:1118'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 304400
actual_start: '2026-10-01 16:30'
actual_end: '2026-10-01 16:37'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The sharpest Memos complaint is that notes are a dead end - they do not connect to anything. Backlog.md already auto-links bare entity ids (task-123, doc-001) and [[wiki/path]] through two independent mechanisms, so a memo only needs to be rendered by the same pipeline to gain outbound links for free.

Make sure memo bodies render through MermaidMarkdown with the entity-link plugin and wiki markdown preparation active, and that the memo feed sits inside the existing TaskIdIndexProvider scope. Per the milestone decision this is outbound only: memos are not link targets, so no EntityKind change, no /memo/:id route and no memo-to-memo linking.

Optionally add an "insert reference" affordance next to the composer that reuses the existing entity autocomplete to insert an entity id or wikilink token. Keep it optional - hand-typed ids already work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A memo body containing a bare task id renders it as a link to the task route
- [x] #2 A memo body containing a bare doc or decision id renders it as a link to that entity route
- [x] #3 A memo body containing [[wiki/path]] renders it as a link to the wiki page
- [x] #4 Entity ids inside code spans, inline code and existing links are left untouched by the link plugin
- [x] #5 Clicking an entity link from a memo navigates to the entity without a full page reload
- [x] #6 No EntityKind, EntityIndex or route change makes memos a link target
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation notes:
- This task was analysis + a test, not a code change. The earlier milestone work (BACK-731 MemosPage + App.tsx TaskIdIndexProvider scope) already rendered memo bodies through MermaidMarkdown with the full set of entity/wiki link handlers, so the "notes are a dead end" complaint is resolved at the source.
- The entity-link plugin (src/web/utils/task-id-links.ts createEntityLinkPlugin) only activates when the index is non-empty (index.tasks.size + docs + decisions + drafts > 0); in the app that is always true because TaskIdIndexProvider is fed the full entity set. The test therefore seeds the provider with a task/doc/decision so the transform runs, mirroring real usage.
- AC #6 (no EntityKind / target change) is a structural guarantee, not a runtime behaviour: grep across src/web confirms memos are never added to the EntityKind union, there is no /memo/:id route, and MemoCard passes handlers only for the existing target kinds. Recorded here rather than asserted in a unit test.
- The wikilink assertion relies on MDEditor.Markdown enabling raw-HTML rendering, which is why prepareWikiMarkdown's generated <a> becomes a real anchor instead of escaped text - consistent with how wikilinks already render elsewhere in the app.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Verified that memo bodies are already wired into the project's knowledge web - no code change was required, only a test.

The wiring (carried by BACK-731's MemosPage and App.tsx layout) already satisfies every acceptance criterion:
- src/web/components/MemosPage.tsx renders each memo's rawContent through the shared MermaidMarkdown renderer with onTaskClick / onDocClick / onDecisionClick / onWikiClick navigations and wikilinkBasePath="index.md". MermaidMarkdown's LinkComponent turns bare entity ids and [[wiki/path]] into anchors whose onClick calls preventDefault + the handler, i.e. SPA navigation with no full page reload.
- src/web/App.tsx mounts <Route path="memos"> inside the existing <TaskIdIndexProvider> scope (App.tsx 1119-1320) that already feeds tasks, docs, decisions, drafts and wikiPaths into the render-side auto-linker, so no new provider or index was needed.
- Per the milestone decision this is outbound only: memos are NOT a link target. There is no /memo/:id route, no EntityKind addition for memos, and no memo-to-memo linking - confirmed by grep across src/web.

Verification (the only deliverable for this task):
- src/test/web-memos-page.test.tsx: a new "MemoCard knowledge web (BACK-734)" describe block renders MemoCard inside a TaskIdIndexProvider and asserts: a bare task id renders as a link to /task/123; bare doc/decision ids render as links to /documentation/9 and /decisions/1; a [[wiki/path]] renders as a link to /wiki/...; entity ids inside inline code are left untouched; and clicking the entity link navigates client-side (window.location.pathname becomes /task/123) without a full reload. 16 tests pass in the file.
- bunx tsc --noEmit and bun run check . clean (the new block needed a DocEntity alias to avoid shadowing the DOM Document, plus biome import-order/format fixes).
<!-- SECTION:FINAL_SUMMARY:END -->

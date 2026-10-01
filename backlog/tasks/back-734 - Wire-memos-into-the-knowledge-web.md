---
id: BACK-734
title: Wire memos into the knowledge web
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
labels: []
milestone: m-10
dependencies:
  - BACK-731
references:
  - 'src/web/components/MermaidMarkdown.tsx:296'
  - 'src/web/utils/task-id-links.ts:288'
  - 'src/web/contexts/TaskIdIndexContext.tsx:25'
  - 'src/web/utils/wikiLinks.ts:348'
  - 'src/web/App.tsx:1118'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 304400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The sharpest Memos complaint is that notes are a dead end - they do not connect to anything. Backlog.md already auto-links bare entity ids (task-123, doc-001) and [[wiki/path]] through two independent mechanisms, so a memo only needs to be rendered by the same pipeline to gain outbound links for free.

Make sure memo bodies render through MermaidMarkdown with the entity-link plugin and wiki markdown preparation active, and that the memo feed sits inside the existing TaskIdIndexProvider scope. Per the milestone decision this is outbound only: memos are not link targets, so no EntityKind change, no /memo/:id route and no memo-to-memo linking.

Optionally add an "insert reference" affordance next to the composer that reuses the existing entity autocomplete to insert an entity id or wikilink token. Keep it optional - hand-typed ids already work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A memo body containing a bare task id renders it as a link to the task route
- [ ] #2 A memo body containing a bare doc or decision id renders it as a link to that entity route
- [ ] #3 A memo body containing [[wiki/path]] renders it as a link to the wiki page
- [ ] #4 Entity ids inside code spans, inline code and existing links are left untouched by the link plugin
- [ ] #5 Clicking an entity link from a memo navigates to the entity without a full page reload
- [ ] #6 No EntityKind, EntityIndex or route change makes memos a link target
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 bunx tsc --noEmit passes
- [ ] #5 bun run check . passes on touched files
- [ ] #6 Browser smoke check confirms task, doc and wiki links resolve from a memo card
<!-- DOD:END -->

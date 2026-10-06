---
id: BACK-239
title: 'Feature: Auto-link tasks to documents/decisions + backlinks'
status: Done
assignee:
  - '@codex'
created_date: '2025-08-17 16:54'
updated_date: '2026-10-06 15:54'
labels:
  - web
  - docs
dependencies: []
modified_files:
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/mcp/overview.md
priority: medium
ordinal: 0
actual_start: '2026-10-06 15:40'
actual_end: '2026-10-06 15:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add first-class linking between tasks and documents/decisions (from issue #271).

Goal:
- Let users reference documents/decisions directly in task content (e.g., "Documented in doc-12/13" or "See decision-1").
- In the web UI, references render as clickable links to the target doc/decision.
- On a document/decision page, show a "Referenced by" list of tasks that mention it (computed dynamically; no file mutation).

Scope (MVP):
- Recognize references in task body using simple, unambiguous patterns: `doc-<id>` and `decision-<id>` (optionally prefixed with `#`).
- Don't render links inside code blocks.
- No rich previews; plain links with title when available.
- Backlinks computed client-side (or server-side) by scanning tasks for references; do not write backlinks into files.

Notes:
- Extend later to support linking from docs -> tasks, and to other entities if needed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Web: task detail/body renders doc-<id> and decision-<id> as links to their pages; not inside code blocks
- [x] #2 Web: document/decision pages show a Referenced by list of tasks that mention the ID
- [x] #3 Support patterns: `doc-<n>`, `decision-<n>`, with or without a leading `#` (e.g., #doc-1)
- [x] #4 No file mutation for backlinks; computed at render time
- [x] #5 Add short docs: how to reference docs/decisions from tasks (examples)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
- Deliver the feature through three child workstreams: BACK-614 for web auto-linking of `doc-<id>` / `decision-<id>` in task bodies plus the input-side insert-link hint, BACK-751 for id ranges and slash-lists as a clickable dropdown selector, and BACK-753 for the reverse direction (the client-side "Referenced by" index and list on document and decision pages).
- Keep backlinks computed at render time from the tasks already in memory — no file mutation — and share one scan path (`scanEntityReferences`) between the task body and the `documentation:` field so the link renderer and the backlink scanner stay in lockstep.
- Close the parent by verifying the children's acceptance criteria, recording the decision to drop AC#4 (titles surface in the clickable dropdown instead of the link text), and documenting the referencing syntax in both usage guides.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delivered through three child tasks, all Done: BACK-614 (auto-link `doc-<id>` / `decision-<id>` in web markdown, plus the input-side insert-link hint), BACK-751 (id ranges and slash-lists as a clickable dropdown selector), and BACK-753 (the reverse direction — the "Referenced by" list on document and decision pages). This parent task itself only needed the closing bookkeeping.

Scope decisions:
- AC#4 ("links include the target title") was dropped by decision (see BACK-753): auto-linked references show the bare id, and each target's title is surfaced by the range/backlink dropdown instead. The criterion was removed from this task.
- The docs criterion is satisfied by a new "Referencing Tasks and Docs in Content" subsection added to both usage guides (`src/guidelines/cli-instructions/overview.md` and `src/guidelines/mcp/overview.md`), covering single ids, slash-list ids, and ranges for tasks and documents.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Done. Web auto-linking of `doc-<id>` / `decision-<id>` in task bodies (BACK-614), range/slash-list dropdowns (BACK-751), and the "Referenced by" backlink list on document and decision pages (BACK-753) together fulfil the feature.

The original AC#4 ("links include the target title") was dropped by decision; titles are surfaced by the clickable dropdown instead. The referencing syntax — single ids, slash-lists and ranges — is now documented for both agent surfaces in the CLI and MCP overview guides.
<!-- SECTION:FINAL_SUMMARY:END -->

## Files Changed
- `src/guidelines/cli-instructions/overview.md` — new "Referencing Tasks and Docs in Content" subsection under the references area, documenting single ids, slash-list ids, and ranges for tasks and documents.
- `src/guidelines/mcp/overview.md` — the same subsection, added to the MCP usage guide so both agent surfaces stay in parallel.

The implementation itself landed in the child tasks: BACK-614 (`src/web/utils/task-id-links.ts`, `src/web/contexts/TaskIdIndexContext.tsx`, `MermaidMarkdown`, `DependencyInput`), BACK-751 (`EntityIdRangeDropdown.tsx` and the multi-id token parser), and BACK-753 (`src/web/utils/backlinks.ts`, `BacklinkList.tsx`, `DocumentationDetail.tsx`, `DecisionDetail.tsx`, locales).

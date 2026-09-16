---
id: BACK-640
title: >-
  Fix Mermaid diagrams not rendering: fence case, app theme, and editor preview
  panes
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-15 22:01'
updated_date: '2026-09-15 22:09'
labels:
  - web-ui
dependencies: []
references:
  - src/web/utils/mermaid.ts
  - src/web/components/MermaidDiagram.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/PasteAwareMDEditor.tsx
  - backlog/docs/doc-17
modified_files:
  - src/web/utils/mermaid.ts
  - src/web/components/MermaidDiagram.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/PasteAwareMDEditor.tsx
  - src/web/contexts/ThemeContext.tsx
  - src/test/mermaid.test.ts
  - src/test/mermaid-markdown.test.tsx
  - src/test/mermaid-preview.test.tsx
priority: medium
ordinal: 241400
actual_start: '2026-09-15 20:30'
actual_end: '2026-09-15 21:57'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mermaid fenced code blocks failed to render in three independent ways, all in the same web rendering pipeline. Reported against doc-17, where the diagram never appeared at all.

1. Case-sensitive fence match (the reported symptom). renderMermaidIn located blocks with the CSS selector "pre > code.language-mermaid". The fence info string is carried over verbatim, so a fence labelled `Mermaid` produces class="language-Mermaid", and class selectors are case-sensitive in standards mode. Zero blocks matched, so the function returned before loading mermaid and the page kept a plain code block. Matching now walks classList with a lowercase comparison, so mermaid / Mermaid / MERMAID all render.

2. Diagrams ignored the app color mode. Mermaid was initialized once with theme "default", so dark-mode pages got a light diagram on a dark background. renderMermaidIn now accepts { mode } and maps light to mermaid "default" and dark to mermaid "dark". Re-initialization is keyed on the mode, because mermaid keeps its configuration globally rather than per render.

3. The Markdown editor panes never rendered diagrams. The editor Live code and Preview code panes render markdown themselves and do not go through MermaidMarkdown, so fenced mermaid blocks stayed raw code there. The editor now receives a previewOptions.components.pre override (MermaidAwarePre) that swaps a mermaid block for a MermaidDiagram element. The same preview-only pane also collapsed to a ~20px strip because MDEditor sizes itself with height:100% while the surrounding wrapper div was an auto-height block; the wrapper is now h-full.

Scope is web UI only. No CLI, MCP, or config contract changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A fenced block whose info string is Mermaid or MERMAID renders as a diagram, same as mermaid
- [x] #2 The documentation and decision read view renders diagrams with mermaid default theme in light mode and dark theme in dark mode
- [x] #3 The Markdown editor Live code and Preview code panes render fenced mermaid blocks as diagrams
- [x] #4 The preview-only pane keeps its definite height instead of collapsing to a thin strip
- [x] #5 Non-mermaid fenced code blocks keep rendering as plain code blocks everywhere
- [x] #6 bun test on mermaid.test.ts, mermaid-markdown.test.tsx and mermaid-preview.test.tsx passes, and bunx tsc --noEmit passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce with a real render: mount MermaidMarkdown in JSDOM with the doc-17 source and print the class name of the resulting code element. Confirmed class="language-Mermaid code-highlight" with a lowercase selector matching 0 nodes.
2. Replace the CSS selector in renderMermaidIn with a classList walk that compares lowercased class names, exported as hasMermaidLanguageClass so both render paths share one predicate.
3. Thread the app color mode into mermaid: RenderMermaidOptions.mode, MERMAID_THEME_BY_MODE mapping (light to default, dark to dark), and mode-keyed re-initialization. MermaidMarkdown reads the mode from useOptionalTheme and passes it to renderMermaidIn.
4. Give MermaidMarkdown a stable re-render on theme switch: key the MDEditor.Markdown subtree on the mode, because renderMermaidIn replaces React-owned pre nodes with its own containers.
5. Extract the React render path into src/web/components/MermaidDiagram.tsx (MermaidDiagram plus MermaidAwarePre) and inject the pre override through PasteAwareMDEditor previewOptions so the editor panes render diagrams without touching every call site.
6. Fix the collapsed preview-only pane by making the editor wrapper h-full, so the height:100% chain has a definite height to resolve against.
7. Extend tests: case-insensitive fence matching, non-mermaid fences untouched, theme mapping and mode-keyed re-init in mermaid.test.ts; a new mermaid-preview.test.tsx covering MermaidAwarePre for mermaid and non-mermaid fences.
8. Verify: bunx tsc --noEmit, scoped bun test runs, and a headless-browser pass over both themes on the read view and all three editor panes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two render entry points now exist on purpose and share renderDiagram: renderMermaidIn replaces the pre element inside a DOM the caller does not own (MermaidMarkdown), while renderMermaidDiagram fills a container React owns (MermaidDiagram). The React path leaves the container empty so React never reconciles children it did not create.

The casing problem is structural rather than a one-off misspelling: the markdown pipeline passes the fence info string through verbatim into the class name, so whatever casing the author types reaches the DOM. Matching stays case-insensitive instead of assuming one canonical spelling.

The editor wrapper fix is the non-obvious part of item 3: MDEditor sizes itself with height:100%, so an auto-height wrapper collapses the preview-only pane. Edit and Live code modes hide it because the textarea supplies a height, which is why only Preview code looked broken.

Verification caveat: the web bundle is built when the server starts, so every front-end check needs a backlog browser restart first; a reused Chrome profile also caches the old bundle.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Whole-pipeline fix, no follow-up work outstanding.

Root cause of the report: the mermaid lookup used a case-sensitive CSS class selector, so a fence labelled Mermaid was never recognised and the function exited before loading mermaid at all. Matching is now class-case-insensitive.

Beyond the report, two gaps in the same pipeline are closed: diagrams follow the app color mode, and the Markdown editor Live code and Preview code panes now render diagrams instead of raw code. The preview-only pane also regains its full height.

Files: src/web/utils/mermaid.ts, src/web/components/MermaidDiagram.tsx (new), src/web/components/MermaidMarkdown.tsx, src/web/components/PasteAwareMDEditor.tsx, src/web/contexts/ThemeContext.tsx, plus src/test/mermaid.test.ts, src/test/mermaid-preview.test.tsx (new) and src/test/mermaid-markdown.test.tsx.

Verified with bunx tsc --noEmit plus the three scoped test files, and confirmed in a real browser on both themes across the read view and all three editor panes. Non-mermaid fenced blocks are covered by regression tests and still render as plain code.
<!-- SECTION:FINAL_SUMMARY:END -->

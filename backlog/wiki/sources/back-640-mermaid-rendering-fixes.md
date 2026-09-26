---
title: BACK-640 Fix Mermaid diagrams not rendering (fence case, app theme, editor preview panes)
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - mermaid
  - markdown
source_path: backlog/tasks/back-640 - Fix-Mermaid-diagrams-not-rendering-fence-case-app-theme-and-editor-preview-panes.md
---

# BACK-640 Fix Mermaid diagrams not rendering: fence case, app theme, and editor preview panes

Mermaid fenced blocks failed in three independent ways in the same web rendering pipeline, reported against doc-17 where a diagram never appeared at all: a case-sensitive class selector missed `Mermaid` fences, diagrams ignored the app color mode, and the markdown editor's Live/Preview panes never rendered diagrams at all.

## Summary

- Case fix: `renderMermaidIn` located blocks with the CSS selector `pre > code.language-mermaid`, but the pipeline passes the fence info string verbatim into the class name and class selectors are case-sensitive — a `Mermaid` fence matched zero nodes and the function returned before loading mermaid; matching now walks `classList` with a lowercase comparison, exported as `hasMermaidLanguageClass` shared by both render paths
- Theme fix: mermaid was initialized once with theme `default`; `renderMermaidIn` now accepts `{ mode }` with `MERMAID_THEME_BY_MODE` (light → default, dark → dark) and mode-keyed re-initialization because mermaid keeps configuration globally; MermaidMarkdown keys its `MDEditor.Markdown` subtree on the mode for a stable re-render on theme switch
- Editor fix: the editor panes render markdown themselves without going through MermaidMarkdown; a `previewOptions.components.pre` override (`MermaidAwarePre`, in new `MermaidDiagram.tsx`) swaps mermaid blocks for `MermaidDiagram` elements without touching every call site
- Two render entry points exist on purpose and share `renderDiagram`: `renderMermaidIn` replaces `pre` nodes in a DOM the caller doesn't own, while `MermaidDiagram` fills a React-owned container left empty so React never reconciles children it didn't create
- Preview-only pane collapsed to a ~20px strip because MDEditor sizes with `height:100%` against an auto-height wrapper; the wrapper is now `h-full` (Edit/Live modes masked this because the textarea supplies a height)
- Verification caveat recorded: the web bundle is built at server start, so front-end checks need a server restart, and a reused Chrome profile caches the old bundle
- Tests: extended `mermaid.test.ts` (case-insensitive matching, theme mapping, mode-keyed re-init), new `mermaid-preview.test.tsx`; confirmed in a real browser on both themes across the read view and all three editor panes

## Acceptance Criteria

- `Mermaid`/`MERMAID` fences render as diagrams, same as `mermaid`; non-mermaid fences stay plain code everywhere
- Read views render diagrams with the mermaid theme matching the app color mode
- Editor Live code and Preview code panes render diagrams, and the preview-only pane keeps its definite height

## Related Concepts

- [[concepts/markdown-pipeline]] — fence info string flowing verbatim into class names
- [[concepts/web-ui-features]] — MermaidMarkdown renderer and editor preview surfaces
- [[concepts/tui-theme-adaptive]] — sibling theme-awareness work (TUI side)

## Related Sources

- [[sources/back-611-mermaid-anchor-href-pathname-prefix]] — earlier mermaid link fix in the same pipeline
- [[sources/back-626-dependabot-mermaid-bump]] — mermaid dependency version context

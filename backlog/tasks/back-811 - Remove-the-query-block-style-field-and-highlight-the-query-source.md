---
id: BACK-811
title: Remove the query block style field and highlight the query source
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-17 15:58'
updated_date: '2026-10-17 16:40'
labels:
  - web-ui
  - docs
dependencies:
  - BACK-805
modified_files:
  - README.md
  - README.en.md
  - src/sqlite/block.ts
  - src/web/components/SqlQueryBlock.tsx
  - src/web/components/CypherQueryBlock.tsx
  - src/web/utils/code-highlight.tsx
  - src/test/graph-block.test.ts
  - src/test/sqlite-query-block.test.tsx
  - src/test/cypher-query-block.test.tsx
  - src/test/web-code-highlight.test.tsx
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/mcp/documents.md
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-agent-nudge.md
ordinal: 373001
actual_start: '2026-10-17 16:05'
actual_end: '2026-10-17 16:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-805 shipped the `style` field (compact / striped / borderless presets) for all three query-block engines. Verification on 2026-10-17 found the presets cannot take effect in the Web UI: the preview's GitHub markdown CSS (`@uiw/react-markdown-preview/markdown.css`, imported unlayered in `src/web/styles/source.css`) outranks every layered Tailwind utility on the same elements, so `.wmde-markdown table th/td { border; padding }`, the `tr` background / border-top rules and the `tr:nth-child(2n)` zebra defeat the block's classes in the table view, and `borderless` has nothing left to remove. jsdom tests assert class names, not the cascade, so they passed while the pixels did not. User decision (2026-10-17): drop the field instead of fixing the cascade - no deep dive.

Riding along in the same commit: the `cypher-query` documentation the reading view's blocks had grown without (readme pair, the documents guides' Cypher section, the overview and nudge pointer lines). It was written against the blocks this milestone shipped and had no task of its own, so it is recorded here rather than left uncommitted.

Same decision, same task: bring the reading view's own code highlighting into the query block. A fenced code block inside a task body is coloured by `rehype-prism-plus` (the refractor build `@uiw/react-md-editor` ships) before `MermaidMarkdown` renders it, but a `*-query` fence is intercepted and rendered as a result block, so its 显示查询 panel showed the statement as one flat run of text. Tokenizing it with the same grammar - `sql` for the SQL explorers, `cypher` for the graph one - makes the panel read like the code it is, with the theme's own `--color-prettylights-syntax-*` colours.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `style` is no longer a known block field; a block carrying it fails closed with the unknown-field error that lists the remaining fields, on all three grammars
- [x] #2 SqlQueryBlock renders one fixed look - no compact/striped/borderless branches - and a block without the field renders exactly as before
- [x] #3 The BACK-805 style tests are replaced by regression tests pinning the rejection on both grammars and the surviving default look
- [x] #4 The CLI and MCP documents guides no longer document the field (SQL table and the Cypher table)
- [x] #5 The 显示查询 panel paints the statement with the reading view's own code tokens: same `.token.*` spans a fenced block gets, `language-sql` / `language-cypher` on the code element
- [x] #6 The cypher engine picks the `cypher` grammar, the SQL engines `sql`, and an unknown grammar or a block that will not parse falls back to plain text instead of blanking the panel
- [x] #7 bunx tsc --noEmit, biome on touched files, and the four query-block test files pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Parser (src/sqlite/block.ts): drop QueryBlockStyle, the `style` field, KNOWN_STYLES and the parse branch; the unknown-field error covers the removed name and lists what is left.
2. Component (src/web/components/SqlQueryBlock.tsx): delete the preset flags and every conditional branch; keep the default look (frame, header rule, row rules except the last row, `py-1`, `text-sm`, `p-3`).
3. CypherQueryBlock.tsx: drop the BACK-805 sentence from the doc comment and declare `highlightLanguage: "cypher"`.
4. New util src/web/utils/code-highlight.tsx: `highlightCode(source, language)` runs the same refractor instance the markdown preview uses and converts the tree with hast-util-to-jsx-runtime, returning the plain source when the grammar is unknown or the tokenizer throws.
5. SqlQueryBlock: memoize the highlighted statement per engine grammar and render it inside `<pre><code class="language-*">` in the 显示查询 panel, so `markdown.css`'s `.token.*` rules colour it.
6. Tests: replace the BACK-805 describes in graph-block / cypher-query-block / sqlite-query-block with rejection plus default-look regressions; add the highlight assertions (tokens present, statement still whole, broken block falls back) and a new src/test/web-code-highlight.test.tsx for the util.
7. Docs: remove the `style` row from both guides' SQL field tables and from the Cypher field table.
8. Verify: bunx tsc --noEmit, biome on touched files, scoped bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The removal is deliberately fail-closed rather than lenient. `view` and `refresh` reject unknown values; `style` used to drop them. Leaving it lenient after removal would mean a block carrying `style: compact` silently renders as the default look with no signal, so the parser now rejects it and the error names the fields that remain (`source / sql / view / refresh / copy_to`) - an agent or a reader editing the block sees immediately that the field is gone.

The highlighter reuses refractor's `all` build, not `core` with two grammars registered: `all` is the instance `@uiw/react-md-editor` already bundles and the one `registerTopicHighlight` patches, so the tokens a query block emits are byte-identical to what a ` ```sql ` fence in the same document produces. Colour is left entirely to `markdown.css` (`.wmde-markdown .token.*` → `--color-prettylights-syntax-*`), which means the panel follows the light/dark theme of whatever hosts it with no per-theme code here.

Dev-server caveat carried over from BACK-805: the bun-plugin-tailwind serve path drops candidates containing `:` or `.`, which is why the surviving chrome uses bare utilities only. It does not affect this work - the token rules come from a plain stylesheet, and they were confirmed served with real declarations (`.token.keyword{color:var(--color-prettylights-syntax-keyword)}`, `#cf222e` light / `#ff7b72` dark).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reverted the BACK-805 query-block style field end to end and put the reading view's own code highlighting into the block's 显示查询 panel.

**Removal** - `src/sqlite/block.ts` drops `QueryBlockStyle`, the `style` field, `KNOWN_STYLES` and the parse branch, so a block carrying `style` now fails closed with the unknown-field error (which lists the remaining fields) on the SQL, DuckDB and Cypher grammars alike. `SqlQueryBlock.tsx` loses every preset branch and renders one fixed look - framed, `text-sm`, `py-1` cells, a rule line on every row but the last - which is exactly what a block without the field rendered before. The `style` rows are gone from both agent guides' SQL and Cypher field tables; the readmes never documented the field.

**Highlighting** - new `src/web/utils/code-highlight.tsx` tokenizes a snippet with the same refractor instance the markdown preview colours fenced blocks with (`all`, the one `@uiw/react-md-editor` ships) and converts the tree through `hast-util-to-jsx-runtime`; unknown grammar or a tokenizer throw returns the plain source. `SqlQueryBlock` memoizes the statement per engine grammar (`highlightLanguage`: `cypher` for the graph engine, `sql` for the two SQL ones) and renders it in `<pre><code class="language-*">`, so `markdown.css`'s `.token.*` rules - and the theme's `--color-prettylights-syntax-*` variables - colour it like any code block in a task body.

**Documentation riding along** - the readme pair, the two documents guides, the CLI overview pointer and the agent nudge now describe `cypher-query` next to the SQL blocks (`query` field, `source` as a registry name, `view: graph`, `refresh: auto`, the 500-row cap). They were written for the blocks this milestone shipped and had no task of their own, so they are recorded on this one.

**Tests** - BACK-805's style describes are replaced by rejection and default-look regressions (graph-block, sqlite-query-block, cypher-query-block), the cypher suite gains two highlight cases (tokens present and the statement still whole; a broken block falls back to plain text), and a new `web-code-highlight.test.tsx` covers the util. `bunx tsc --noEmit` clean, biome clean on touched files, 52/52 in the four query-block suites plus 29/29 in the guidelines suites and 128/128 across the markdown-renderer and web-page suites.
<!-- SECTION:FINAL_SUMMARY:END -->

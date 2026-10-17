---
id: BACK-805
title: 'Query block style field: three presets backfilled to SQL blocks'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-16 15:44'
updated_date: '2026-10-17 15:04'
labels:
  - web-ui
  - docs
milestone: m-15
dependencies:
  - BACK-802
references:
  - 'src/web/components/SqlQueryBlock.tsx:119-125'
documentation:
  - backlog/docs/PRDS/cypher/doc-27 - Cypher-Live-Query：只读图查询块与可配置样式.md
modified_files:
  - src/sqlite/block.ts
  - src/web/components/SqlQueryBlock.tsx
  - src/web/components/CypherQueryBlock.tsx
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/mcp/documents.md
  - src/test/graph-block.test.ts
  - src/test/cypher-query-block.test.tsx
  - src/test/sqlite-query-block.test.tsx
ordinal: 367001
actual_start: '2026-10-16 23:58'
actual_end: '2026-10-17 00:09'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
SQL block styling is currently hardcoded Tailwind with no per-block control. This task introduces the style field as the start of generalization: compact/striped/borderless presets implemented as modifier classes on the QueryBlock root, backfilled to sqlite-query and duckdb-query so styling becomes a shared capability rather than a Cypher-only feature. Design basis: doc-27 section 8.3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 style accepts compact/striped/borderless and multi-value combos (e.g. style: compact striped) across table/list/value views
- [x] #2 Implemented as modifier classes on the QueryBlock root mapped to existing Tailwind utility combos; no CSS-in-JS, no new theme files
- [x] #3 sqlite-query and duckdb-query blocks accept style with identical effect
- [x] #4 Invalid style values are ignored and fall back to the global default without render errors; arbitrary CSS is not exposed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Block parsing: add the style field to parseQueryBlock (space-separated multi-value); ignore invalid values and fall back to the default.
2. QueryBlock root modifier classes: compact (tighter row height/font size), striped (zebra rows), borderless (no borders), mapped to existing Tailwind combos; ignore when the view does not apply (graph).
3. All three thin shells (sqlite/duckdb/cypher) inherit the capability with zero changes; verify identical behavior across engines.
4. Docs: document the style field in the Live SQL Query Blocks section of instructions documents and in doc-27.
5. Acceptance: bunx tsc --noEmit, bun run check ., related tests green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. parseQueryBlock: new QueryBlockStyle type (compact|striped|borderless), style field in knownFields, space-separated multi-value with lowercase + dedupe; invalid tokens silently dropped (decorative field, unlike fail-closed view/refresh), all-invalid means no style key. KNOWN_STYLES lives in the shared parser so all three engines accept style with zero thin-shell changes. SqlQueryBlock maps style to conditional Tailwind utility combos (compact: text-sm->text-xs, p-3->p-2, py-1->py-0.5; striped: odd:bg-gray-50 dark:odd:bg-gray-800/40 on table/list rows; borderless: strips root border and separator borders), all with dark: variants; view=graph ignores style entirely; default (no style) renders byte-identical classes to before. list-view striped rows gained rounded px-2 py-1 padding (part of the preset, not a default change). Docs: style row added to the Live SQL Query Blocks field tables in src/guidelines/cli-instructions/documents.md and src/guidelines/mcp/documents.md. Tests: +6 parsing (graph-block), +7 rendering (cypher-query-block), +2 SQL backfill rendering (sqlite-query-block); 213 pass across 9 files; fixed a Biome noArrayIndexKey suppression broken by JSX line splitting.

Follow-up fix (amended into the BACK-805 commit): the presets now use bare utility classes plus JS row-parity/last-row conditions instead of odd:/last: variants and py-0.5.
Root cause: bun-plugin-tailwind@0.1.2's dev-server path (bunfig [serve.static]) silently drops every Tailwind candidate containing ':' or '.', so variant classes and fractional values had no rules in 'bun run src/cli.ts browser' while production Bun.build was unaffected. Verified against the served chunk CSS (.bg-blue-50 and .py-0 rules present).
Known limitation: dark: variants remain broken app-wide in dev-server mode (plugin bug, already sunset); production builds render them correctly.

Update: the dark: twin of the zebra tint (dark:bg-blue-950/40) was dropped - the requirement was removed since bun-plugin-tailwind's dev-server path cannot emit variant rules at all, and chasing the plugin was deemed out of scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Query blocks (sqlite/duckdb/cypher) now accept a style field with compact/striped/borderless presets, combinable and silently ignoring invalid values. Implemented in the shared parser and QueryBlock core as conditional Tailwind classes - no CSS-in-JS, no theme files, default rendering byte-identical. 213 related tests green; tsc and biome clean. Milestone m-15 complete.
<!-- SECTION:FINAL_SUMMARY:END -->

---
id: BACK-611
title: >-
  Sync MermaidMarkdown heading anchor href assertions with pathname-prefixed
  hash links
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 07:54'
updated_date: '2026-09-06 08:11'
labels: []
dependencies: []
references:
  - src/test/mermaid-markdown.test.tsx
  - src/web/components/MermaidMarkdown.tsx
modified_files:
  - src/test/mermaid-markdown.test.tsx
ordinal: 216400
actual_start: '2026-09-06 07:54'
actual_end: '2026-09-06 08:11'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-536 changed in-document hash links so anchor hrefs include the current pathname and search (e.g. '/#11-section-title' instead of '#11-section-title') to fix in-document navigation. The three github-slugger heading tests in src/test/mermaid-markdown.test.tsx still assert the bare '#...' href and now fail deterministically. Update those assertions to expect the pathname-prefixed href produced under the test JSDOM origin (http://localhost → '/#...'). Do not revert the component behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The three heading github-slugger tests expect '/#...' hrefs
- [x] #2 bun test src/test/mermaid-markdown.test.tsx passes
- [x] #3 bunx tsc --noEmit and bun run check pass on touched files
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update the three github-slugger heading tests in src/test/mermaid-markdown.test.tsx to expect pathname-prefixed hrefs (/#...) matching BACK-536 behavior
2. Run bun test src/test/mermaid-markdown.test.tsx plus tsc/biome
3. Confirm disappearance in the next full bun test run
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause refined while fixing: not just a stale assertion — the href is order-dependent. The component prefixes hash hrefs with window.location only when window exists; in isolation renderToString has no window (bare '#...'), but leaked JSDOM globals from other test files make it '/#...'. Fixed by pinning a JSDOM origin (http://localhost/) in beforeEach for the github-slugger describe block (file-level afterEach already restores globals) and asserting '/#...' hrefs deterministically.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the MermaidMarkdown github-slugger heading tests deterministic.

Changes:
- src/test/mermaid-markdown.test.tsx: pin a JSDOM origin (http://localhost/) in beforeEach for the heading github-slugger describe block; the file-level afterEach already restores globals. Assertions expect pathname-prefixed hrefs (/#...), matching BACK-536 hash-link resolution.

Root cause: the component prefixes in-document hash hrefs with window.location only when window exists. Whether window leaked from other test files decided between '#...' and '/#...', so results depended on test execution order — not a timing flake.

Verification:
- bun test src/test/mermaid-markdown.test.tsx passes in isolation and in the full suite
- bunx tsc --noEmit clean; bun run check clean
- Full bun test (full-test-609-611.log): all three github-slugger failures absent.
<!-- SECTION:FINAL_SUMMARY:END -->

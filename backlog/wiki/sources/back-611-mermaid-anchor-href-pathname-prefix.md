---
title: BACK-611 Sync MermaidMarkdown heading anchor href assertions with pathname-prefixed hash links
created_date: '2026-09-06 08:11'
updated_date: '2026-09-06 08:11'
labels:
  - source
  - test
  - web-ui
  - bug
source_path: backlog/tasks/back-611 - Sync-MermaidMarkdown-heading-anchor-href-assertions-with-pathname-prefixed-hash-links.md
---

# BACK-611 Sync MermaidMarkdown heading anchor href assertions with pathname-prefixed hash links

BACK-536 changed in-document hash links so anchor hrefs include the current pathname and search (`/#11-section-title` instead of `#11-section-title`), leaving three github-slugger heading tests in `src/test/mermaid-markdown.test.tsx` asserting the old bare-hash form. The fix pins a JSDOM origin in `beforeEach` and asserts pathname-prefixed hrefs deterministically, without reverting the component behavior.

## Summary

- `src/web/components/MermaidMarkdown.tsx` prefixes hash hrefs with `window.location` only when `window` exists; in isolation `renderToString` has no window (bare `#...`), but JSDOM globals leaked from other test files flipped it to `/#...` — order-dependent, not a timing flake
- Fix: pin JSDOM origin `http://localhost/` in `beforeEach` for the github-slugger describe block; file-level `afterEach` already restores globals
- `src/test/mermaid-markdown.test.tsx`: the three heading tests now expect `/#...` hrefs under the pinned origin
- Verified: passes in isolation and in the full suite (`full-test-609-611.log`)

## Acceptance Criteria

- The three heading github-slugger tests expect `/#...` hrefs
- `bun test src/test/mermaid-markdown.test.tsx` passes
- `bunx tsc --noEmit` and `bun run check` pass on touched files

## Related Concepts

- [[concepts/markdown-pipeline]] — MermaidMarkdown heading anchors and hash-link resolution
- [[concepts/web-ui-features]] — pathname-prefixed in-document navigation from BACK-536

## Related Sources

- [[sources/back-536-in-document-hash-links]] — the BACK-536 behavior change these assertions were synced with

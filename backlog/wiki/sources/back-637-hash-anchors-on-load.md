---
title: BACK-637 Keep in-document anchors working on load, reload and slug normalization
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - anchors
  - markdown
source_path: backlog/tasks/back-637 - Keep-in-document-anchors-working-on-load-reload-and-slug-normalization.md
---

# BACK-637 Keep in-document anchors working on load, reload and slug normalization

BACK-536 made in-document markdown hash links scroll on click, but the resolved URL was useful only for that one click — reopening or sharing it landed at the top of the page. This task made hash links work on load, then fixed two follow-ups: a sidebar-refresh scroll reset, and slug normalization dropping the anchor.

## Summary

- New `src/web/utils/hash-target.ts`: `findHeadingByHashTarget` extracted out of MermaidMarkdown, plus `scrollToHeading()` / `scrollToHashTarget()` and the previously duplicated `HEADING_PREFIX_ID_REGEX` — one shared implementation for click and load paths
- New `src/web/hooks/useHashScroll.ts`, mounted in `AppContent`: reads `location.hash`, scrolls immediately if the heading is rendered, otherwise watches with `window.MutationObserver` (3s bound) because content arrives asynchronously; both hand-written `#A1` prefixes and github-slugger slugs resolve
- Follow-up 1 (sidebar refresh reset scroll): `DocumentationDetail` reloaded on every docs-array identity change, unmounting the markdown so the scroll container clamped to top; fixed with the `handledRouteIdRef` guard DecisionDetail already used — the loader now reacts only to an actual route id change
- Behaviour change from that guard: content is no longer silently reloaded from disk while open, which also stops edit mode being closed and in-progress edits overwritten on websocket refreshes
- Follow-up 2 (slug normalization dropped the anchor): both DocumentationDetail and DecisionDetail normalize bare id URLs to slugged form via replace-navigation that discarded the hash; both now carry `location.hash` into the replacement
- Environment notes: `MutationObserver` is on `window` only (not globalThis) in Bun tests; JSX attribute strings don't process escapes, so test markdown must be JS string constants; Biome `useExhaustiveDependencies` plus React Router's hash clearing mean the hook depends on hash alone
- Tests: new `hash-scroll.test.tsx` (5 cases), `web-documentation-refresh.test.tsx`, `web-decision-hash-scroll.test.tsx`; 200+ web tests pass

## Acceptance Criteria

- Reopening or sharing a hash URL scrolls the heading into view once it exists in the DOM; human prefixes and slugger slugs both resolve
- Refreshing the docs/decisions array neither reloads the open document nor loses the scroll position; switching ids still loads
- Bare id URLs keep their hash through slug normalization, on both documentation and decisions
- Click behaviour and hash-less routes unchanged

## Related Concepts

- [[concepts/markdown-pipeline]] — heading id generation the anchor resolution shares
- [[concepts/browser-loading]] — effect-guard pattern against parent refresh storms

## Related Sources

- [[sources/back-536-in-document-hash-links]] — original click-time hash link behaviour this extends to load
- [[sources/back-598-doc-view-disambiguate-path-title-slug]] — slugged URL normalization involved in follow-up 2
- [[sources/back-639-document-fingerprint-reload]] — refines the same refresh guard with body fingerprints
- [[sources/back-638-header-outline-toc]] — builds the header TOC on this anchor infrastructure

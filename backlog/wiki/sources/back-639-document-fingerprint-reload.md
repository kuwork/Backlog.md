---
title: BACK-639 Reload an open document only when its body fingerprint changes
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - documents
  - live-refresh
source_path: backlog/tasks/back-639 - Reload-an-open-document-only-when-its-body-fingerprint-changes.md
---

# BACK-639 Reload an open document only when its body fingerprint changes

The web viewer ignored external edits until a manual reload: BACK-637's `handledRouteIdRef` guard keys off the route id alone, so it suppressed real body edits along with unrelated refreshes. This task gave every document a body fingerprint so the open viewer reloads only when the text really changed.

## Summary

- New `src/utils/content-fingerprint.ts`: dependency-free fingerprint (length + 32-bit FNV-1a hash), pure so it runs in both Bun and the browser
- `parseDocument` stamps `contentHash` on every read; typed on `Document` as read-derived state and never serialized — `markdown.test.ts` asserts `serializeDocument` output contains no `contentHash`
- `/api/docs` carries the fingerprint, so the reload decision costs no extra request
- `DocumentationDetail`: a new effect compares the incoming fingerprint with the body on screen and reloads silently only when they differ — `loadDocContent` gained a `{silent}` path that keeps the DOM mounted so scroll position and hash anchor survive; edit mode is skipped, a failed silent refresh keeps the current body, and a fetch resolving after a route change is discarded
- BACK-637's route guard kept: the fingerprint effect runs beside it, not instead of it, so an unrelated refresh still never remounts the body
- Live check: editing `doc-12` on disk refreshed the already-open `/documentation/12` page over the websocket without a manual reload; unchanged refreshes left the page alone
- Known-unrelated: the full bun test suite is very slow on this Windows host; remaining failures are CLI-spawn tests exceeding the 5s budget and one Windows temp-dir EBUSY flake

## Acceptance Criteria

- Document payloads carry a stable body fingerprint that never reaches the markdown on disk
- External edits refresh the open document without a manual reload; unchanged refreshes neither reload nor re-enter loading state
- Edit-mode buffers are never overwritten; stale fetches after a route switch are discarded
- Tests cover changed-body reload, unchanged-refresh guard and BACK-637 anchor preservation

## Related Concepts

- [[concepts/browser-loading]] — refresh-guard and silent-reload patterns in web detail pages
- [[concepts/web-server]] — websocket `tasks-updated` broadcast driving the docs-array rebuild
- [[concepts/markdown-pipeline]] — parse-time derived state kept out of serialization

## Related Sources

- [[sources/back-637-hash-anchors-on-load]] — introduced the route-id guard this task refines
- [[sources/back-540-content-store-stale-refresh-guard]] — server-side content store change detection feeding the broadcast
- [[sources/back-595-content-store-watcher-retry-rename]] — watcher robustness on the same refresh path

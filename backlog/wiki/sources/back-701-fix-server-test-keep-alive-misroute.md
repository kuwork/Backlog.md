---
title: BACK-701 Fix local server-suite false failures with Connection: close
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - test
  - infrastructure
source_path: backlog/tasks/back-701 - Fix-local-server-suite-false-failures-with-Connection-close-Bun-1.3.14-keep-alive-misroute.md
---

# BACK-701 Fix local server-suite false failures with Connection: close

Bun 1.3.14 on Windows answers only the first request on a keep-alive connection with a route; the second request falls through to the 404 fallback. Server test suites reusing bare `fetch` connections failed en masse locally (33 pass / 78 fail) while the server itself was healthy. This task fixed it once in test infrastructure with a shared global fetch wrapper.

## Summary

- Root cause isolated and proven pre-existing: a baseline rerun with the BACK-700 changes stashed showed the same failure set; curl on one connection gets 200 twice, so only Bun's keep-alive routing is broken
- New `installCloseConnectionFetch()` in `src/test/test-utils.ts`: wraps `globalThis.fetch`, injects `Connection: close` into every request after normalizing Headers / tuple-array / record header forms; a `__closeConnectionPatched` function-level marker makes installation idempotent across the 14 files sharing one `bun test` process
- 14 server test files gained one import plus one top-level call; the two hand-fixed files kept their per-request header; product code untouched — the only cost is losing connection reuse inside tests
- `web-content-in-place-refresh.test.tsx` gained the now-required `createdDate` on its Document mock
- Verification: server suites 111 pass / 0 fail (was 33/78); web suites 293 pass / 0 fail; `tsc` and biome clean
- Incident lesson: a patch script assumed extension-less imports while the codebase imports `./test-utils.ts`, leaving a dangling line — inspect actual import shapes before scripting merges

## Acceptance Criteria

- Shared idempotent helper injects `Connection: close` after normalizing all HeadersInit shapes
- Every server test file talking to a locally started BacklogServer installs the helper or keeps an explicit per-request header
- Batched `src/test/server-*.test.ts` reports 111 pass / 0 fail with no web-suite regressions
- The Bun 1.3.14 keep-alive misroute is documented in the helper comment

## Related Concepts

- [[concepts/web-server]] — the BacklogServer whose local test suites were misrouted
- [[concepts/ci-platform-contracts]] — platform/runtime quirks that tests must absorb rather than the product

## Related Sources

- [[sources/back-595-content-store-watcher-retry-rename]] — earlier watcher/test-stability work in the same server test area

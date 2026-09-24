---
id: BACK-701
title: >-
  Fix local server-suite false failures with Connection: close (Bun 1.3.14
  keep-alive misroute)
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-24 06:27'
updated_date: '2026-09-24 06:28'
labels:
  - test
  - infrastructure
dependencies: []
references:
  - src/test/test-utils.ts
  - src/test/server-milestone-broadcast.test.ts
  - src/test/server-search-endpoint.test.ts
modified_files:
  - src/test/test-utils.ts
  - src/test/server-search-endpoint.test.ts
  - src/test/server-preview-endpoint.test.ts
  - src/test/server-complete-endpoint.test.ts
  - src/test/server-reorder-publication.test.ts
  - src/test/server-move-tasks-endpoint.test.ts
  - src/test/server-demote-endpoint.test.ts
  - src/test/server-wiki-tree-endpoint.test.ts
  - src/test/server-upload-promote.test.ts
  - src/test/server-task-dates-endpoint.test.ts
  - src/test/server-hostname.test.ts
  - src/test/server-duplicate-ids-endpoint.test.ts
  - src/test/server-docx-convert.test.ts
  - src/test/server-cleanup-endpoint.test.ts
  - src/test/server-assets.test.ts
  - src/test/server-config-endpoint.test.ts
  - src/test/server-documents-endpoint.test.ts
  - src/test/web-content-in-place-refresh.test.tsx
priority: medium
ordinal: 270400
actual_start: '2026-09-24 06:05'
actual_end: '2026-09-24 06:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On this machine, Bun 1.3.14 on Windows answers only the first request of a keep-alive connection with a route: the second request on the same connection goes to the fallback (404) even though the path is the same one that just matched. Server test suites that talk to a locally started BacklogServer through bare fetch reuse connections, so most of them fail en masse locally (a batched run scored 33 pass / 78 fail) while the server itself is healthy - curl reusing one connection gets 200 twice and the browser is unaffected. A baseline comparison (stashing the BACK-700 source changes and rerunning representative failing suites) proved the failure set is pre-existing and unrelated to product changes.

Fix it once in test infrastructure: add a shared, idempotent installCloseConnectionFetch() helper to src/test/test-utils.ts that wraps the process-global fetch and injects Connection: close into every request (normalizing Headers, tuple-array and record header forms first), with a function-level marker so files installing it in the single bun test process never double-wrap. Install it in the 14 affected server test files with one import plus one top-level call - this covers inline call sites too (server-search-endpoint alone has 38). The two files hand-fixed earlier in the session (server-config-endpoint, server-documents-endpoint) keep their explicit per-helper header; server-milestone-broadcast and server-content-broadcast already carried the reference pattern. Also add the now-required createdDate to the Document mock in web-content-in-place-refresh.test.tsx (the Document type gained a required field in the meantime).

Boundaries: test infrastructure only, product code untouched; on a healthy runtime the only cost is giving up connection reuse inside tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 test-utils.ts exports installCloseConnectionFetch() which wraps globalThis.fetch exactly once per process (idempotent via a marker on the wrapped function), injects Connection: close into every request, and normalizes Headers, tuple-array and record HeadersInit forms before merging
- [x] #2 every server test file that talks to a locally started BacklogServer either installs the shared helper or keeps an explicit Connection: close per request; no server test file performs bare keep-alive fetch calls any more
- [x] #3 batched verification on this machine: src/test/server-*.test.ts reports 111 pass / 0 fail (previously 33 pass / 78 fail)
- [x] #4 no regressions: batched src/test/web-*.test.tsx + web-api-error.test.ts report 293 pass / 0 fail, bunx tsc --noEmit is clean and biome check passes on all touched files
- [x] #5 the Bun 1.3.14 keep-alive misroute is documented in the helper comment so future server tests install the helper instead of hand-rolling per-request headers
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add installCloseConnectionFetch() and normalizeHeaders() to src/test/test-utils.ts: wrap globalThis.fetch exactly once (a __closeConnectionPatched marker on the wrapped function prevents double wrapping when several files install inside the single bun test process) and inject Connection: close after normalizing any HeadersInit shape (Headers instance, tuple array, record).

Touch the 14 affected server test files with one import and one top-level installCloseConnectionFetch() call each: server-search-endpoint, server-preview-endpoint, server-complete-endpoint, server-reorder-publication, server-move-tasks-endpoint, server-demote-endpoint, server-wiki-tree-endpoint, server-upload-promote, server-task-dates-endpoint, server-hostname, server-duplicate-ids-endpoint, server-docx-convert, server-cleanup-endpoint, server-assets. Keep the earlier hand-fixed files (server-config-endpoint, server-documents-endpoint) and the reference-pattern files (server-milestone-broadcast, server-content-broadcast) unchanged.

Also satisfy the stricter Document type by adding createdDate to the mock factory in web-content-in-place-refresh.test.tsx.

Verify with bunx tsc --noEmit, biome check on all touched files, the batched bun test run of src/test/server-*.test.ts, and the batched web suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What was done

- src/test/test-utils.ts: added installCloseConnectionFetch() - an idempotent global fetch wrapper injecting Connection: close (marker __closeConnectionPatched, normalizeHeaders() covering Headers/tuple/record forms) - and 14 server test files now install it via one import plus one call. server-config-endpoint and server-documents-endpoint keep their hand-written per-helper fix from earlier in the session. web-content-in-place-refresh.test.tsx gained the required createdDate on its Document mock.

## Key decisions

- One shared wrapper instead of per-call-site edits: server-search-endpoint alone has 38 inline fetch calls, and a global wrapper covers every call shape (object literal, variable init, no init, AbortSignal) with zero churn at call sites.
- Idempotence matters because bun test executes every file in one process; the wrapper carries a function-level marker so repeated installs are no-ops and later suites (web tests included) simply inherit Connection: close.
- Product code untouched; on a healthy runtime the only cost is losing connection reuse inside tests.

## Verification

- Batched src/test/server-*.test.ts: 111 pass / 0 fail (3m46s), up from 33 pass / 78 fail.
- Batched src/test/web-*.test.tsx + web-api-error.test.ts: 293 pass / 0 fail (1m04s).
- bunx tsc --noEmit clean; biome check --write normalized the touched files.

## Incident

- The first patch script assumed extension-less imports (./test-utils) while the codebase imports ./test-utils.ts, so the name-merge fell into the multi-line branch and left a dangling installCloseConnectionFetch, line (a would-be ReferenceError). A second script removed the dangling line and merged the name into the real import statement. Lesson: inspect actual import shapes before scripting merges.
<!-- SECTION:NOTES:END -->

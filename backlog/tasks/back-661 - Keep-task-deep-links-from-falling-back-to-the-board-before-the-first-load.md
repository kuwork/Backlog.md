---
id: BACK-661
title: Keep task deep links from falling back to the board before the first load
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-19 03:38'
updated_date: '2026-09-19 03:49'
labels:
  - web-ui
dependencies: []
references:
  - 'src/web/App.tsx:349'
  - 'src/web/App.tsx:412'
  - 'src/web/App.tsx:520'
  - 'src/web/App.tsx:580'
  - 'src/web/App.tsx:732'
  - 'src/server/index.ts:665'
  - 'src/server/index.ts:266'
  - 'src/test/web-task-deep-link.test.tsx:107'
  - 'src/test/web-task-deep-link.test.tsx:202'
  - 'src/test/web-task-deep-link.test.tsx:232'
  - 'src/test/web-task-deep-link.test.tsx:246'
modified_files:
  - src/web/App.tsx
  - src/test/web-task-deep-link.test.tsx
priority: high
ordinal: 247400
actual_start: '2026-09-19 03:38'
actual_end: '2026-09-19 03:49'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opening a task deep link (for example `http://localhost:6420/task/411/prototype-a-codex-plugin-for-backlog-binary-and-mcp`) lands on the board instead of opening the task modal.

Reproduced with headless Chrome + CDP against this repository, 3/3, on both a cold and a warm server:

```
 435ms  initial replaceState (react-router takes over)
 509ms  first /api/search sent (4.68MB)
 777ms  WebSocket open, immediately receives {"type":"loaded"}
 780ms  history.replaceState -> /          <- the deep link dies here
1019ms  /api/search resolves (347 tasks, BACK-411 among them)
```

Mechanism: `isLoading` is shared between the server's service state and this browser's own first-load state.

- `src/server/index.ts:663` replays the current `browserLoadingState` as soon as a WebSocket opens, and `publishBrowserLoadingState` (`src/server/index.ts:266`) broadcasts `{"type":"loading"}` / `{"type":"loaded"}` to every browser.
- `src/web/App.tsx:727` turns a `loaded` frame into `setIsLoading(false)`.
- The deep-link sync effect guarded only on `if (!isInitialized || isLoading) return;`. At that instant this browser's own `/api/search` is still in flight, so `tasks` is empty, no task matches the URL id, and the effect falls through to `navigate("/", { replace: true })` (`grep` finds no other `navigate("/")` call site in the repository).

So a single server-side `loaded` frame is enough to make the app read a valid deep link as an unknown task id.

Causality check: replacing `window.WebSocket` with a socket that never opens and changing nothing else keeps the URL intact (`pathname=/task/411/...`, dialog present), while the real socket yields `pathname=/` and no dialog.

Waiting for this browser's own first load is necessary but not sufficient. `loadAllData` marks the first load complete only in its `finally`, and before that it awaits `/api/tasks/duplicate-ids` - 2126ms in the trace above against the search's 1018ms. The render that follows `/api/search` is therefore the last dependency change the effect sees, so a flag kept only in a ref flips afterwards without retriggering it. Measured against the real server, a ref-only guard preserved the URL but still left `dialog=false`: the deep link stopped being erased yet never opened.

This is not new code. The WebSocket state replay came from BACK-566 (`fdf7fc3c1`) and the guard from BACK-509 (`9e5f1e6a2`). What changed is timing: the first `/api/search` payload is now ~4.7MB across 347 tasks (~0.8s), and the WebSocket handshake is pushed out to ~350ms by the 3.5MB `/api/tasks?crossBranch=true` requests issued during startup, so the two collide. On a smaller repository the search wins the race and the deep link opens.

Upstream BACK-654 / WEB-12 (draft-165, not yet migrated) adds `hasLoadedDataRef`, whose invariant is that the blocking shell only stands before the first successful load, and its `loaded` branch no longer calls `setIsLoading(false)`. The deep-link effect here is fork-local (upstream v1.52.0 has no `taskIdFromUrl`), so the fix has to be made in this fork.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the surrounding history (`git show fdf7fc3c1`, `9e5f1e6a2`, `f52b190c6`) and confirm the fix is fork-local rather than portable from upstream.
- [x] #2 A deep link to an existing task opens its modal even when the server `loaded` broadcast arrives before this browser first `/api/search` resolves.
- [x] #3 In that race the URL is left untouched - no `replaceState` to `/`.
- [x] #4 The wait is reactive: the effect re-runs and opens the modal once the first load completes, even though `/api/tasks/duplicate-ids` resolves after `/api/search` and the render that follows the search changes no other dependency.
- [x] #5 A deep link whose id genuinely does not exist still falls back to `/` once the first load has completed.
- [x] #6 `isLoading` keeps driving the loading indicator: the `loading`/`loaded`/`error` frames still set `isLoading` and `loadingMessage` as before.
- [x] #7 An automated test mounts the real `App` at the deep-link URL with a slow first search, an immediate `loaded` frame and a delayed duplicate-id preview; it fails against the unmodified guard and against a ref-only guard that is not a dependency.
- [x] #8 `bunx tsc --noEmit`, `bun run check .` and the touched suites pass, and the new case was first confirmed red.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the reactive "first load completed" signal in `src/web/App.tsx`: keep `hasLoadedRef` (it answers `isFirstLoad` synchronously inside `loadAllData`) and set `hasCompletedFirstLoad` state in the same `finally`.

2. Guard the deep-link sync effect on `!isInitialized || isLoading || !hasCompletedFirstLoad`, and list `hasCompletedFirstLoad` among its dependencies so the effect re-runs when the load finishes. The duplicate-id preview resolves after `/api/search`, so the render that follows the search carries no other dependency change and a ref alone never retriggers the effect.

3. Leave the fallback branch alone: with the guard it is only reachable once the first load has completed, which is exactly when an unmatched id really is unknown.

4. Keep `isLoading` as the loading-indicator signal (BACK-566 design) - do not touch the WebSocket handler or the `loaded` branch.

5. Add a regression test that mounts the real `App` in JSDOM at the deep-link URL with a `/api/search` held open past the server's `loaded` frame and a duplicate-id preview held open past that, then asserts the URL is unchanged and the modal opens.

6. Confirm the test is red both against the unmodified guard and against a ref-only guard, run `bunx tsc --noEmit`, `bun run check .` and the touching web suites, and verify in a real browser against the source server.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- `src/web/App.tsx:520` — deep-link sync effect now waits for `hasCompletedFirstLoad` in addition to `isInitialized`/`isLoading`. Without it, the server's `loaded` frame (which clears `isLoading`) let the effect match the URL id against an empty `tasks` array and `navigate("/", { replace: true })`.
- `src/web/App.tsx:349` / `src/web/App.tsx:412` — new `hasCompletedFirstLoad` state set in `loadAllData`'s `finally` next to the existing `hasLoadedRef` flip. The ref alone was not enough: `loadAllData` awaits `/api/tasks/duplicate-ids` before that `finally`, so the render that follows `/api/search` is the last dependency change the effect sees and a ref flip afterwards never retriggers it. `src/web/App.tsx:580` adds the flag to the effect's dependencies. First measured with a ref-only guard against the real server: the URL survived but `dialog=false`.
- `hasLoadedRef` is kept rather than replaced because `loadAllData` reads it synchronously to compute `isFirstLoad`, and making it a dependency would change `loadAllData`'s identity and re-run the load effect.
- The `isLoading` paths are untouched (`src/web/App.tsx:732` still clears it on `loaded`), so the BACK-566 loading indicator behaviour is unchanged; `isLoading` starts true on mount regardless of the guard.
- The fallback at `src/web/App.tsx:571` is now only reachable after a completed first load, which is exactly when an unmatched id really is unknown.
- JSDOM harness notes for anyone mounting the whole `App`: the board renders through `react-tooltip`, so `CustomEvent`, `Event` and `MutationObserver` must be taken from the same jsdom window (`globalThis.CustomEvent = dom.window.CustomEvent`, the precedent is `src/test/web-task-details-modal-demote.test.tsx`), `ResizeObserver` and `matchMedia` need stubs, and the health-check socket connects on a 100ms timer so the first flush has to outlast it.
- The test reproduces the real ordering with two gates: `/api/search` stays pending past the `loaded` frame, and `/api/tasks/duplicate-ids` stays pending past the flush that follows the search. `src/test/web-task-deep-link.test.tsx:107` is the harness, `:202`/`:232`/`:246` are the three cases.
- Verified in a real browser as well: headless Chrome + CDP against `bun src/cli.ts browser -p 6420` on the deep link returns `{"pathname":"/task/411/prototype-a-codex-plugin-for-backlog-binary-and-mcp","dialog":true}` (before the fix: `pathname=/`, `dialog=false`).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Task deep links survive the server's loading broadcast again. The deep-link sync effect in `src/web/App.tsx` resolved the URL id as soon as `isInitialized` was true and `isLoading` was false; the server replays its own `{"type":"loaded"}` on WebSocket open (`src/server/index.ts:665`), which cleared `isLoading` while the browser's first `/api/search` was still in flight, so the empty task list made a valid deep link look like an unknown id and `navigate("/")` erased it.

The effect now also waits on a new `hasCompletedFirstLoad` state set when the first `loadAllData` finishes, and that flag is a dependency so the effect re-runs when the load completes. The reactive flag matters: `loadAllData` waits on `/api/tasks/duplicate-ids` before marking the load complete, so the render after `/api/search` is the last dependency change the effect sees - a ref-only guard kept the URL but never opened the modal (measured against the real server as `dialog=false`).

Nothing else changed: `isLoading` still drives the loading indicator from the `loading`/`loaded`/`error` frames, and an unmatched id still falls back to the board once the first load has finished.

Verified: `bunx tsc --noEmit` clean, `bun run check .` 422 files / 0 errors (3 pre-existing `assets.ts` warnings), all 29 web suites 190 pass / 0 fail. The new case was red twice over - the unmodified guard produced `pathname=/` and a ref-only guard produced an empty dialog. Real browser, headless Chrome + CDP on the reported URL: `pathname=/task/411/prototype-a-codex-plugin-for-backlog-binary-and-mcp`, `dialog=true`.
<!-- SECTION:FINAL_SUMMARY:END -->

---
title: BACK-661 Keep task deep links from falling back to the board before the first load
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - deep-links
  - browser-loading
source_path: backlog/tasks/back-661 - Keep-task-deep-links-from-falling-back-to-the-board-before-the-first-load.md
---

# BACK-661 Keep task deep links from falling back to the board before the first load

Opening a task deep link landed on the board instead of the task modal. The server replays its own `{"type":"loaded"}` broadcast on WebSocket open, which cleared `isLoading` while the browser's first `/api/search` was still in flight — the deep-link sync effect then matched the URL id against an empty task list and `navigate("/")` erased a valid link. Fork-local fix (upstream has no `taskIdFromUrl`).

## Summary

- Reproduced with headless Chrome + CDP, 3/3, on cold and warm servers: the `loaded` replay arrives at ~780ms while the first `/api/search` (4.7MB, 347 tasks) resolves at ~1019ms; a causality check with a never-opening WebSocket kept the URL intact
- Timing, not new code: the replay came from BACK-566 and the guard from BACK-509; what changed is the first search payload grew to ~0.8s and the WebSocket handshake is delayed by startup requests, so the two collide — on a smaller repository the search wins the race
- Fix: new `hasCompletedFirstLoad` state set in `loadAllData`'s `finally`; the deep-link effect guards on it and lists it as a dependency so it re-runs when the first load completes (`src/web/App.tsx:349`, `:412`, `:520`, `:580`)
- Measured subtlety: a ref-only guard preserved the URL but never opened the modal — `loadAllData` awaits `/api/tasks/duplicate-ids` (slower than the search) before marking the load complete, so the render after `/api/search` is the last dependency change the effect sees and a ref flip afterwards never retriggers it; `hasLoadedRef` is kept separately because `loadAllData` reads it synchronously
- Untouched: `isLoading` still drives the loading indicator from `loading`/`loaded`/`error` frames (BACK-566 design), and the fallback to `/` remains for genuinely unknown ids after the first load
- Test mounts the real `App` in JSDOM with a slow first search, an immediate `loaded` frame, and a delayed duplicate-id preview; red against both the unmodified guard and a ref-only guard; verified in a real browser via headless Chrome + CDP (`dialog=true`, URL preserved)

## Acceptance Criteria

- A deep link to an existing task opens its modal even when the server `loaded` broadcast arrives before the first `/api/search` resolves, with the URL untouched
- The wait is reactive: the effect re-runs and opens the modal once the first load completes despite `duplicate-ids` resolving after the search
- A genuinely unknown id still falls back to `/` after the first load; `isLoading` keeps driving the loading indicator
- An automated test reproduces the race and fails against both the unmodified and a ref-only guard

## Related Concepts

- [[concepts/browser-loading]] — the server loading broadcast vs. this browser's first-load state that collided
- [[concepts/web-ui-features]] — deep-link modal routing conventions

## Related Sources

- [[sources/back-566-browser-async-loading]] — introduced the WebSocket `loaded` replay at the root of the race
- [[sources/stable-task-modal-urls-task]] — stable task URL design the deep-link effect serves
- [[sources/back-664-dependency-input-completed-predecessors]] — same App-level navigation fallback machinery, extended for completed records

---
title: BACK-627 Fix back arrow leaving stale history entry after drill-down
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
labels:
  - source
  - web-ui
  - routing
  - bug
source_path: backlog/tasks/back-627 - Fix-back-arrow-leaving-stale-history-entry-after-drill-down-in-web-UI.md
---

# BACK-627 Fix back arrow leaving stale history entry after drill-down

The modal back arrow pushed instead of popped. Drilling from a background page into BACK-614 and then into dependency BACK-511 produced history `[bg, 614, 511]` with stack `[614]`; clicking the arrow pushed the parent URL again (`[bg, 614, 511, 614]`), leaving `/task/511` unconsumed. The subsequent close (X/backdrop via `handleCloseModal`'s `navigate(-1)`) then landed on `/task/511` and reopened the child modal, forcing one extra close per drilled level.

## Summary

- Fix in `src/web/App.tsx` `handleBack`: replaced the push of the parent task URL with `navigate(-1)`
- Correctness argument: each drill-down pushes exactly one history entry and appends exactly one `taskHistory` item, so popping the current entry restores the documented 1:1 invariant between the browser history stack and the modal stack (`handleCloseModal` already relied on it)
- Back-arrow behavior now matches the browser back-button path exactly
- Direct-load edge case preserved: a modal opened without `backgroundLocation` still falls back to `navigate("/", { replace: true })`
- Verified sequences: `bg → 614 → 511` drill, arrow pops to 614, X does a single `navigate(-1)` back to `bg`; repeated drill/back cycles stay aligned
- Validation: `bunx tsc --noEmit`, `bun run check` (pre-existing warnings only), `bun test src/web` (84 pass), `bun run build`

## Acceptance Criteria

- Back arrow after drill-down pops exactly one entry; no duplicate `/task/<child>` entry remains
- After arrow-back, X/backdrop/Escape returns to the background page in one step
- Repeated drill-down/back sequences keep history and modal stack 1:1

## Related Concepts

- [[concepts/spotlight-search]] — the `/search` background exposed this defect and shares the same close semantics
- [[concepts/web-ui-features]] — modal drill-down navigation conventions

## Related Sources

- [[sources/back-624-global-search-dialog]] — BACK-624 fixed the sibling push/replace accumulation when returning to `/search`
- [[sources/back-505]] — BACK-505 introduced the drill-down stack and back arrow
- [[sources/stable-task-modal-urls-task]] — BACK-509 modal-over-route URL layer

---
id: BACK-694
title: >-
  Stop the drafts session crashing with a popup open when the terminal is
  resized
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 07:18'
updated_date: '2026-09-23 16:42'
labels:
  - tui
  - bug
dependencies: []
references:
  - src/ui/tui.ts
  - src/ui/components/filter-header.ts
  - src/ui/task-viewer-with-search.ts
  - src/ui/board.ts
  - src/test/tui-screen-teardown.test.ts
modified_files:
  - src/ui/tui.ts
  - src/test/tui-screen-teardown.test.ts
priority: high
ordinal: 266400
actual_start: '2026-09-23 07:18'
actual_end: '2026-09-23 16:42'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Changing the terminal height while a popup is open in a drafts session crashes the TUI.

Reported from `bun run cli draft list`: leave the list with Tab, press Enter on a row for its detail popup, then change the terminal height - the process exits with

```
Error: Cannot switch a node's screen.
  at buildFilterItem (src/ui/components/filter-header.ts:419)
  at buildRow
  at buildElements
  at repositionElements (src/ui/components/filter-header.ts:661)
```

Root cause, reproduced in `tmp/probe-resize-stale-screen.ts`: the Tab handler destroys the outgoing view's screen (`task-viewer-with-search.ts`), and blessed's Screen constructor binds a program-level "resize" fan-out of its own - `program.on("resize", () => { screen.alloc(); screen.render(); emit("resize") })` - that `screen.destroy()` never takes off. The shared program keeps that handler, so every later resize re-enters the destroyed screen's own "resize" listeners: the view's `filterHeader.rebuild()` builds fresh elements into a container whose `screen` is the dead one, while blessed resolves the new element's screen from the single live screen and refuses the insert. The popup is incidental to the mechanism - what the resize needs is a screen that a view switch already left behind.

The fix belongs in the shared wrapper rather than in either view: `createScreen` already strips the program's key listeners on teardown for the same class of reason, and now also drops the resize fan-out that belongs to the screen going away. Dropping by event name is not enough here - clearing every program "resize" listener would silence a screen that is still mounted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Leaving a view with Tab stops that view's screen from answering later terminal resizes, so changing the height with the detail popup open no longer throws Cannot switch a node's screen
- [x] #2 The teardown drops only the destroyed screen's own program-level resize fan-out, so a screen that is still mounted keeps its resize handling
- [x] #3 A case drives the reported path (leave the list with Tab, open the detail popup, change the height) and a targeted revert turns exactly the new cases red
- [x] #4 The fix lives in the shared screen wrapper, so every view that leaves a screen behind is covered rather than the drafts session alone
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce headlessly: drive the shared program's real resize path (stdout emits "resize") after destroying a screen that still has a filter header in its tree, which the earlier probe missed by emitting "resize" on a screen instead of the program.
2. Fix it in `createScreen`: remember the program-level resize fan-out blessed binds for this screen at construction and remove it on the first teardown.
3. Cover it with cases that fail without the fix: the reported path (Tab away, detail popup open, change the height), plus a listener census on the shared program that rejects the over-broad alternative.
4. Verify with a revert matrix, the whole set of suites that build screens, and a type/format check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed

- `src/ui/tui.ts`: `createScreen` records the program-level "resize" fan-out the screen gains while it is constructed (it is the last listener registered for that event) and removes it in the same first-teardown block that strips the program's input listeners. Nothing else changes: the key stripping, the title restore, and the `Program.prototype.destroy` neutralisation are untouched.
- `src/test/tui-screen-teardown.test.ts` (new): one case walks the reported path - the list view is torn down, a board view is mounted, its detail popup is open, the height changes - and asserts the destroyed view's resize listener never fires while the live one still does; a second case asserts the shared program loses exactly one "resize" listener when a screen is destroyed.

## Checks

- Repro probe `tmp/probe-resize-stale-screen.ts`, one case per process: `tabbed` and `popup` threw "Cannot switch a node's screen." before the fix and report `no throw` after; `liveKeepsResizing` reports the live listener firing once.
- Revert matrix `tmp/rollback-694.py`: variant A (no removal) turns both new cases red; variant B (clear every program "resize" listener instead of the screen's own) keeps the crash case green and turns the listener census red - the two cases pin different halves. Source restored byte-for-byte.
- Every suite that builds a screen was run together, plus `bunx tsc --noEmit` and `bunx biome check` on the touched files.

## Traps worth remembering

- The crash only shows when the resize arrives the way a terminal delivers it: `program.emit("resize")` (or emitting on a screen) skips the program's own reallocation and fails later for an unrelated reason (`lines[yi]`). The probe emits on `process.stdout`, which is what the real path does.
- Synthesising views in a test process is not free: building a labelled box on a screen that has never allocated its buffer can throw `lines[yi]` for reasons that have nothing to do with the behaviour under test. The teardown case that needs two mounted screens therefore asserts on the shared program's listener census rather than mounting a second filter header.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The drafts session no longer dies when the terminal is resized with a popup open after a view switch. blessed binds a program-level "resize" fan-out per screen that `screen.destroy()` never removes, so a screen the Tab switch had already destroyed kept re-emitting "resize" into the outgoing view's own listener, which rebuilt its filter header into a dead screen's container and made blessed throw "Cannot switch a node's screen.". The screen wrapper now drops that fan-out for the screen it is tearing down, leaving the mounted screen's resize handling alone, and two new cases pin both halves: the reported path stops throwing, and the shared program loses exactly one "resize" listener per teardown. Verified with a reproduction probe, a two-variant revert matrix, every screen-building suite, a type check and Biome.
<!-- SECTION:FINAL_SUMMARY:END -->

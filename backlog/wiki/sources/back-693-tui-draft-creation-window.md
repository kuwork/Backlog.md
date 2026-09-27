---
title: BACK-693 Add a draft creation window to the TUI drafts session
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
  - cli
  - drafts
source_path: backlog/tasks/back-693 - Add-a-draft-creation-window-to-the-TUI-drafts-session.md
---

# BACK-693 Add a draft creation window to the TUI drafts session

The TUI had no place to create a draft: the board's create key opened the task composer with workflow statuses, and a draft created there was dropped with "Drafts are not shown on the task board" — wrong in a session whose whole purpose is drafts. This task makes the drafts session's create key open the task composer pinned to Draft, gives `draft create` the five date flags, and fixes a resize crash that killed the session.

> **Provenance note:** two archived files carry the conflicting ID BACK-694 — `backlog/archive/tasks/back-694 - Add-a-draft-creation-window-to-the-TUI-drafts-session.md` is an earlier, narrower cut of this task (same title, In Progress, only the composer-pinning scope), and `backlog/archive/tasks/back-694 - Stop-the-drafts-session-crashing-with-a-popup-open-when-the-terminal-is-resized.md` is the standalone version of the resize fix that landed here as the "third part". The live BACK-694 is a different task (board task popup sync). This file is the canonical, completed record for both absorbed scopes.

## Summary

- Board create path: `UnifiedViewOptions.draftSession` (set by the interactive `draft list` command in `cli.ts`) is the single switch; the composer receives one status choice (`DRAFT_STATUS`, exported from the composer rather than a second literal), and `getCreatedTaskBoardOutcome` lets a created draft join the session with the ordinary created notice while a task session keeps the drafts-are-not-shown behavior
- The window is the task composer itself, so a draft carries the same fields a task would, the five date fields included; the composer takes an `entity` and asks `entity-noun.ts` (the helper BACK-692 introduced, moved and renamed `entityNoun`) so a drafts session reads `Create Draft` / `Create draft`
- The earlier row gate was removed: neither session reads the row under the cursor to create — the window's status field decides the column and the board focuses the created record, so a drafts session with an empty board still creates
- CLI half: the five create-time date mappings were lifted into one helper `buildCreateDateFields` called by both `task create` and `draft create`, so trimming and the stored-UTC conversion for actual start/end exist once; the shipped drafts guide lists the new options
- Resize fix: blessed binds a program-level "resize" fan-out per screen that `screen.destroy()` never removes, so a Tab-destroyed screen kept answering resizes and rebuilt the outgoing view's filter header into a dead container ("Cannot switch a node's screen."); `createScreen` in `src/ui/tui.ts` now drops that fan-out — by reference, so a still-mounted screen keeps its own handling — covering every view that leaves a screen behind
- Tests: 7 new board cases (`board-tui-draft-create`), 3 new draft-create consistency cases (the actual range pinned through an Asia/Tokyo child-process timezone), a new `tui-screen-teardown` suite; two five-variant and one two-variant revert matrices each turn exactly their own cases red

## Acceptance Criteria

- Drafts session: create key opens the composer pinned to Draft, the created draft joins the session and is selectable; task session behavior unchanged
- Window chrome and help list name the create action per session (`Create draft` vs `Create task`); creation is row-independent
- `backlog draft create` accepts the five date flags, shares the mapping with `task create`, and stores actual start/end in stored UTC form
- Terminal resize after a Tab switch with a popup open no longer crashes; only the destroyed screen's resize fan-out is dropped

## Related Concepts

- [[concepts/cli-tui]] — unified view, composer, and screen lifecycle conventions
- [[concepts/task-lifecycle]] — drafts as first-class session records
- [[concepts/date-fields]] — the shared create-time date mapping

## Related Sources

- [[sources/back-689-tui-task-composer-dates]] — the composer date fields this window inherits
- [[sources/back-692-tui-edit-file-location-routing]] — source of the `entityNoun` helper the composer reuses
- [[sources/back-587-repair-tui-task-composer-ux]] — the composer being reused as the draft creation window

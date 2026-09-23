---
id: BACK-693
title: Add a draft creation window to the TUI drafts session
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 05:33'
updated_date: '2026-09-23 17:10'
labels:
  - cli
  - tui
dependencies: []
references:
  - src/ui/board.ts
  - src/ui/unified-view.ts
  - src/ui/components/task-composer.ts
  - src/ui/components/help-popup.ts
  - src/cli.ts
  - src/guidelines/cli-instructions/drafts.md
  - src/test/board-tui-draft-create.test.ts
  - src/test/draft-create-consistency.test.ts
  - src/ui/tui.ts
  - src/ui/components/filter-header.ts
  - src/ui/task-viewer-with-search.ts
  - src/test/tui-screen-teardown.test.ts
modified_files:
  - src/cli.ts
  - src/guidelines/cli-instructions/drafts.md
  - src/test/draft-create-consistency.test.ts
  - src/test/board-tui-draft-create.test.ts
  - src/ui/board.ts
  - src/ui/components/help-popup.ts
  - src/ui/components/task-composer.ts
  - src/ui/unified-view.ts
  - src/ui/tui.ts
  - src/test/tui-screen-teardown.test.ts
priority: high
ordinal: 265400
actual_start: '2026-09-23 05:34'
actual_end: '2026-09-23 09:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI has no place to create a draft, and the create window it does have throws a draft away.

`backlog draft list` opens the shared task-list view; the create key lives on the kanban tab and opens the task composer, which offers the configured workflow statuses and persists whatever status the form holds. So a draft can only be made by picking Draft out of the task statuses, and the result is then discarded: a created draft is left out of the session's data and answered with `Created DRAFT-n as a draft. Drafts are not shown on the task board.`, which is wrong in a session whose whole purpose is drafts.

What should exist: in a drafts session the create key opens the same composer - same layout, same fields, including the due, planned and actual dates - with the status pinned to Draft, and the created draft joins the session so it can be selected, edited and promoted from there. A task session keeps today's behaviour, including the notice that a draft created there is not one of its records.

Second part, already implemented on this tree: the same fields on the CLI side. `backlog draft create` could not set any of them - `draft edit` exposes all five through the shared edit chain, `task create` takes them, and the record keeps them - so a draft created as a draft was the one surface that could not carry a schedule. The five flags now go through one mapping helper shared with `task create`, so the two cannot drift on trimming or on the stored-UTC conversion applied to actual start and end.
Third part, this round: the drafts session has to survive a terminal resize. Leaving the list with Tab, opening a row's detail popup and changing the terminal height killed the process with `Cannot switch a node's screen.` (reported from a `draft list` session). blessed binds a program-level "resize" fan-out per screen that `screen.destroy()` never removes, so the screen the Tab switch had just destroyed kept answering resizes: it re-entered the outgoing view's own listener, which rebuilt its filter header into the destroyed screen's container, and blessed refused the insert. The shared screen wrapper now drops that fan-out for the screen it tears down, which covers every view that leaves a screen behind rather than the drafts session alone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In a drafts session the create key opens the task composer with its status pinned to a single Draft choice, while a task session keeps the configured statuses
- [x] #2 A draft created in a drafts session joins that session (rendered in the board and selectable) and is reported as created, instead of being left out with the drafts-are-not-shown notice
- [x] #3 A draft created from a task session is still reported as not shown on the board and stays out of that session's data
- [x] #4 The help list opened from a drafts session names the create action for a draft, and a task session keeps its task wording
- [x] #5 The window is the task composer itself, so a draft created there carries the same fields a task would, including the due, planned and actual dates
- [x] #6 backlog draft create accepts the five date flags and writes them into the draft file, which still carries status: Draft, storing actual start and end in the stored UTC form
- [x] #7 A draft create run without any date flag writes no date field, and the date mapping is shared with task create instead of duplicated
- [x] #8 The shipped drafts guide lists the new options and both create commands' help print all five
- [x] #9 A targeted revert turns exactly the drafts-session cases red while the task-session guard stays green, and dropping the create-time date mapping turns exactly the draft-create date cases red while task create's coverage stays green
- [x] #10 The window names itself and its create action for what the session creates - a drafts session reads Create Draft / Create draft while a task session keeps its task wording
- [x] #11 Neither session reads the row under the cursor to create: the window's status field decides the column the record lands in and the board focuses that record, so a drafts session with an empty board still creates a draft
- [x] #12 Leaving a view with Tab stops that view's screen from answering later terminal resizes, so changing the height with a detail popup open no longer throws Cannot switch a node's screen
- [x] #13 The teardown drops only the destroyed screen's own program-level resize fan-out, so a screen that is still mounted keeps its resize handling
- [x] #14 A case drives the resize path (leave the list with Tab, open the detail popup, change the height) and a targeted revert turns it red
- [x] #15 Every view that leaves a screen behind is covered, because the fix lives in the shared screen wrapper rather than in a view or in the drafts session
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Re-read how the drafts session is built (the drafts command's interactive view), how the board's create key opens the composer, and how the board consumes the created record.
2. Thread the session kind from the drafts command through the unified view into the board, so one flag decides the whole create path.
3. Pin the composer's status choices to Draft in a drafts session, taking the label from the composer rather than a second literal.
4. Let a created draft join the session's data and take the ordinary created notice; keep the task-session path and its notice unchanged.
5. Name the create action for drafts in the help list that a drafts session opens.
6. Cases: the composer receives a single Draft choice in a drafts session and the configured statuses otherwise; a draft created in the drafts session is rendered and selectable; a draft created in a task session is still reported as not shown and stays out of the data; the help list names the create action for drafts.
7. CLI half (done): lift the create-time date mapping into one helper both create commands call, add the five options to `draft create`, and case them in the draft-creation consistency suite plus the shipped drafts guide.
8. Verify both halves clause by clause with targeted reverts, then the scoped suites, the type check and Biome.
9. Reproduce the resize crash headlessly by driving the shared program's real resize path (the output emits "resize") after a view switch has destroyed a screen that still had a filter header in its tree.
10. Drop that screen's program-level resize fan-out on teardown, by reference rather than by event name so a screen that is still mounted keeps its own handling.
11. Case the reported path (leave the list with Tab, open the detail popup, change the height) and the listener census on the shared program; verify with a two-variant revert matrix and every suite that builds a screen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed

### The drafts session's create window (the main scope)
- `src/ui/board.ts`: the create key hands the composer one status choice - `DRAFT_STATUS` - when the board belongs to a drafts session, and keeps the configured workflow statuses otherwise. A created draft now joins the session and takes the ordinary created notice, while a task session still answers with the drafts-are-not-shown line and keeps the draft out of its data; `getCreatedTaskBoardOutcome(task, visible, draftSession)` carries that difference.
- `src/ui/unified-view.ts`: `UnifiedViewOptions.draftSession` is threaded into the board, and `createTaskFromBoard` publishes a created record into the session when it is a draft made by a drafts session. Without that the board would render the draft while the list view behind it never learned about it.
- `src/cli.ts`: the interactive `draft list` view sets `draftSession: true`; that one flag is the whole switch.
- `src/ui/components/help-popup.ts`: the board's shortcut list is built from a `boardShortcuts(createDescription)` builder, so a drafts session opens the same list with `Create draft` and a task session keeps `Create task` - one list, two labels.
- `src/ui/components/task-composer.ts`: `DRAFT_STATUS` is exported so the board pins the window with the composer's own constant rather than a second literal.
- The window is the task composer itself, so the draft it creates carries the same fields a task would, the five date fields included. That is what makes this the drafts counterpart of the task window instead of a reduced form.

### The window's wording and where a created record lands (same window, follow-up)

- The window's own chrome was still fixed: the title read `Create Task` and the action `Create task` in every session. The composer now takes an `entity` and asks `src/ui/entity-noun.ts` for the noun, so a drafts session reads `Create Draft` / `Create draft` while a task session is unchanged. That module is the one BACK-692 introduced for the edit key's notices: the helper moved there and was renamed to `entityNoun` instead of gaining a second copy.
- A task session never reads the row under the cursor to create anything - the window's status field decides the column and the board focuses the created record afterwards - so a row gate in the drafts session made the two sessions disagree for no gain, and it refused to open the window whenever the cursor sat on an empty column. The gate added earlier in this round is gone: a drafts session creates from anywhere as well, and because its window is pinned to `Draft` the draft it makes always lands in the Draft column.

### The CLI half (implemented first, kept as the second part)
- `src/cli.ts`: the five create-time date options were mapped inline in `task create`; that mapping is now one helper, `buildCreateDateFields`, called by both `task create` and `draft create`, so trimming and the stored-UTC conversion for actual start and end exist once. `draft create` gained the five flags and passes the mapped fields into its create input.
- `src/guidelines/cli-instructions/drafts.md`: the `draft create` option list gained the five flags, and the quick-capture rule now says the dates are on both commands.

### The terminal resize (third part)

- `src/ui/tui.ts`: `createScreen` records the program-level "resize" fan-out blessed's Screen constructor binds for the screen, and removes it in the same first-teardown block that strips the program's input listeners. It has to be by reference - clearing every program "resize" listener would silence a screen that is still mounted - while the key listeners stay keyed by event name. Nothing else changed: the title restore and the `Program.prototype.destroy` neutralisation are untouched.
- `src/test/tui-screen-teardown.test.ts` (new): one case walks the reported path (the list view is torn down, a board view is mounted, its detail popup is open, the height changes) and asserts the destroyed view's resize listener never fires while the live one still does; a second asserts the shared program loses exactly one "resize" listener when a screen is destroyed.
## Checks
- `src/test/board-tui-draft-create.test.ts` (new, 7 cases): the window receives a single Draft choice in a drafts session; the created draft is rendered there with the ordinary created notice; a task session keeps the multi-status list, does not render the draft and reports it as not shown; the outcome helper reports both shapes; the help list words the create action per session; `createTaskFromBoard` publishes a draft only for a drafts session while still publishing tasks.
- The same file reads the real composer's widget tree to assert the window's own chrome: a drafts session shows the ` Create Draft ` title and the `Create draft` action and no task wording, and a task session is the exact mirror. A further case presses the create key on a board with no rows at all in either session, so the create path is pinned as row-independent, with the record landing in the column its status field names.
- `src/test/draft-create-consistency.test.ts` (8 cases, 3 new): the five flags land in the draft file with `status: Draft`; a run without any flag writes no date field; both create commands' help print the five flags. The actual range is pinned through a child-process timezone (`Asia/Tokyo`), so the stored-UTC conversion is observable on any machine: 09:00 Tokyo stores as 00:00.
- Revert matrix `tmp/rollback-693-words.py` (wording and the row gate): two variants x three cases run alone - reverting the composer literals turns exactly the wording case red, and putting the row gate back turns exactly the no-row case red while the drafts session that has a row and the task session stay green; sources restored byte-for-byte.
- Revert matrix `tmp/rollback-693.py`: five variants (pinning, join, created notice, session publish, help context) x five cases, each case run alone. Every variant turns exactly its own case red and leaves the task-session guard green; sources restored byte-for-byte, and the script's read-only `check` mode re-asserts every anchor afterwards.
- `bunx tsc --noEmit` clean; `bunx biome check` clean on every touched file; the guide-example verifier passes after the drafts guide edit.
- Neighbours: the board suites (`board-tui-move`, `board-render`, `board-ui`) 30 pass, `cli-draft-edit` 8 pass, and `draft-create-consistency` 8 pass. One teardown EBUSY under a combined run reproduces as a pass when the file is run alone.
- Resize crash, reproduced before the fix in `tmp/probe-resize-stale-screen.ts` (one case per process, driving `process.stdout.emit("resize")`): `tabbed` and `popup` both threw `Cannot switch a node's screen.`, and both report `no throw` after the fix; a control case reports the live screen's listener firing once.
- Revert matrix `tmp/rollback-693-resize.py` for the resize fix: variant A (no removal) turns both new cases red; variant B (clearing every program "resize" listener instead) keeps the crash case green and turns the listener census red, so the two cases pin different halves. Source restored byte-for-byte.
- All 19 suites that build a screen run together: 118 pass / 3 fail, the three being the pre-existing `tui-task-composer-layout` cases that fail identically with this fix temporarily removed.

## Traps worth remembering
- A revert matrix killed mid-flight skips its restore, and the next run then captures the mutant as its pristine copy: that showed up as an anchor matching zero times plus two cases failing for a reason unrelated to their variant. The script now has a read-only `check` mode that re-asserts every anchor, and it is worth running before trusting a fresh set of backups.
- Three cases in `tui-task-composer-layout.test.ts` fail on this machine both before and after the wording change. Reverting the three composer literals temporarily and re-running one of them is what showed that: a failing neighbour is not evidence about this round until it is run against the reverted source.
- `task edit -t` rewrites the frontmatter title but does not rename the task file; the file has to be renamed to keep this repository's naming convention, and the id keeps resolving afterwards.
- A Bun `$\`...\`` template literal with backslash continuations is split into extra argv entries (`too many arguments ... got 11`); the shell call has to sit on one line.
- The resize crash only shows when the resize arrives the way a terminal delivers it: emitting "resize" on a screen runs just that screen's listeners, and emitting it on the program skips the program's reallocation, so both fail later for an unrelated reason (`lines[yi]`) and hide whether the resize ever reached the views. Emit on the output object, after setting its `columns` / `rows`.
- Building a labelled box on a screen that has never allocated its buffer throws `lines[yi]` too (`setLabel` → `clearPos` → `clearRegion`). A case that needs two mounted screens should therefore assert on the shared program's listener census instead of mounting a second filter header.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
BACK-693 carries the TUI draft creation window as its main scope: a drafts session's create key opens the task composer with the status pinned to Draft, and the created draft joins the session instead of being dropped with the drafts-are-not-shown notice, while a task session keeps today's behaviour. The window is the task composer itself, so the draft carries the same fields a task would, dates included. The second part gives the CLI `draft create` the same five date flags through one mapping helper shared with `task create`, with the drafts guide updated. The window also names itself for what it creates (`Create Draft` / `Create draft` in a drafts session) and reads no row under the cursor in either session, so a drafts session with an empty board still creates and the record lands in the Draft column. The third part fixes what the resize did to that session: a screen the Tab switch had destroyed kept answering the shared program's resizes and rebuilt the outgoing view's filter header into a dead container, which blessed answered with "Cannot switch a node's screen."; the screen wrapper now drops that fan-out for the screen it tears down, so a resize with the detail popup open no longer kills the process. Verified with seven new board cases and three new draft-create cases (the actual range pinned through a child-process timezone), thirty neighbouring board cases, a five-variant revert matrix that turns exactly its own cases red, a clean type check and Biome.
<!-- SECTION:FINAL_SUMMARY:END -->

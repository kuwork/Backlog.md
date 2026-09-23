---
id: BACK-687
title: 'CLI TUI: Replace milestones list with an interactive milestone board view'
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-22 06:47'
updated_date: '2026-09-22 15:58'
labels:
  - cli
  - tui
  - milestone
  - enhancement
dependencies: []
documentation:
  - src/ui/board.ts
  - src/cli.ts
  - src/ui/components/generic-list.ts
  - src/ui/task-viewer-with-search.ts
  - src/core/milestones.ts
  - src/web/components/MilestoneDetailsModal.tsx
  - src/ui/milestones.ts
  - src/utils/milestone-search.ts
  - src/test/milestones-tui.test.ts
  - src/ui/components/milestone-form.ts
priority: medium
ordinal: 260400
actual_start: '2026-09-22 06:58'
actual_end: '2026-09-22 08:10'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the plain-text milestone list output with an interactive TUI that mirrors the task list / kanban board experience.

Why: milestones are currently a static dump of counts. Users cannot browse what is inside a milestone, or drill into one, without leaving the CLI or opening the web UI. This brings the milestone surface in line with the task list and board, and reuses the same controls instead of inventing new ones.

Scope:

- Entry point: `bun run cli milestones list` (the existing `backlog milestone list` command). Default behavior becomes the interactive TUI; `--plain` and non-TTY stdout keep the current text output.
- Layout: two panes. Left is the milestone list; right is a kanban board of the focused milestone's tasks.
- Selecting a milestone in the left list immediately shows that milestone's task cards on the right board (the left selection drives the right board content).
- The right pane must reuse the existing board control logic (`renderBoardTui`) so keyboard handling, move/edit shortcuts, filters, empty-column hiding, and the number of visible status columns match the `task list` board exactly. The only difference is that the selected milestone filters which tasks the board shows.
- Focus moves between the milestone list and the board with arrow keys or j/k. Enter on a focused milestone opens a milestone detail popup; Enter on a focused board task opens the existing task detail popup.
- The milestone detail popup shows milestone metadata only (title, status and progress, dates, description, docs). It must NOT render the milestone's task list, because the board pane already shows those tasks.

Build on: `src/ui/board.ts` (renderBoardTui), `src/cli.ts` (task list command and the current milestone list command), `src/ui/components/generic-list.ts`, `src/ui/task-viewer-with-search.ts`, `src/core/milestones.ts`, and `src/web/components/MilestoneDetailsModal.tsx` for detail-field parity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun run cli milestones list launches the interactive TUI in a TTY; --plain and non-TTY stdout keep the existing text output.
- [x] #2 The TUI shows two panes: a milestone list on the left and a kanban board on the right for the focused milestone.
- [x] #3 Selecting a milestone in the left list shows that milestone's task cards on the right board.
- [x] #4 Focus moves between the milestone list and the board using arrow keys or j/k.
- [x] #5 The right pane reuses the existing board implementation so column count, ordering, empty-column hiding, move/edit shortcuts, and filters behave exactly like bun run cli task list.
- [x] #6 Pressing Enter on a focused milestone opens a milestone detail view showing milestone metadata (title, status and progress, dates, description, docs) and does not list the milestone tasks.
- [x] #7 Pressing Enter on a focused board task opens the existing task detail popup with the same behavior as the board.
- [x] #8 Switching milestones or focus keeps a valid selection and exiting the TUI returns cleanly to the shell.
- [x] #9 The board filter bar (Search, Priority, Labels — no milestone filter) spans the top of both panes, and its search matches tasks exactly like the web milestone page and stays applied when the milestone selection changes.
- [x] #10 The milestone list is the unassigned (No milestone) bucket first, then every milestone in milestone-file order with completed ones marked; no milestone is hidden.
- [x] #11 N creates a milestone while the list holds the keyboard, and a task defaulting to the selected milestone while the board holds it.
- [x] #12 Only the pane that holds the keyboard is highlighted: the other pane's frame is not yellow.
- [x] #13 Every milestone row shows that milestone's own done/total under the active header filters, whatever milestone the board is scoped to, and the numbers follow a filter change.
- [x] #14 The filter bar's <shown>/<total> tasks summary counts against the whole task total, so its second number does not move with the milestone scope or with the filters.
- [x] #15 The milestone form captures a description and the five dates the detail popup shows when creating a milestone, and the detail popup's E reopens the same form to edit them on an existing one.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Agreed with the user: one full-width board filter bar (Search / Priority / Labels, no milestone filter) sits above both panes; left is the milestone list, right is the kanban columns inside a frame titled "Tasks"; one shared footer spans the bottom.

1. src/ui/board.ts: add an optional embed (BoardEmbedOptions) and a visibleFilters passthrough. Route every key binding through one keysActive() predicate so a host pane can hold the keyboard; reserve the left inset for the host sidebar and keep it aligned with the board's own chrome; hand the left boundary (onExitLeft) and quit (onQuit) to the host; let the host override the footer (footerHint); frame the columns region via areaLabel and highlight that frame only while the board holds the keyboard; expose a BoardHandle (focusBoard, syncChrome). With no embed the board behaves exactly as before.

2. src/ui/milestones.ts: renderMilestonesTui mounts the board with embed. The sidebar lists buildMilestoneBuckets in the order it already returns — the unassigned bucket first, then every milestone in milestone-file order, completed ones marked — and pushes the highlighted bucket's tasks to the board through the board's own updates hook. There is no "All milestones" summary row and no milestone is ever hidden.

3. src/utils/milestone-search.ts: the milestone search contract shared by the TUI header and src/web/components/MilestonesPage.tsx (exact task id, then a substring of id or title, then the shared fuzzy index), so a query means the same thing on both surfaces and stays latched when the milestone scope changes.

4. Keys: up/down and j/k move the list and the board follows live; Enter opens the read-only milestone detail popup; right or l focuses the board; left or h from the board's first column returns to the list; n creates a milestone on the list and a task defaulting to the selected milestone on the board; ? opens the milestones help; q/Esc quits.

5. createMilestonePopup mirrors createTaskPopup: centred bordered popup, metadata header, scrollable body, no task list.

6. src/ui/components/help-popup.ts gains a milestones context, and the list pane renders its own footer hint.

7. src/cli.ts: milestone list runs the TUI when stdout is a TTY and --plain is absent; otherwise it keeps today's text output, where --show-completed still applies.

8. src/test/milestones-tui.test.ts drives the screen through blessed's own key dispatch and tears the TUI down in a finally, so a failed assertion cannot leak a mounted screen into the next test.

9. Verify with bunx tsc --noEmit, biome on every touched file, and the milestone + board + web suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Design decisions confirmed with the user: (1) top filter bar spans both panes and excludes the milestone filter; (2) the right pane reuses the real board component (no search bar of its own) so control logic matches board; (3) n creates a task defaulting to the selected milestone.

Review decisions folded in after the first pass: the filter bar spans both panes and drops the milestone filter; the right pane is the real board component so its controls match task list exactly; n defaults a new task to the selected milestone; the list is the unassigned bucket followed by every milestone in milestone-file order, completed ones marked, with no "All milestones" row, so --show-completed now only affects the plain text output; the columns sit in a frame titled "Tasks" that is highlighted only while the board holds the keyboard.

Two bugs the tests caught in the new prompt, both real for interactive use: read mode never submits on Enter (it appends a newline), so Enter is bound on the input itself and the value is trimmed; and textbox readInput() puts the screen into grab-all-keys mode that only its own _done() releases, so tearing the prompt down while it was still reading left every later keypress dead — including the host's quit.

Validation: bunx tsc --noEmit clean; biome clean on every touched file (repo-wide bun run check . still reports pre-existing issues in untouched files: src/core/assets.ts non-null assertions, src/utils/task-path.ts indentation); bun test src/test/milestones-tui.test.ts 10/10; 51/51 across the board suites re-run after the final change (board-tui-move, board-hide-empty-columns, tui-task-detail-popup-resize, board-ui, board-ui-selection, board-render), and the rest of the board batch (board-command, board-config-simple, board.test, readme-board, cli-board-integration) passes; web milestone search + help popup + cli milestone management 35/35; bun run cli milestone list --plain and the piped (non-TTY) path still print the text summary.

Environment caveat: this workspace is a git worktree whose admin directory (D:/git/Backlog.md/.git/worktrees/1.52-milestone) is missing, so git commands inside it fail. The tests that need git fail for that reason and not because of this change: board-loading's two cross-branch cases, atomic task editing, and the web 409 contention case. None of them touch the files here.

Second review round, all three from live use of the TUI:

1. Quitting left the shell hanging. Cause: `createScreen` deliberately skips `Program.prototype.destroy` (the blessed program is process-wide and must survive between screens), and that destroy is the only thing that restores stdin — it runs `input.setRawMode(false)` and `input.pause()`. So the screen came down but raw mode stayed on. The host now closes with `screen.leave(); screen.destroy(); releaseSharedProgram();`, the same teardown decision-list-viewer, document-list-viewer and scrollableViewer use. Covered by a test that asserts the shared program is destroyed after a quit.

2. With the keyboard on the milestone list, the board's first column was still lit yellow. That was the board's own focus cue (`setColumnActiveState` painted the focused column's border yellow) with no idea who owned the keyboard. The border colour is now derived from `isScopeActive()` via one `columnBorderColor(index)` helper, and `updateFooter()` re-derives both the area frame and every column border so a scope change takes effect when the host calls `syncChrome()`.

3. The filter bar now ends with a task count. `FilterHeader` takes an optional `summary` and exposes `setSummary()`; the board fills it from `embed.taskSummary` with `<shown>/<total> tasks`, refreshed in `renderView()` from the same filtered list it renders. Shown as `3/5 tasks` (filtered/total) per the user's choice. The text sits right-aligned on the bar's title line in a child box at `top: -1, right: 2, shrink: true`.

Tests: milestones-tui 11/11, including the new terminal hand-back case, the column/frame border colours at each focus position, and the summary counts for an unfiltered scope (2/2) and a searched one (1/2).

Third review round, both from live use:

1. Enter on a milestone showed nothing until the next keypress. The popup built all of its boxes but never repainted the screen, and the host does not render on Enter, so the window only appeared when some later key forced a render. `createMilestonePopup` now renders in its layout step and again once the body has focus. The task detail popup never had this because its own `applyLayout()` renders. The regression test counts `screen.render()` calls across the Enter; stripping both renders makes it fail (13 -> 13), which is how the symptom was reproduced.

2. The popup had no black backdrop. It now creates one exactly as the task detail popup does — black box behind the popup, geometry derived from the popup's own on open and on every resize, listener removed on close — so the view behind it is dimmed.

Also repaired: an editing slip left src/ui/milestones.ts with CRLF line endings, which .gitattributes (eol=lf) and Biome both reject. The file is LF again and every touched file now checks clean.

Tests: milestones-tui 11/11 (the popup test now asserts it repaints and that the backdrop appears and goes away), bunx tsc --noEmit clean, biome clean on every touched file.

Fourth review round, both from live use:

1. The right-hand frame now names the milestone the board is scoped to (`Tasks · Alpha rollout`), so the columns stay identifiable after the cursor moves up into the filter bar to pick a priority. `BoardEmbedOptions.areaLabel` became a provider (`() => string`) read during the board's chrome sync, which is what lets the title follow the host's selection.

2. The milestone list now re-counts itself from the tasks the board is actually showing, so changing a priority, label or search updates the numbers on the left. Rows still come from the whole corpus — picking a milestone has to reach all of its work — while the done/total and the unassigned total come from the same buckets narrowed by the board's filters. Rows therefore never appear or disappear when a filter changes, and the completion marker still reflects the milestone's real tasks.

To keep the filter semantics in one place the board reports its visible set through a new `BoardEmbedOptions.onVisibleTasks` hook (called from `renderView`), rather than the host subscribing to filter values and re-applying `applySharedTaskFilters` plus its own search matcher. The host guards its re-count with an `id:status:milestone` key so an ordinary repaint does not churn the list's items, while a task changing status still re-counts.

Tests: milestones-tui 12/12. The scoping test asserts the frame names both a normal and a completed milestone; a new test drives the search box from the keyboard (board takes focus, then `/`, type a query, commit on the way out) and asserts the list lands on `m-0 Alpha rollout · 0/1`, `m-1 Beta polish · 0/0` and `No milestone · 0`. bunx tsc --noEmit clean, biome clean on every touched file, and the CLI's --plain and non-TTY paths still print the text summary.

Fifth review round: the list now separates the cursor from the scope, so the filter bar can be reached from the milestone list without changing what the columns show.

- Arrow keys (↑/↓, j/k) only move the cursor. Space scopes the board to the highlighted milestone. The scoped row is prefixed "▶ " so the two states are distinguishable, the frame's "Tasks · <name>" names the scope rather than the cursor, and a new board task still defaults to the scoped milestone.
- ↑ on the top row leaves the list upward for the filter bar. It uses a new BoardHandle.focusFilters() (what "/" does) plus the same keyboard handoff "→" uses, so the scope and the cursor are untouched while a priority is picked. Coming back is filter bar → ↓/Esc → board → ← → list.
- The list still opens on the unassigned bucket, cursor and scope together, which is the "default to No milestone" the review asked for; the top filter bar keeps controlling every count on both surfaces.

Tests: milestones-tui 13/13. The new case walks the cursor down and asserts the ▶ marker, the frame title and the board stay put, presses Space and asserts they all move, then walks to the top row and out into the filter bar (the board's own filter footer appears, the scope is unchanged). The board/help suites stay at 79/79, bunx tsc --noEmit is clean and biome is clean on every touched file.

Round 6 — the list counted only the scoped milestone.

Report: every milestone row read 0/0 while the board sat on the unassigned bucket. Cause: round 4 fed the numbers from `BoardEmbedOptions.onVisibleTasks`, i.e. from what the board shows, and the board's visible set is already narrowed to the scoped milestone — counting the scope with the scope zeroes every other row and makes a global filter bar behave per milestone.

Fix:
- `src/ui/board.ts` — the header pipeline is now an exported pure function, `filterBoardTasks(tasks, filters, {searchMatch, resolveMilestoneLabel})`, with `BoardFilterState` as its input and the `onFilterChange` payload. The board's own `getFilteredTasks` and `hasActiveSharedFilters` are one-liners over it, and the search index is only built when the board resolves the query itself.
- `src/ui/milestones.ts` — the host holds `corpus` (the caller's snapshot, folded up to date from the board's reports) and the header filters. Rows come from the whole corpus, the numbers from `buildMilestoneBuckets(filterBoardTasks(corpus, headerFilters))`. `refreshCounts` repaints only when a label actually changed, so ordinary board repaints no longer churn the list's items, cursor or scroll position.
- `searchMatch` now resolves the query against the whole corpus and intersects with the caller's tasks — the web milestone page's contract. Searching the board's own scope let Fuse's fuzzy step return a one-task scope's only document, so the columns and the numbers disagreed.

Evidence: a new test reproduced the report (`Expected "m-0 Alpha rollout · 0/2" / Received "… · 0/0"`) under the old logic, and a headless probe against this repository printed `▶ No milestone · 355 / ✔ m-6 · 3/3 / ✔ m-7 · 9/9 / ✔ m-8 · 6/6` (373 tasks in total). Known limitation, unchanged: a task archived or deleted on the board keeps its old row count until the view is reopened, because the corpus is refreshed by folding reports in rather than by re-reading tasks.

Validation: bunx tsc --noEmit clean; biome clean on every touched file; milestones-tui 15/15; board/filter/web-milestone/cli-milestone batch 141/142, the single failure being a 5 s timeout under parallel load (21/21 when that file runs alone).

Round 7 — the filter bar's summary counted the scope twice.

Report: "目前统计的左右两个数字都是一样的，右边应该是总数不变的。" The bar read `355/355 tasks`: its denominator was `currentTasks.length`, i.e. the board's own scope, so with no filter active the two numbers always matched and the "total" silently moved when the user switched milestone.

Fix: `BoardEmbedOptions.summaryTotal?: () => number` in `src/ui/board.ts`, used by `taskSummaryText` in place of the scope size when present; the milestone view passes `() => corpus.length`. It is the corpus rather than the caller's snapshot because the corpus is what grows when the board creates a task — a total must never shrink behind the user's back. The standalone board is untouched (no `embed`, and `taskSummary` still gates the summary itself).

Real repo now: frame `Tasks · No milestone` with `355/373 tasks`, sidebar row `▶ No milestone · 355`.

Tests: the contract is pinned from four states — `1/5 tasks` on open, `2/5 tasks` scoped to Alpha, `1/5 tasks` after searching TASK-1 inside Alpha, `0/5 tasks` searching a task that lives outside the scope. The first number follows the filters, the second never moves. milestones-tui 15/15; the nine board/filter/web suites re-run after the board change: 79/79; tsc and biome clean.

Round 8 — the TUI suite's fixed sleeps replaced by state waits.

A single run of `milestones-tui` failed once during a command chain that also ran `tsc`, then passed five runs in a row. The sleeps that only existed to let a key handoff settle are now waits on the state each assertion is about (`waitUntil` from `src/test/test-utils.ts`, bounded at 2 s so a failure stays under bun's 5 s per-test limit): the board footer showing `[Tab]`, the input capturing keys, the re-counted sidebar row, the prompt closing, the new milestone row.

That first attempt exposed a real blessed quirk worth recording: `textbox.readInput()` sets `screen.grabKeys` synchronously but attaches its character listener inside a `nextTick` afterwards, so characters sent in that gap are dropped — waiting on `grabKeys` alone made the tests type earlier than the sleep had, and the search box stayed empty. The file now has `isInputCapturing(screen)` and `typeIntoInput(screen, text)`, which retypes each character until the input's `value` actually grows. Also fixed my own slip in the create-milestone test: creation is asynchronous, so the sidebar row is what proves it landed, not the prompt closing.

Verification: four clean sequential runs, then 15/15 with the suite running while board-tui-move/board-ui/board-render/cli-milestone-management loaded the machine (51/51 for those) — the condition the flake appeared under.

Round 9 — a milestone row's two numbers came from one bucket.

Report: "搜索之后，右侧统计数字与左侧一样，一同缩小了", then "是不是使用了同一个字段？" — exactly right. `formatRowLabel` read `shown.doneCount` and `shown.total`, both from the bucket narrowed by the header filters, so a search shrank the pair together and any milestone with no match collapsed to `0/0`.

Fix: the left number is the tasks the filters keep (`shown.total`), the right one is the milestone's own size (`bucket.total`). The user chose that meaning from three renderings (progress pinned / matched count / progress plus a hint). Title and completion marker keep coming from the full bucket, so `✔` describes the milestone and not the filtered view of it.

Real repo, before and after searching "gantt" (the filter bar's summary moved `355/373` → `0/373`, its denominator unchanged):

```
▶ No milestone · 355            ▶ No milestone · 0
✔ m-6 New Milestones UI · 3/3   ✔ m-6 New Milestones UI · 0/3
✔ m-7 GanttView · 9/9           ✔ m-7 GanttView · 7/9
✔ m-8 Agent CLI Workflow · 6/6  ✔ m-8 Agent CLI Workflow · 0/6
```

Deliberate trade-off: with no filter active the left number equals the right one for every row, because "how many are shown" and "how many exist" are the same statement then. The unassigned row keeps a single number, having no completion pair to split.

Validated: milestones-tui 15/15 (the three counting cases now assert `1/2`/`0/1` after a TASK-1 search, `2/2`/`1/1`/`1/1` unfiltered, and `0/2`/`1/1`/`0/1` for a search outside the board's scope — the last proves each row counts its own matches while its right number stays the milestone's size); help-popup plus the web milestone search suite 29/29; bunx tsc --noEmit and biome clean.

## Round 10 — where the detail comes from, and editing it

From live use: "里程碑详情的detail是哪里来的？新建里程碑的时候怎么没有描述？能不能加上那些时间的字段编辑？"

Where the data comes from: the popup renders only what the milestone markdown file holds — the frontmatter dates (created_date, updated_date, due_date, planned_start/planned_end, actual_start/actual_end) and the body of its ## Description section, read by parseMilestone (src/markdown/parser.ts). It invents nothing. A new milestone had no description because N asked for a title alone and createMilestone(title) then wrote the placeholder "Milestone: <title>" into ## Description.

So both halves became one form, src/ui/components/milestone-form.ts, which is the single implementation behind creating and editing:
- Fields in order: Title (create only), Description, Due, Planned from, Planned to, Actual from, Actual to — the same set the web MilestoneAddModal collects and the detail popup displays. Tab and up/down move between fields, Enter saves from any of them, Esc cancels. The description is the one multi-row field (bordered, 3 rows); the rest are single-row inputs with a label column.
- N opens the form empty and writes through core.filesystem.createMilestone(title, toMilestoneWriteOptions(values)); the detail popup gained an "E Edit" action that opens the same form seeded from the milestone and writes through core.updateMilestone(id, title, options, false). The explicit false keeps this view from committing: an in-place edit is not a rename, so letting core.updateMilestone commit would label a date change "Rename milestone".
- Dates are validated as YYYY-MM-DD or YYYY-MM-DD HH:mm (the two shapes the frontmatter keeps) and reported by field name; a field the user emptied clears the value instead of keeping a stale one. Empty is also how create and update mean "no date", so no placeholder dates are written.
- The title is deliberately not editable there: the milestone file is named after it, so renaming moves a file and stays with backlog milestone edit --title. Documentation editing likewise stays with --doc and the web modal.
- The form keeps the old title prompt discipline: endInputRead() ends any read before the widgets are destroyed, because a field still reading holds screen.grabKeys and every later keypress — the host quit included — would be dead.
- Also: an E row in the milestones help, a "Browse milestones" row in CLI-INSTRUCTIONS.md, and the popup advertises the editor next to its Esc badge.

Verified on this repository through a throwaway probe that dumped the form widget tree: opening m-7 (planned 2026-05-25 → 2026-05-31, actual 2026-05-25 16:00 → 2026-05-28 17:17) shows "Edit Milestone" with Description seeded "Milestone: GanttView" and the five date fields in order, and Esc leaves without writing (m-7 keeps its due date). milestones-tui 22/22 (5 new UI cases plus 4 unit cases pinning the date grammar, field-named errors, the duplicate-title rule and the trimming); help-popup 17/17; tsc and biome clean. mcp-milestones has one pre-existing failure in this workspace — "Git command failed (exit code 128): git branch --show-current / fatal: not a git repository" — the missing git worktree admin directory recorded in earlier rounds, untouched by this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the plain-text milestone list with an interactive milestone board TUI (bun run cli milestone list).

What changed:
- src/ui/board.ts: optional embed (BoardEmbedOptions) and visibleFilters; one keysActive() guard for every board key so a host pane can hold the keyboard; the host's sidebar inset kept aligned with the board chrome; a frame around the columns (areaLabel) that is highlighted only while the board holds the keyboard; a BoardHandle (focusBoard, syncChrome). With no embed the board is unchanged.
- src/ui/milestones.ts (new): the two-pane view. The sidebar is the unassigned bucket followed by every milestone in milestone-file order with completed ones marked; the highlighted row drives the board; Enter opens a metadata-only milestone popup (no task list); N creates a milestone on the list and a task defaulting to the selected milestone on the board.
- src/utils/milestone-search.ts (new) plus src/web/components/MilestonesPage.tsx: one milestone search contract for the TUI header and the web page, so a query means the same thing on both and survives switching milestones.
- src/cli.ts: the TUI by default on a TTY; --plain and non-TTY stdout keep the text output, where --show-completed still applies.
- src/ui/components/help-popup.ts: a milestones help context.

Verified: bunx tsc --noEmit clean; biome clean on every touched file; 10/10 milestone TUI tests; 51/51 board suites re-run after the final change plus the rest of the board batch; 35/35 web milestone search, help popup and cli milestone management; the --plain and piped paths still print the text summary. repo-wide bun run check . still reports three pre-existing issues in untouched files (src/core/assets.ts, src/utils/task-path.ts), so that DoD item is left unchecked.

Note: this workspace's git worktree admin directory is missing (D:/git/Backlog.md/.git/worktrees/1.52-milestone), so git commands inside the workspace fail; the git-dependent tests (board-loading cross-branch, atomic task editing, the web 409 case) fail for that reason alone.

Follow-up round from live use: quitting no longer leaves the shell hanging (the host now releases the process-wide blessed program, which is what restores stdin), the board's column highlight stands down while the milestone list holds the keyboard, and the filter bar ends with a '<shown>/<total> tasks' count.

Third review round: the milestone detail popup now repaints as soon as Enter opens it (it previously needed another keypress to appear) and draws the same black backdrop as the task detail popup.

Fourth review round: the columns frame now names the scoped milestone ('Tasks · <name>') so it stays identifiable from the filter bar, and the milestone list re-counts itself from the tasks the board's filters leave (new BoardEmbedOptions.onVisibleTasks hook), so changing a priority or search updates the numbers on the left.

Fifth review round: the milestone list separates the cursor from the scope — arrows only move, Space scopes the board (the scoped row is marked ▶), and ↑ on the top row steps up into the filter bar without changing the milestone, so a priority can be changed while the columns keep their milestone.

Round 6: every milestone row now counts its own tasks under the header filters instead of only the scoped milestone's (which left the other rows reading 0/0); the header pipeline became the shared filterBoardTasks helper, and the milestone search resolves against the whole corpus so the columns and the numbers agree.

Round 7: the filter bar's <shown>/<total> tasks summary now counts against the whole task total (new BoardEmbedOptions.summaryTotal) instead of the board's scope, so its second number no longer matches the first at rest or moves when the milestone selection changes.

Round 9: the milestone list's left number is now the tasks the header filters keep while the right one stays the milestone's own total (they previously both came from the filtered bucket, so a search shrank them together).

Round 10: the new-milestone flow is now a form (src/ui/components/milestone-form.ts) that captures the description and the five dates the detail popup displays, and the detail popup's E reopens that same form seeded from the milestone to edit them; the title stays read-only there because the milestone file is named after it.
<!-- SECTION:FINAL_SUMMARY:END -->

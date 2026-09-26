---
title: BACK-687 CLI TUI — Replace milestones list with an interactive milestone board view
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - cli
  - tui
  - milestones
source_path: backlog/tasks/back-687 - CLI-TUI-Replace-milestones-list-with-an-interactive-milestone-board-view.md
---

# BACK-687 CLI TUI — Replace milestones list with an interactive milestone board view

`backlog milestone list` was a static counts dump. This task replaces it with a two-pane interactive TUI — milestone list on the left, the real kanban board scoped to the selected milestone on the right, one shared filter bar on top — while `--plain` and non-TTY stdout keep the text output. Shipped over ten review rounds driven by live use.

## Summary

- `src/ui/board.ts`: optional `BoardEmbedOptions` embed and `visibleFilters`; one `keysActive()` predicate routes every board key so a host pane can hold the keyboard; host sidebar inset kept aligned with board chrome; columns framed via `areaLabel` (a provider, so the frame title follows the selection: `Tasks · <name>`); `BoardHandle` (`focusBoard`, `syncChrome`, `focusFilters`); with no embed the board is unchanged
- `src/ui/milestones.ts` (new): sidebar lists the unassigned bucket first then every milestone in milestone-file order (completed marked, none hidden); arrows move only the cursor, Space scopes the board (scoped row prefixed `▶ `); Enter opens a metadata-only milestone popup (no task list); N creates a milestone on the list and a task defaulting to the scoped milestone on the board
- `src/utils/milestone-search.ts` (new): one milestone search contract shared by the TUI header and `MilestonesPage.tsx` (exact id → substring → shared fuzzy index), resolved against the whole corpus and intersected with scope so columns and counts agree
- `src/ui/components/milestone-form.ts` (round 10): one form behind both creating and editing — Title (create only), Description, Due, Planned from/to, Actual from/to; dates validated as `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`; detail popup's E reopens the form seeded; title deliberately read-only (the file is named after it); writes through `createMilestone` / `core.updateMilestone(id, title, options, false)` — the explicit `false` keeps an in-place edit from committing as "Rename milestone"
- Review-round fixes: quitting releases the process-wide blessed program (`releaseSharedProgram`) so stdin raw mode is restored; column border color derived from `isScopeActive()` so the non-keyboard pane is not yellow; milestone popup renders on open and draws the same black backdrop as the task popup; filter bar ends with `<shown>/<total> tasks` where total is the whole corpus (`BoardEmbedOptions.summaryTotal`); row counts split into filtered-shown vs milestone-total via exported pure `filterBoardTasks`
- Blessed quirks recorded: `textbox.readInput()` sets `screen.grabKeys` synchronously but attaches its char listener in a later nextTick (typed chars in the gap are dropped — tests retype until the value grows), and tearing down a prompt still reading leaves every later keypress dead
- Environment caveat: this workspace is a git worktree whose admin dir is missing, so git-dependent tests fail for that reason alone; repo-wide `bun run check .` kept pre-existing errors in untouched files (DoD #2 left unchecked)
- Tests: `src/test/milestones-tui.test.ts` grew to 22 cases through the rounds; board/help/web-milestone/cli-milestone suites green; fixed sleeps replaced by state waits (`waitUntil`)

## Acceptance Criteria

- TTY launches the TUI; `--plain`/non-TTY keep text output with `--show-completed` semantics
- Two panes, selection drives the board, focus moves with arrows/j/k; right pane reuses the real board so columns, shortcuts and filters match `task list`; Enter on a milestone opens metadata-only detail; Enter on a task opens the existing task popup
- Filter bar spans both panes (Search/Priority/Labels, no milestone filter), matches like the web milestone page, and stays applied across selection changes; `<shown>/<total>` summary counts against the whole task total
- List = unassigned bucket first then milestones in file order; each row shows its own done/total under the active filters; N creates milestone/task; only the keyboard-holding pane is highlighted

## Related Concepts

- [[concepts/milestones]] — the milestone model and bucket ordering this view renders
- [[concepts/cli-tui]] — board embedding, keyboard ownership, and blessed teardown discipline
- [[concepts/date-fields]] — the five milestone dates the form captures and validates

## Related Sources

- [[sources/back-686-shared-search-consumers]] — supplies the shared milestone search contract the header bar uses
- [[sources/back-688-milestones-plain-grouped-output]] — follow-up restoring grouped plain-text output under the same entry point
- [[sources/back-575-doc-list-interactive-browser]] — earlier interactive list viewer with the same teardown pattern

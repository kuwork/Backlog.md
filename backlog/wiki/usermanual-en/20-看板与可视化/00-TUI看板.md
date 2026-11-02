---
title: TUI Board
labels: [usermanual]
created_date: 2026-05-07 00:00
updated_date: 2026-11-04 00:00
---

# TUI Board

Run `backlog board` in the terminal to start a character-based interactive board. The board displays tasks grouped by status, and supports keyboard navigation, moving tasks, real-time filtering, and file watching—so you can keep track of the whole project without leaving the terminal.

## Launching the Board

```bash
backlog board
```

On first launch, the board loads the status columns from the project configuration and places tasks into the matching columns. Legacy string-config projects default to three columns: `To Do`, `In Progress`, `Done`; newly initialized projects use the built-in seven-state default state machine (see [Task Lifecycle](../10-任务管理/00-任务生命周期.md)). Statuses with `display: false` are hidden together with their tasks. If milestone mode is enabled, tasks are grouped by milestone.

### Common Startup Options

```bash
# Vertical layout (status columns stacked vertically; good for narrow terminals)
backlog board --vertical

# Explicitly set the layout direction
backlog board --layout vertical
backlog board --layout horizontal

# Milestone grouping mode (tasks shown in milestone swimlanes)
backlog board --milestones
```

## Keyboard Navigation

Once the board is running, use these keys:

| Key | Action |
|-----|--------|
| `↑` `↓` `←` `→` | Move the selection focus on the board |
| `Enter` | Open the detail popup for the selected task |
| `N` | Open the task creator and create a task directly in the board |
| `E` | Open the current task file in the system editor (the TUI suspends and resumes after you close the editor) |
| `Tab` | Switch between board view and task list view |
| `M` | Enter / confirm board move mode |
| `PageUp` / `Ctrl+U` | Scroll the list / scrollable area up one page |
| `PageDown` / `Ctrl+D` | Scroll the list / scrollable area down one page |
| `Home` | Jump to the top of the list / scrollable area |
| `End` | Jump to the bottom of the list / scrollable area |
| `H` `J` `K` `L` | Vim-style navigation (available alongside arrow keys) |
| `Q` | Quit the board |

> **Tip**: When you press `E` to edit a task, the TUI suspends and resumes automatically; you do not need to restart the board.

When `E` is pressed, the system opens the file based on the **actual file location of the row**: rows in the drafts directory open the draft file, and rows in the tasks directory open the task file—even if the file's `status` field no longer matches the directory (for example after demotion). The prompt text (task / draft) matches the actual object being edited.

### Vim Key Family and Boundary Behavior

The list components support both arrow keys and vim keys (`h`/`j`/`k`/`l`). The **boundary semantics** are the same for both:

- When you reach the top or bottom of a list, the behavior depends on the panel: it may stop at the boundary, scroll a page, or jump to an adjacent panel—rather than silently doing nothing.
- The same rule applies to composite lists such as filter popups, where vim keys also work.
- No configuration is required: vim keys are enabled by default and coexist with arrow keys.

## Creating Tasks in the Board

Press `N` to open the task creator directly inside the board, without leaving the TUI or switching to the Web interface:

- Fields: Title, Description, Status (including Draft and workflow statuses), Priority, and five date fields—Due, Planned from/to, Actual from/to; dates must be `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`, and invalid dates are rejected with focus returned to the offending field.
- Use arrow keys to move between fields; `Tab` / `Shift+Tab` also switches fields.
- After creating a non-Draft task, it is inserted into the board immediately and focused.
- After creating a Draft task, the UI tells you that drafts are not shown on the board.
- The creator is always available, even when the board is empty.

### Creator Interaction Details

- **Mouse support**: Click Title / Description / Status / Priority fields to focus them or open selectors.
- **Extreme terminal sizes**: Popup height and width adapt to the actual screen; input boxes remain editable on terminals as short as ~8 rows. Width is computed dynamically from the configured status / priority label lengths; very long status names automatically switch to a compact stacked layout.
- **Unicode-safe input**: Inserting or deleting text next to astral characters (such as rare CJK characters) does not cause garbled output or cursor misalignment; wide characters are measured as two display cells (emoji are also treated as double-width).

### Draft Session

The interactive interface of `backlog draft list` is a board session whose corpus is drafts:

- Pressing `N` opens the creator with status fixed to Draft; the title shows "Create Draft" and the fields are identical to the task creator (including dates).
- The session watches the `backlog/drafts/` directory in real time: external edits and deletions are reflected immediately; drafts promoted to tasks disappear from the session automatically.
- The task board session never shows draft files.

## Board Move Mode

Move mode lets you change task status directly in the terminal:

1. Use arrow keys to select the task you want to move.
2. Press `M` to enter move mode; the current task is marked as pending move.
3. Use `←` `→` to choose the target status column, and `↑` `↓` to adjust the insert position.
4. Press `M` or `Enter` again to confirm; the task status is updated immediately and synced to the Markdown file.
5. Press `Esc` to cancel the move and restore the original position.

> **Note**: Cross-branch tasks from other branches cannot be moved directly in the board; the system explains why in the bottom status bar.

### Multi-Select Move (Shift + Arrow Keys)

Move mode supports moving several tasks at once:

1. After entering move mode with `M`, use `Shift+↑` / `Shift+↓` to move the highlight in the target column without affecting board order.
2. Press `M` (or `Shift+M`) to **recruit** the highlighted task into the move set; terminals that do not support Shift-arrow keys can use this key to recruit neighboring tasks.
3. After recruiting, the first normal arrow key collapses the highlight and previews the whole group landing as an adjacent block; confirming writes all tasks at once.
4. During the write, arrow keys and cancel keys are frozen; a move that lands in the original position is a no-op. Per-task failures are reported in the bottom status bar.

Cross-branch tasks cannot be recruited. Confirmation is debounced so pressing Enter repeatedly does not submit more than once.

## Task List and Filtering

Press `Tab` to switch from the board to the task list view. The list view supports finer-grained filtering:

- **Status filter**: show only tasks with a specific status.
- **Assignee filter**: filter by `@username`.
- **Label filter**: multi-select filtering by label.
- **Milestone filter**: show only tasks belonging to a given milestone.
- **Priority filter**: high / medium / low.
- **Search box**: real-time fuzzy matching against task titles and descriptions.

At the bottom of the list view, open the filter panel with the corresponding shortcut; the list refreshes instantly as you check conditions. Filter conditions are shared between board view and list view and remain active when you return to the board.

### Compact View

When terminal height is limited, the list view automatically switches to compact mode, hiding some metadata and keeping only task ID, title, and status so you can still browse many tasks in a small terminal window.

## Milestone Board View

`backlog milestones` provides a dual-column layout with a sidebar plus an embedded board:

- The **left sidebar** lists the "Unassigned" bucket and all milestones (including completed markers). Use `↑` / `↓` to move the cursor, `Space` to restrict the board to that milestone (an `▶` appears at the start of the row), and `Enter` to open the milestone detail popup (metadata only, no task list).
- The **right side** is the full board; keyboard focus routes between the board and the sidebar. The filter bar shows `<currently shown>/<total tasks>`.
- `N` creates a milestone when the sidebar is focused, and creates a task (defaulting to the currently restricted milestone) when the board is focused. In the milestone popup, `E` opens an edit form (title, description, Due, Planned / Actual start/end; dates must be `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`; the title is read-only after creation).
- Milestone and task changes are synced live: externally edited milestones refresh the popup in place; archived or deleted milestones close the popup with a notice.

In non-TTY environments, `backlog milestones list --plain` outputs a Markdown grouped board consistent with `backlog board -m` ("No Milestone" first, then sections by milestone file order, with tasks grouped by status inside each section). Use `--show-completed` to include completed tasks.

## Real-Time File Watching

The TUI board uses filesystem watching (`Bun.watch`) and refreshes automatically when:

- A task status is changed in the Web UI or another terminal.
- A task is updated via the `backlog task edit` command.
- An AI agent modifies a task file through MCP tools.

This means you can have the TUI board and the Web interface open at the same time, and changes on either side are synced to the other in real time.

Real-time refresh is resilient to atomic writes: the CLI may trigger brief partial-content events when writing task files, and the TUI waits for the file to stabilize before refreshing, avoiding reads of incomplete task content. The selected task remains valid after refreshes, moves, archives, or deletions; after deletion, the adjacent task is automatically selected.

**Syncing of already-open popups**: Task popups and milestone popups are also "live"—when content is modified externally, they re-render in place after comparing content signatures. When a record moves out of the current view, the popup closes with a notice. Refresh events that produce no change (for example an echo from saving inside the popup) do not cause flicker or rebuild.

## Acceptance Criteria Progress Indicator

Tasks in **In Progress** that contain acceptance criteria (AC) show an ASCII progress bar on the board row, such as `[#####-----] 5/10`:

- Uses only ASCII characters `#` (done) and `-` (not done), so every terminal font renders it correctly.
- Shows a 10-cell bar when the column is wide enough, and a 5-cell bar when narrower than 40 columns.
- Color by completion: green when fully complete, red when below one-third, yellow otherwise; at least one cell is shown as soon as any item is checked.
- Derived live from acceptance criteria and not persisted; tasks without AC or not in In Progress do not show it.
- The task detail panel no longer shows the progress bar, only the checklist itself—the board row is the single place for progress.

## Help Popup

Press `?` to open the help popup: its height adapts to the terminal size (never exceeding the screen) and re-layouts live when the terminal is resized; the scroll limit is computed from the actual rendered rows so wrapped explanatory text can still be scrolled to the end on narrow terminals. The backdrop of the task detail popup also re-layouts live with terminal size, leaving no misaligned leftover areas after resizing.

## Theme Adaptation and Stable Switching

The TUI board renders with terminal theme adaptation to avoid readability problems from hard-coded ANSI colors:

- Most control borders use the terminal default color and follow the current color scheme.
- The cyan highlight for board move mode is preserved as a recognizable marker for the task being moved.
- Long lists and scrollable areas support `PageUp` / `PageDown` / `Home` / `End` for quick positioning and show a scrollbar indicator.

`Tab` switching between board and list view is stability-hardened: stdin input is not lost and duplicate listeners do not accumulate, so switching in either direction is reliable.

## Dependency Readiness Hint

The task detail panel shows a readiness determination for **tasks that have dependencies**:

- `✓ Ready to start` — all dependencies are ready, work can begin immediately.
- `● Blocked by <ID>` — at least one dependency is not yet complete or cannot be resolved.

The determination is fail-closed: incomplete dependency data, cycles, or ambiguous references are all treated as blocked, never guessed. The same determination appears in the Web task detail Dependencies card, the Web task detail status badge, `backlog task list --ready`, and the MCP `task_list` `ready: true` parameter. It is for display and filtering only; it does not modify tasks or change ordering.

## Hide Empty Status Columns

The board can hide status columns that currently contain no tasks, reducing visual clutter:

- Uses the shared configuration key `hide_empty_columns` (the same switch as the Web interface).
- When toggled inside the board, the UI reflects the change immediately (optimistic update) and writes the configuration asynchronously.
- When exiting the TUI, it waits for pending writes to finish so the configuration is not lost.
- All status columns remain visible during drag / move operations so they can serve as valid drop targets.

## Window Title

When entering the TUI, the terminal window title is updated to include the project name; the original title is restored on exit. Title push/pop is strictly paired and works correctly in nested terminals such as tmux by passing through the escape sequences.

## Key Hint Convention

Key hints in the bottom footer and help panel consistently use **uppercase letters** for pressable keys (for example `N` to create, `E` to edit, `M` to move), avoiding confusion from mixed-case labels. Footer text is centralized as constants to prevent wording drift between views.

## Plain-Text Fallback in Non-Terminal Environments

When `backlog board` runs in a non-TTY environment (such as a CI pipeline, script pipe, or IDE integrated terminal), it automatically falls back to plain-text output, printing a structured Markdown board table instead of launching the interactive interface:

```bash
# Check board status in CI
backlog board > board-status.md
```

The plain-text output includes the project name, timestamp, task lists for each status column, and metadata such as assignees and labels, making it easy to archive or share by email.

## Running Multiple Views at the Same Time

`backlog board` and `backlog browser` can run in parallel. The terminal board is good for quickly checking status while focused on coding; the Web interface is better for detailed editing and drag-and-drop operations. Both share the same data.

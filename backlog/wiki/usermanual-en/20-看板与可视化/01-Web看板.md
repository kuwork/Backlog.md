---
title: Web Board
labels: [usermanual]
created_date: 2026-05-07 00:00
updated_date: 2026-11-04 00:00
---

# Web Board

Run `backlog browser` to start the browser-based visual task-management interface. The Web board is built with React + Tailwind CSS v4 and supports drag-and-drop, milestone swimlanes, label filtering, and real-time sync. It is the preferred tool for team collaborators and users who prefer a graphical interface.

## Starting the Web Interface

```bash
# Default startup: port 6420, opens the system default browser automatically
backlog browser

# Use a custom port
backlog browser --port 8080

# Start without automatically opening the browser (good for remote servers or background use)
backlog browser --no-open
```

After startup, the terminal prints the service address, for example `http://localhost:6420`. Press `Ctrl+C` (or `Cmd+C`) to stop the service.

> **Tip**: You can change the default behavior through the `autoOpenBrowser` and `defaultPort` configuration values; see the Configuration Management chapter.

## Board View

After opening the Web interface, you enter the board view by default. The interface is divided into columns by status, each showing task cards for that status:

### Drag-and-Drop

- **Move across columns**: Hold a task card and drag it to the target status column to change the task status.
- **Reorder**: Drag a card up or down within the same column to adjust its displayed order on the board.
- **Undo support**: All drag-and-drop operations are written to the Markdown files in real time and can be traced back through Git.

### Milestone Swimlanes

When the milestone view is enabled, the board groups task cards by milestone inside each column. Tasks belonging to the same milestone cluster together, forming clear horizontal swimlanes that make it easy to track progress by iteration or version.

### Label Filtering

A label filter dropdown at the top of the board lets you check the labels you want; the board instantly filters to show only tasks with matching labels. Multi-label combination filtering is supported.

## All Tasks View

Click "All Tasks" in the navigation bar to switch to a table layout:

- Supports multi-dimensional filtering by status, priority, label, and milestone.
- Click table headers to sort.
- The search box at the top is a trigger button: click it or press Ctrl+K / Cmd+K to open the global search dialog (Fuse.js fuzzy matching, results grouped by type, keyword and ID highlighted).

## Gantt Chart View

Click "Gantt" in the navigation bar to enter the timeline visualization page:

- Two-column layout: task list on the left, timeline on the right.
- Five time granularities (day / week / month / quarter / year).
- Automatically parses task start/end times (`plannedStart` / `plannedEnd` / `createdDate`).
- Task dependencies are visualized with SVG arrows.
- Supports dragging to pan the timeline.

See the [Gantt Chart View](../40-Web界面/09-甘特图视图.md) chapter for details.

## Milestone Management Page

The "Milestones" page in the navigation bar provides full milestone lifecycle management:

- **Create milestone**: Click the "Add Milestone" button and enter a name.
- **Milestone details**: Each milestone card shows the number of assigned tasks and completion progress.
- **Drag-and-drop assignment**: Drag tasks from the unassigned pool to a target milestone, or remove them in the opposite direction.
- **Completion detection**: When all tasks under a milestone enter the `Done` status, the system automatically marks the milestone as completed.
- **Completed milestones**: By default, completed milestones are collapsed at the bottom of the page to reduce visual clutter.

## Documents & Decisions

The Web interface also provides read-only browsing of the project knowledge base:

- **Document list**: Groups and displays all documents under `backlog/docs/` by subfolder; click a title to view the rendered Markdown content.
- **Decision records**: Displays ADR decisions from `backlog/decisions/`, including status labels and creation time.

## Real-Time Updates

The Web server broadcasts file changes to all connected clients through WebSocket:

- After modifying a task with `backlog task edit` in the terminal, the browser board refreshes automatically within about one second.
- When editing a task in the Web interface, if another user or process modifies the same file at the same time, the interface merges changes intelligently to avoid overwriting.
- Draft preservation: content that is being edited but not yet saved is kept after a file refresh and is not lost.

## Dark Mode and Responsiveness

The Web interface follows the system theme for dark mode and also supports manual switching. The layout is responsive for desktop and mobile:

- **Desktop**: multi-column board side by side, suitable for large screens.
- **Mobile**: single-column stacked layout, supporting touch swiping and long-press dragging.

## Mermaid Diagrams and Attachments

If task Markdown contains Mermaid syntax, the Web interface renders it as flowcharts, sequence diagrams, or Gantt charts. Images and attachments in the `backlog/assets/` directory can be previewed directly in task details through relative paths.

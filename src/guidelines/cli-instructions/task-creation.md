## Task Creation Guide

Use this guide when `backlog instructions` or the user indicates that new Backlog tasks are needed.

### Step 1: Search First

Always check whether the work is already tracked.

Recommended CLI commands:

- `backlog search "desktop app" --plain`
- `backlog task list --status "<todo status>" --plain`
- `backlog task list --status "<active status>" --plain`
- `backlog task list --search "desktop app" --labels frontend,bug --limit 20 --plain`

Avoid broad unfiltered listing when the project may have many tasks. Use `--status`, `--assignee`, `--parent`, `--priority`, `--labels`, `--search`, or `--limit` where applicable.

Use `backlog task view {{TASK_ID:123}} --plain` to read full context for likely matches.

### Step 2: Assess Scope Before Creating Tasks

Decide whether the request is:

- A single atomic task that can be completed in one focused PR.
- A multi-task feature or initiative that needs subtasks or dependencies.

Ask:

1. Can this be completed in a single focused pull request?
2. Would a reviewer be comfortable reviewing all changes at once?
3. Are there natural independent delivery points?
4. Does the work span multiple subsystems, layers, or ownership areas?
5. Are multiple tasks likely to touch the same component?

### Step 3: Choose Task Structure

Use subtasks when the work shares one goal and one subsystem:

```bash
backlog task create "Desktop application"
backlog task create -p {{TASK_ID:10}} "Set up shell"
backlog task create -p {{TASK_ID:10}} "Wire IPC"
```

Use separate tasks with dependencies when work spans independent components:

```bash
backlog task create "Add bulk update API"
backlog task create "Add bulk update UI" --dep {{TASK_ID:21}}
```

### Step 4: Create Tasks

Write tasks so a future agent can act on them without prior conversation context.

Include:

- A clear title.
- A description explaining the outcome and why it matters.
- Acceptance criteria that are specific, testable, and independent.
- References or documentation when they are needed for implementation.
- Dependencies when work must happen in order.

**Do NOT include an Implementation Plan when creating a task.** The plan is written later by the agent who executes the task. After the task is created, the executing agent will set it In Progress, assign themselves, draft a plan, share it with the user, and wait for approval before writing code.

Examples:

```bash
backlog task create "Add project search" \
  -d "Users can search tasks, docs, and decisions from one CLI command." \
  --ac "Search returns matching tasks by title and description" \
  --ac "Search supports --plain output" \
  --ac "Tests cover task, document, and decision results"
```

```bash
backlog task create "Add settings docs" \
  --doc docs/settings.md \
  --ref https://example.com/spec
```

Multi-line descriptions, plans, notes, and final summaries can use `\n` escape sequences inside the quoted string:

```bash
backlog task create "Add project search" \
  -d "Adds a unified search command across tasks, documents, and decisions.\n\nWhy: users currently need to run separate searches or browse folders to find content.\nScope: CLI only; web UI search is a follow-up task." \
  --ac "Search returns matching tasks by title and description" \
  --ac "Search supports --plain output" \
  --ac "Tests cover task, document, and decision results"
```

### Task Dates

Tasks support optional `dueDate`, `plannedStart`, `plannedEnd`, `actualStart`, and `actualEnd` fields. Set them at creation:

```bash
backlog task create "Deadline-driven feature" \
  --due-date 2026-07-15 \
  --planned-start 2026-07-01 \
  --planned-end 2026-07-10 \
  --actual-start "2026-07-01 09:00" \
  --actual-end "2026-07-10 18:00"
```

Use the matching `--clear-*` flag to remove an existing date:

```bash
backlog task edit 42 --clear-due-date --clear-planned-start --clear-planned-end --clear-actual-start --clear-actual-end
```

### Acceptance Criteria

Acceptance criteria define the expected behavior, not implementation steps.

Good criteria:

- Are testable.
- Include edge cases when relevant.
- Include documentation and test expectations when required.

Avoid criteria like "Implement helper function" unless the helper itself is the user-visible deliverable.

### Definition of Done

Project-level Definition of Done defaults apply automatically. Add task-specific DoD items only when this task needs extra completion hygiene:

```bash
backlog task create "Ship audit export" --dod "Manual export checked with sample data"
```

### After Creation

Report the created task IDs, titles, and key acceptance criteria to the user. If the user asks for changes, update tasks through `backlog task edit`.

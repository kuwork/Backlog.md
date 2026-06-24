## Task Execution Guide

Use this guide when you are working on an existing Backlog task.

### Planning Workflow

Before writing code for non-trivial work:

1. Read the task:
   - `backlog task view {{TASK_ID:123}} --plain`
2. Mark it in progress and assign yourself:
   - Inspect accepted statuses if needed: `backlog task edit {{TASK_ID:123}} --help`
   - `backlog task edit {{TASK_ID:123}} -s "<active status>" -a @your-name`
3. Review description, acceptance criteria, dependencies, references, and documentation.
4. Inspect relevant code and tests.
5. Draft an implementation plan.
6. Present the plan to the user when approval is expected.
7. Record the approved plan:
   - `backlog task edit {{TASK_ID:123}} --plan "1. ..."`

Keep the Backlog task as the plan of record. If the approach changes, update the plan through `backlog task edit` before continuing.

### Execution Workflow

Work in short loops:

1. Implement a focused slice.
2. Run relevant tests or checks.
3. Record useful progress:
   - `backlog task edit {{TASK_ID:123}} --append-notes "Implemented parser and added tests."`
4. Check acceptance criteria as they become true:
   - `backlog task edit {{TASK_ID:123}} --check-ac 1`
5. Add comments for discussion or review questions:
   - `backlog task edit {{TASK_ID:123}} --comment "Question for review" --comment-author @your-name`

Use `backlog task edit {{TASK_ID:123}} --help` before changing unfamiliar fields.

### Updating Task Dates

Change or clear task date fields during execution:

```bash
backlog task edit {{TASK_ID:123}} --due-date 2026-07-15
backlog task edit {{TASK_ID:123}} --planned-start 2026-07-01 --planned-end 2026-07-10
backlog task edit {{TASK_ID:123}} --actual-start "2026-07-01 09:00" --actual-end "2026-07-05 18:00"
backlog task edit {{TASK_ID:123}} --clear-due-date --clear-planned-end --clear-actual-start
```

All date fields have matching `--clear-*` flags: `--clear-due-date`, `--clear-planned-start`, `--clear-planned-end`, `--clear-actual-start`, and `--clear-actual-end`.

`actualStart` and `actualEnd` accept `YYYY-MM-DD HH:MM` and are stored in UTC. Use them to record when work really started and finished.

> **Note:** `actualStart` is automatically set when you move a task to an in-progress status, and `actualEnd` is automatically set when you move it to a terminal status (for example "Done"). You only need to set them manually when you want to override those defaults or record a different time.

### Scope Changes

If you discover work that is outside the task's acceptance criteria, stop and ask the user whether to add scope to the current task or create follow-up work. Do not silently expand the task.

### Working With Subtasks

If the user assigns a parent task and all subtasks, complete subtasks one at a time. Each subtask should have its own plan, notes, checked acceptance criteria, and final summary.

If the user assigns only one subtask, finish that subtask and ask before moving to the next one.

### Reading and Writing Backlog Data

Use CLI commands for Backlog changes:

- Read: `backlog task view {{TASK_ID:123}} --plain`
- Search: `backlog search "query" --plain`
- List with task filters: `backlog task list --status "<active status>" --assignee @your-name --labels backend --search "auth" --limit 20 --plain`
- Update: `backlog task edit {{TASK_ID:123}} ...`
- Create docs: `backlog doc create "Title"`
- Update docs: `backlog doc update doc-1 --content "Markdown"`

Do not edit Backlog markdown files directly. The CLI preserves metadata, IDs, filenames, relationships, and structured sections.

### Finishing

When implementation is complete, continue with:

```bash
backlog instructions task-finalization
```

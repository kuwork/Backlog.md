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
6. Present the plan to the user and ask for confirmation. **Do not begin coding until the user approves the plan or explicitly tells you to skip the review.**
7. Record the approved plan:
   - `backlog task edit {{TASK_ID:123}} --plan "1. Analyze current implementation\n2. Design minimal API change\n3. Implement and add tests\n4. Run checks and verify"`

Keep the Backlog task as the plan of record. If the approach changes, update the plan through `backlog task edit` before continuing.

### Execution Workflow

Work in short loops:

1. Implement a focused slice.
2. Run relevant tests or checks.
3. Record useful progress:
   - `backlog task edit {{TASK_ID:123}} --append-notes "Implemented parser and added tests.\nNext: wire parser into the search command."`
4. Check acceptance criteria as they become true:
   - `backlog task edit {{TASK_ID:123}} --check-ac 1`
5. Add comments for discussion or review questions:
   - `backlog task edit {{TASK_ID:123}} --comment "Question for review:\nShould we include archived tasks in search results by default?" --comment-author @your-name`

Use `backlog task edit {{TASK_ID:123}} --help` before changing unfamiliar fields.

### Task Field Quick Reference

| What You Want to Change | CLI Command to Use                                       |
|-------------------------|----------------------------------------------------------|
| Title                   | `backlog task edit {{TASK_ID:123}} -t "New Title"`       |
| Status                  | `backlog task edit {{TASK_ID:123}} -s "In Progress"`     |
| Assignee                | `backlog task edit {{TASK_ID:123}} -a @sara`             |
| Labels                  | `backlog task edit {{TASK_ID:123}} -l backend,api`       |
| Due Date                | `backlog task edit {{TASK_ID:123}} --due-date 2026-06-15` |
| Planned Start           | `backlog task edit {{TASK_ID:123}} --planned-start 2026-06-01` |
| Planned End             | `backlog task edit {{TASK_ID:123}} --planned-end 2026-06-10` |
| Clear Due Date          | `backlog task edit {{TASK_ID:123}} --clear-due-date`     |
| Clear Planned Start     | `backlog task edit {{TASK_ID:123}} --clear-planned-start` |
| Clear Planned End       | `backlog task edit {{TASK_ID:123}} --clear-planned-end`  |
| Actual Start            | `backlog task edit {{TASK_ID:123}} --actual-start "2026-06-02 09:30"` |
| Actual End              | `backlog task edit {{TASK_ID:123}} --actual-end "2026-06-09 17:00"` |
| Clear Actual Start      | `backlog task edit {{TASK_ID:123}} --clear-actual-start` |
| Clear Actual End        | `backlog task edit {{TASK_ID:123}} --clear-actual-end`   |
| Description             | `backlog task edit {{TASK_ID:123}} -d "New description"` |
| Add AC                  | `backlog task edit {{TASK_ID:123}} --ac "New criterion"` |
| Add DoD                 | `backlog task edit {{TASK_ID:123}} --dod "Ship notes"`   |
| Check AC #1             | `backlog task edit {{TASK_ID:123}} --check-ac 1`         |
| Check DoD #1            | `backlog task edit {{TASK_ID:123}} --check-dod 1`        |
| Uncheck AC #2           | `backlog task edit {{TASK_ID:123}} --uncheck-ac 2`       |
| Uncheck DoD #2          | `backlog task edit {{TASK_ID:123}} --uncheck-dod 2`      |
| Remove AC #3            | `backlog task edit {{TASK_ID:123}} --remove-ac 3`        |
| Remove DoD #3           | `backlog task edit {{TASK_ID:123}} --remove-dod 3`       |
| Add Plan                | `backlog task edit {{TASK_ID:123}} --plan "1. Step one\n2. Step two"` |
| Add Notes (replace)     | `backlog task edit {{TASK_ID:123}} --notes "What I did"` |
| Append Notes            | `backlog task edit {{TASK_ID:123}} --append-notes "Another note"` |
| Add Comment             | `backlog task edit {{TASK_ID:123}} --comment "Review question" --comment-author @agent` |
| Add Final Summary       | `backlog task edit {{TASK_ID:123}} --final-summary "PR-style summary"` |
| Append Final Summary    | `backlog task edit {{TASK_ID:123}} --append-final-summary "More details"` |
| Clear Final Summary     | `backlog task edit {{TASK_ID:123}} --clear-final-summary` |

### Acceptance Criteria and Definition of Done Operations

**Adding criteria (`--ac`)** accepts multiple flags: `--ac "First" --ac "Second"` ✅
**Checking/unchecking/removing** accept multiple flags too: `--check-ac 1 --check-ac 2` ✅
**Mixed operations** work in a single command: `--check-ac 1 --uncheck-ac 2 --remove-ac 3` ✅

```bash
# Examples
backlog task edit {{TASK_ID:123}} --ac "User can login" --ac "Session persists"
backlog task edit {{TASK_ID:123}} --check-ac 1 --check-ac 2 --check-ac 3
backlog task edit {{TASK_ID:123}} --check-ac 1 --uncheck-ac 2 --remove-ac 3

# DoD examples
backlog task edit {{TASK_ID:123}} --dod "Run tests" --dod "Update docs"
backlog task edit {{TASK_ID:123}} --check-dod 1 --check-dod 2
backlog task edit {{TASK_ID:123}} --remove-dod 2
```

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

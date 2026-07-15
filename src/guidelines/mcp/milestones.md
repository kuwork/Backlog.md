## Milestones

Milestones group tasks by iteration, version, or release cycle. They are stored as Markdown files in `backlog/milestones/` and differ from `tasks/` (specific work items).

Use Backlog.md public interfaces for milestone creation, listing, and archival so IDs, frontmatter, paths, and task relationships stay consistent.

> **Important**: Assigning a milestone name to a task via `task_edit` only records the name on the task file; it **does not create a milestone file**. To create a milestone with an ID and metadata, you must explicitly add it first using `milestone_add`, then assign tasks to it.

### MCP Tools

- `milestone_add` — create a milestone with title and optional description, actualStart, and actualEnd
- `milestone_edit` — rename a milestone and optionally update its date fields, including actualStart and actualEnd
- `milestone_remove` — remove an active milestone file and optionally clear/reassign tasks
- `milestone_archive` — archive a milestone by moving it to `backlog/archive/milestones`
- `milestone_list` — list active and archived milestones

**Assigning tasks to milestones:**

Use `task_create` or `task_edit` with the `milestone` field:

```
task_create: { title: "Feature X", milestone: "Release 2.0" }
task_edit: { id: "BACK-7", milestone: "Release 2.0" }
```

To clear a milestone assignment, set `milestone` to an empty string or use the appropriate clearing mechanism for your client.

### Key Rules

- Milestone files live under `backlog/milestones/`; archived milestones move to `backlog/archive/milestones/`.
- Milestone IDs follow the `m-N` format and are auto-assigned at creation.
- Archiving unbinds tasks but does not delete them; tasks revert to the unassigned pool.
- Prefer CLI or MCP APIs over ad-hoc file writes so frontmatter and metadata remain valid.

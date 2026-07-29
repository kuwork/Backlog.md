## Drafts

Drafts capture ideas that are not yet committed work. They are stored as Markdown files in `backlog/drafts/` and differ from `tasks/` (committed, actionable work items).

In MCP, drafts are tasks with `status: "Draft"`. Use a draft when the request is too vague for concrete acceptance criteria, when the work is exploratory, or when you want to park a possible task before it is ready to implement.

> **Important**: A draft is not a task. Promote it to a task only once the scope is clear enough to write acceptance criteria.

### MCP Tools

The same task tools manage drafts; drafts are filtered out of default listings.

#### Creating drafts

Create a task with `status: "Draft"`:

```json
{
  "title": "Spike GraphQL resolver",
  "status": "Draft",
  "description": "Explore GraphQL resolver patterns"
}
```

You can also set `acceptanceCriteria`, `labels`, `priority`, `references`, `documentation`, and other task fields when creating a draft.

#### Listing and viewing drafts

```json
// task_list with status filter
{ "status": "Draft" }

// task_view
{ "id": "DRAFT-1" }
```

#### Promoting a draft to a task

Change the draft's status from `"Draft"` to a regular status such as `"To Do"`:

```json
{
  "id": "DRAFT-1",
  "status": "To Do",
  "acceptanceCriteria": [
    "Resolver returns correct data for happy path",
    "Error response matches REST format"
  ]
}
```

**Note**: promoting a draft rewrites its ID to a task ID (e.g., `DRAFT-1` becomes `BACK-1` or `TASK-1`). The `task_edit` response includes the new full ID. Use that new ID in subsequent commands.

#### Demoting a task to a draft

Change the task's status to `"Draft"`:

```json
{
  "id": "BACK-42",
  "status": "Draft"
}
```

**Note**: demoting a task rewrites its ID to a draft ID (e.g., `BACK-42` becomes `DRAFT-5`). The `task_edit` response includes the new full ID. Use that new ID in subsequent commands.

#### Archiving a draft

Archive a draft that will not be pursued:

```json
{ "id": "DRAFT-5" }
```

### Key Rules

- Draft files live under `backlog/drafts/`. Promoting moves them to `backlog/tasks/` with a new task ID; demoting moves them back to `backlog/drafts/` with a new draft ID.
- Promoting and demoting rewrite the entity ID. Always read the `task_edit` response to get the new ID before continuing.
- Use `task_list` with `status: "Draft"` to find drafts; default `task_list` excludes them.
- Do not edit draft markdown files directly. Use `task_create`, `task_edit`, and `task_archive` so metadata and file naming stay consistent.

## Decision Management (MCP)

Decisions live under `backlog/decisions/` and capture architectural or project-level choices, their context, and consequences. They differ from `tasks/` (actionable work items), `docs/` (reference material), and `drafts/` (raw ideas).

Always use Backlog.md interfaces to create, list and update decisions so IDs, frontmatter, paths, and search metadata stay consistent. Do not edit decision markdown files directly.

### MCP Decision Tools

| Action | Tool |
|--------|------|
| Update a decision | `decision_update` |

Creating, listing and viewing decisions are **not exposed over MCP**: use the CLI (`backlog decision create`, `backlog decision list`, `backlog decision view`) for those, or read the `decisions` workflow guide served by the CLI instructions. `decision_update` is provided over MCP because agents frequently need to record the outcome (status) of a decision they are implementing.

### Updating Decisions

Use `decision_update` to change a decision's status, replace sections, or append blocks while preserving omitted sections and frontmatter:

```json
{
  "id": "decision-1",
  "status": "accepted"
}
```

Parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `id` | Yes | Decision ID. |
| `content` | No | Replacement decision body. |
| `appendContent` | No | Array of markdown blocks to append. |
| `status` | No | Decision status; free-form, common values are `proposed`, `accepted`, `rejected`, `superseded`. |

At least one of `content`, `appendContent` or `status` is required.

`status` on its own changes only the status and leaves the body untouched. Combined with `content`/`appendContent` the explicit `status` wins over any `status` in the content frontmatter.

When both content parameters are provided, the body is first replaced with `content` and then the `appendContent` blocks are appended. To only append to the existing body, omit `content` and pass `appendContent` alone.

```json
{
  "id": "decision-1",
  "status": "superseded",
  "content": "## Context\n\nOutdated runtime choice"
}
```

### Multi-line Content

MCP arguments are passed as JSON values, so `\n` characters are real newlines in the string. Pass markdown content with literal line breaks:

```json
{
  "id": "decision-1",
  "content": "## Context\n\nNeed a runtime\n\n## Decision\n\nUse Bun"
}
```

### Key Rules

- Decision paths are relative to `backlog/decisions/`; absolute paths and `..` traversal are rejected.
- Decision IDs are assigned automatically.
- Status values are stored as-is; they are not validated against a fixed set.
- Do not edit decision files directly except when complex markdown cannot be safely passed through MCP arguments.

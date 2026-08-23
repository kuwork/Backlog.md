## Decision Management (MCP)

Decisions live under `backlog/decisions/` and capture architectural or project-level choices, their context, and consequences. They differ from `tasks/` (actionable work items), `docs/` (reference material), and `drafts/` (raw ideas).

Always use Backlog.md MCP decision tools to create and list decisions so IDs, frontmatter, paths, and search metadata stay consistent. Do not edit decision markdown files directly.

### MCP Decision Tools

| Action | Tool |
|--------|------|
| Create a decision | `decision_create` |
| List decisions | `decision_list` |
| View a decision | `decision_view` |
| Update a decision | `decision_update` |

### Creating Decisions

Use `decision_create` with at least `title`:

```json
{
  "title": "Adopt Bun test runner",
  "status": "accepted"
}
```

Parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `title` | Yes | Decision title. |
| `status` | No | Decision status; free-form, defaults to `proposed`. |

The tool returns the created decision ID.

### Listing Decisions

Use `decision_list` to enumerate decisions:

```json
{
  "plain": true
}
```

Parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `plain` | No | Request plain text output explicitly. This is also the default non-TTY behavior. |
| `json` | No | Request a versioned machine-readable envelope: `{ schemaVersion: 1, kind: "decision-list", decisions: [...] }`. |

`plain` and `json` cannot be combined.

Text output prints rows as `decision-1 - Title (status)`. The status suffix is omitted when the decision has no status. An empty list prints `No decisions found.`.

Examples:

```json
{ "plain": true }
{ "json": true }
```

### Viewing Decisions

Use `decision_view` to read a decision's frontmatter and body:

```json
{
  "id": "decision-1"
}
```

The tool returns the raw markdown content of the decision file.

### Updating Decisions

Use `decision_update` to replace sections or append blocks while preserving omitted sections and frontmatter:

```json
{
  "id": "decision-1",
  "content": "## Context\n\nNeed a runtime\n\n## Decision\n\nUse Bun"
}
```

Parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `id` | Yes | Decision ID. |
| `content` | No | Replacement decision body. |
| `appendContent` | No | Array of markdown blocks to append. |

When both `content` and `appendContent` are provided, the body is first replaced with `content` and then the `appendContent` blocks are appended. To only append to the existing body, pass the current decision content as `content` and include `appendContent`.

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

## Decision Management (MCP)

Decisions live under `backlog/decisions/` and capture architectural or project-level choices, their context, and consequences. They differ from `tasks/` (actionable work items), `docs/` (reference material), and `drafts/` (raw ideas).

Always use Backlog.md interfaces to create, list and update decisions so IDs, frontmatter, paths, and search metadata stay consistent. Do not edit decision markdown files directly.

### MCP Decision Tools

| Action | Tool |
|--------|------|
| List decisions | `decision_list` |
| Update a decision | `decision_update` |

Creating and viewing decisions are done through the CLI (`backlog decision create`, `backlog decision view`) or the `decisions` workflow guide. Listing decisions **is** exposed over MCP via `decision_list`, and `decision_update` records the outcome (status) of a decision an agent is implementing.

### Listing Decisions

Use `decision_list` to read decisions with optional filtering and paging while keeping IDs, frontmatter and search metadata consistent:

```json
{
  "limit": 20,
  "offset": 0,
  "status": "accepted",
  "search": "runtime"
}
```

Parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `limit` | No | Page size (1-100). Omit or 0 to return the whole filtered list. |
| `offset` | No | Number of decisions to skip before the window (0-based). |
| `status` | No | Exact, case-insensitive status filter (e.g. `proposed`, `accepted`, `rejected`, `superseded`). |
| `search` | No | Case-insensitive substring match against the decision id or title. |

The result returns a structured envelope `{ items, total, offset, limit, hasMore }` plus a `Showing X-Y of N decisions` text hint, so an agent can paginate without guessing whether more rows exist.

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

## Decision Management (MCP)

Decisions live under `backlog/decisions/` and capture architectural or project-level choices, their context, and consequences. They differ from `tasks/` (actionable work items), `docs/` (reference material), and `drafts/` (raw ideas).

Always use Backlog.md interfaces to create, list and update decisions so IDs, frontmatter, paths, and search metadata stay consistent. Do not edit decision markdown files directly.

### MCP Decision Tools

| Action | Tool |
|--------|------|
| List decisions | `decision_list` |
| View a decision | `decision_view` |
| Update a decision | `decision_update` |
| Delete a decision | `decision_delete` |

Creating decisions is done through the CLI (`backlog decision create`). Listing, viewing, updating, and deleting are exposed over MCP. `decision_view` returns metadata and the Markdown body by `id` or exact `sourcePath`; `decision_update` can change ID, title, status, or body; `decision_delete` permanently removes one decision by id. A missing id returns `DECISION_NOT_FOUND` and colliding equivalent ids return `AMBIGUOUS_ID`. Decisions have no folder concept, so only single-file deletion is available.

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

Use `decision_update` to change a decision's ID, title, status, body, or a combination while preserving omitted sections and frontmatter. Select the source by `id`, by an exact project-relative `sourcePath`, or by both when they match. `decision_view` uses the same selection rules. `newId` accepts both a bare number and a prefixed decision ID.

```json
{
  "sourcePath": "backlog/decisions/decision-1 - Old-Title.md",
  "newId": "10",
  "title": "New Title"
}
```

```json
{
  "id": "decision-1",
  "status": "accepted"
}
```

Parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `id` | One of `id`/`sourcePath` | Source decision ID; when both are supplied it must match the file frontmatter. |
| `sourcePath` | One of `id`/`sourcePath` | Exact project-relative Markdown file in `backlog/decisions/`. |
| `newId` | No | Target ID; accepts a bare number or prefixed ID. |
| `title` | No | New decision title; also updates the filename and matching routes/references. |
| `content` | No | Replacement decision body. |
| `appendContent` | No | Array of markdown blocks to append. |
| `status` | No | Decision status; free-form, common values are `proposed`, `accepted`, `rejected`, `superseded`. |

At least one of `newId`, `title`, `content`, `appendContent` or `status` is required.

`status` on its own changes only the status and leaves the body untouched. Combined with `content`/`appendContent` the explicit `status` wins over any `status` in the content frontmatter.

Changing `title` (including a title supplied in `content` frontmatter) renames the decision file when the sanitized filename changes. ID changes also update the filename and frontmatter. Matching local relative links, structured task path fields, Wiki `source_path` values, and `/decisions/:id/:title` ID/title segments are updated in the same operation. Titles that sanitize to the existing filename keep the current path. If the automatic rename fails, you can fall back to `mv` and then repair the affected references manually.

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
- Decision IDs are assigned automatically on creation and can be changed later with `newId`.
- Status values are stored as-is; they are not validated against a fixed set.
- Do not edit decision files directly except when complex markdown cannot be safely passed through MCP arguments.

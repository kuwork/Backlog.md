## Decision Management (CLI)

Decisions live under `backlog/decisions/` and capture architectural or project-level choices, their context, and consequences. They differ from `tasks/` (actionable work items), `docs/` (reference material), and `drafts/` (raw ideas).

Always use Backlog.md CLI commands to create and list decisions so IDs, frontmatter, paths, and search metadata stay consistent. Avoid editing decision markdown files directly.

### Decision Commands

| Action | Command |
|--------|---------|
| Create a decision | `backlog decision create "<title>" [-s <status>] [--plain]` |
| List decisions | `backlog decision list [--plain] [--json]` |
| View a decision | `backlog decision view <decisionId> [--source-path <path>] [--plain]` |
| Update a decision | `backlog decision update [decisionId] [--id <newId>] [--source-path <path>] [--title <title>] [--content "..."] [--append-content "..."] [--status <status>]` |
| Delete a decision | `backlog decision delete <decisionId>` |

### Deleting Decisions

`backlog decision delete <decisionId>` permanently removes one decision file. A missing id exits with code 1 and an explicit not-found message. When equivalent ids collide, the command fails with an ambiguity error; use the exact filename from `backlog decision list` to select one. Decisions have no folder concept, so only single-file deletion is available.

### Creating Decisions

`backlog decision create <title>` creates a decision markdown file under the configured decisions directory.

Parameters:

| Parameter | Required | Description |
|-------------|----------|-------------|
| `title` | Yes | Decision title. |
| `-s, --status <status>` | No | Decision status; free-form, defaults to `proposed`. |
| `--plain` | No | Output-mode flag. `decision create` already prints a single plain line (`Created decision decision-1`), so the flag is accepted-and-proceed without adding extra output. |

Example:

```bash
backlog decision create "Adopt Bun test runner" -s accepted --plain
```

### Listing Decisions

`backlog decision list` enumerates all decisions. In an interactive terminal it opens a selectable list; choosing a decision opens the scrollable viewer. Pass `--plain` to print the list to stdout, or use it in scripts/pipes where stdout is not a TTY.

Parameters:

| Parameter | Required | Description |
|-------------|----------|-------------|
| `--plain` | No | Request plain text output explicitly. This is also the default when stdout is not a TTY. |
| `--json` | No | Print a versioned machine-readable envelope: `{ schemaVersion: 1, kind: "decision-list", decisions: [...] }`. |

`--json` and `--plain` cannot be combined.

Text output prints rows as `decision-1 - Title (status)`. The status suffix is omitted when the decision has no status. An empty list prints `No decisions found.`.

Examples:

```bash
backlog decision list --plain
backlog decision list --json
backlog decision list --max-count 20 --plain
backlog decision list --max-count 20 --skip 20 --plain
backlog decision list --count
```

`--max-count <n>`, `--skip <n>` and `--count` page the list like every other list command: the window applies after sorting, in the order the output prints, so consecutive windows join into the complete output. A cut list ends with `Showing <first>-<last> of <total> items. Next: backlog decision list --max-count <n> --skip <m>`; run that command for the following decisions and stop when the footer has no `Next:` part. `--count` prints only how many decisions match and cannot be combined with `--json`. When a window cuts the list, the JSON envelope also carries `total` and `nextSkip`.

### Viewing Decisions

`backlog decision view <decisionId>` opens an interactive scrollable viewer by default. Pass `--plain` to print the raw decision markdown to stdout instead (useful for agents, scripts, pipes, and CI). When stdout is not a TTY, plain output is emitted automatically.

### Updating Decisions

`backlog decision update [decisionId]` changes a decision's ID, structured sections, title, and/or status. It parses the provided markdown body and updates the matching Context / Decision / Consequences / Alternatives sections, leaving unrelated frontmatter intact. Omitted fields keep their current values. Use `--source-path` with `decision view` or `decision update` to select one exact project-relative Markdown file, especially when the old ID is duplicated; the positional ID is optional and must be equivalent to the source frontmatter when both are supplied.

ID and title changes update the source frontmatter and sanitized filename automatically. Matching local relative links, structured task path fields, Wiki `source_path` values, and `/decisions/:id/:title` ID/title segments are updated in the same operation. Titles that sanitize to the existing filename keep the current path. If the automatic rename fails, you can fall back to `mv` and then repair the affected references manually. Run `backlog instructions entity-identity` for source-selection modes, duplicate old IDs, reference scope, and conflict handling.

Parameters:

| Parameter | Required | Description |
|-------------|----------|-------------|
| `--id <newId>` | No | Set the target decision ID. |
| `--source-path <path>` | No | Select an exact project-relative Markdown file under `backlog/decisions/`. |
| `--title <title>` | No | Set the decision title. |
| `--content <content>` | No | Replace the entire decision body. |
| `--append-content <text>` | No | Append a markdown block to the body (can be used multiple times). |
| `--status <status>` | No | Set the decision status; free-form, common values are `proposed`, `accepted`, `rejected`, `superseded`. |

At least one update flag is required.

When both content flags are provided, `--content` replaces the body first and `--append-content` blocks are appended after it.

`--status` can be combined with identity, title, and content flags; the explicit value wins over any `status` in the content frontmatter. Used on its own it changes only the status and leaves the body untouched.

```bash
# Change only the ID
backlog decision update decision-1 --id decision-10

# Change ID, title, and status in one call
backlog decision update decision-1 --id decision-10 --title "Adopt Bun test runner" --status accepted

# Select one exact source when decision-1 is duplicated
backlog decision update --source-path "backlog/decisions/decision-1 - Old-Title.md" --id decision-10

# Replace the body and set the status without changing identity
backlog decision update decision-1 --status superseded --content "## Context\n\nOutdated runtime choice"
```

### Updating Decisions over MCP

The MCP server exposes the same capability as `decision_update`, so agents working through MCP do not have to shell out. It accepts `id` and/or `sourcePath` for source selection, optional `newId` and `title`, plus any of `content`, `appendContent` and `status`. At least one update field is required; `status` alone changes only the status. `decision_view` supports the same `id`/`sourcePath` selection rules.

### Multi-line Content

`--content` and `--append-content` support `\n` escape sequences inside a quoted argument. This is the preferred form for AI agents because it works across most shells and agent harnesses.

```bash
# Replace the full decision body
backlog decision update decision-1 --content "## Context\n\nNeed a runtime\n\n## Decision\n\nUse Bun"

# Append a new section (for example, Alternatives)
backlog decision update decision-1 --append-content "## Alternatives\n\n- Node.js\n- Deno"
```

You can repeat `--append-content` to add several blocks at once:

```bash
backlog decision update decision-1 \
  --append-content "## Alternatives\n\n- Node.js" \
  --append-content "- Deno"
```

### Complex content with backticks or shell-sensitive characters

If the markdown body contains backticks (`` `` ``) or other characters that the shell interprets, passing it through `--content` or `--append-content` is unsafe: the shell treats text inside backticks as a command substitution. In that case, use a text editor or file-writing tool to edit the generated decision file under `backlog/decisions/` directly, keeping the frontmatter block intact.

### Key Rules

- Decision paths are relative to `backlog/decisions/`; absolute paths and `..` traversal are rejected.
- Decision IDs are assigned automatically.
- Status values are stored as-is; they are not validated against a fixed set.
- Do not edit decision files directly except when complex markdown cannot be safely passed through shell arguments.

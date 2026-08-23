## Decision Management (CLI)

Decisions live under `backlog/decisions/` and capture architectural or project-level choices, their context, and consequences. They differ from `tasks/` (actionable work items), `docs/` (reference material), and `drafts/` (raw ideas).

Always use Backlog.md CLI commands to create and list decisions so IDs, frontmatter, paths, and search metadata stay consistent. Avoid editing decision markdown files directly.

### Decision Commands

| Action | Command |
|--------|---------|
| Create a decision | `backlog decision create "<title>" [-s <status>] [--plain]` |
| List decisions | `backlog decision list [--plain] [--json]` |
| View a decision | `backlog decision view <decisionId> [--plain]` |
| Update a decision | `backlog decision update <decisionId> --content "..."` / `--append-content "..."` |

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
```

### Viewing Decisions

`backlog decision view <decisionId>` opens an interactive scrollable viewer by default. Pass `--plain` to print the raw decision markdown to stdout instead (useful for agents, scripts, pipes, and CI). When stdout is not a TTY, plain output is emitted automatically.

### Updating Decisions

`backlog decision update <decisionId>` changes a decision's structured sections. It parses the provided markdown body and updates the matching Context / Decision / Consequences / Alternatives sections, leaving the frontmatter intact. Omitted sections keep their current values.

Parameters:

| Parameter | Required | Description |
|-------------|----------|-------------|
| `--content <content>` | No | Replace the entire decision body. |
| `--append-content <text>` | No | Append a markdown block to the body (can be used multiple times). |

When both flags are provided, `--content` replaces the body first and `--append-content` blocks are appended after it.

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

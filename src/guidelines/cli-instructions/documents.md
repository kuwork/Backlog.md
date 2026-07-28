## Document Management (CLI)

Documents live under `backlog/docs/` and are used for long-term project reference information such as development standards, configuration guides, architecture documentation, and runbooks. They differ from `tasks/` (specific work items), `decisions/` (decision records), and `drafts/` (draft ideas).

Always use Backlog.md CLI commands to create and update documents so IDs, frontmatter, paths, and search metadata stay consistent. Do not edit document markdown files directly.

### Document Commands

| Action | Command |
|--------|---------|
| Create a document | `backlog doc create "API Guidelines"` |
| Create in a subdirectory | `backlog doc create "Setup Guide" -p guides/setup` |
| Specify document type | `backlog doc create "Architecture" -t guide` |
| Replace document content | `backlog doc update doc-1 --content "Updated markdown"` |
| Append content to a document | `backlog doc update doc-1 --append-content "Additional section"` |
| Update metadata or move a doc | `backlog doc update doc-1 --title "Setup Handbook" -t guide --tags setup,runbook -p guides` |
| List all documents | `backlog doc list --plain` |
| View a document | `backlog doc view doc-1` |

### Document Types

Supported values for `--type`:

- `readme`
- `guide`
- `specification`
- `other`

### Multi-line Content

`--content` and `--append-content` support `\n` escape sequences inside a quoted argument. This is the preferred form for AI agents because it works across most shells and agent harnesses.

```bash
# Replace with multi-line markdown
backlog doc update doc-1 --content "# Heading\n\nFirst paragraph.\n\nSecond paragraph."

# Append a multi-line block
backlog doc update doc-1 --append-content "## New section\n\n- Bullet one\n- Bullet two"
```

You can also repeat `--append-content` to add several blocks at once. Each value is appended as a separate block separated by a blank line from the existing content:

```bash
backlog doc update doc-1 \
  --append-content "First new block" \
  --append-content "Second new block"
```

### Combining `--content` and `--append-content`

When both flags are provided, `--content` replaces the body first and `--append-content` blocks are appended after it:

```bash
backlog doc update doc-1 \
  --content "Replacement body" \
  --append-content "Extra section"
```

### Key Rules

- Document paths are relative to `backlog/docs/`; absolute paths and `..` traversal are rejected.
- Document IDs are global across the entire docs tree, including nested subfolders.
- Use project-root-relative paths or URLs when referencing docs from tasks (`--doc docs/architecture.md`), not bare doc IDs.
- Do not edit document files directly; use `backlog doc update` so frontmatter stays valid.

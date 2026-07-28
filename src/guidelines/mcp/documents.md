## Document Management (MCP)

Documents live under `backlog/docs/` and are used for long-term project reference information such as development standards, configuration guides, architecture documentation, and runbooks. They differ from `tasks/` (specific work items), `decisions/` (decision records), and `drafts/` (draft ideas).

Always use Backlog.md MCP document tools to create and update documents so IDs, frontmatter, paths, and search metadata stay consistent. Do not edit document markdown files directly.

### MCP Document Tools

| Action | Tool |
|--------|------|
| List documents | `document_list` |
| View a document | `document_view` |
| Search documents | `document_search` |
| Create a document | `document_create` |
| Update a document | `document_update` |

### Creating Documents

Use `document_create` with at least `title` and `content`:

```json
{
  "title": "API Guidelines",
  "content": "# API Guidelines\n\nBase URL and authentication rules.",
  "type": "guide",
  "path": "guides/api"
}
```

- `type` is optional and defaults to `other` when omitted. Supported values: `readme`, `guide`, `specification`, `other`.
- `path` is optional and docs-directory-relative. Nested paths such as `guides/api` are supported. Absolute paths and `..` traversal are rejected.
- `tags` is optional.

### Updating Documents

Use `document_update` to replace content, metadata, or path while preserving omitted fields.

```json
{
  "id": "doc-1",
  "content": "Replacement body"
}
```

### Appending Content

To add blocks to an existing document without replacing the entire body, use `appendContent`. Each string in the array is appended as a separate block separated by a blank line from the existing content.

```json
{
  "id": "doc-1",
  "content": "Current body",
  "appendContent": [
    "## New section",
    "## Another new section"
  ]
}
```

When both `content` and `appendContent` are provided, the body is first replaced with `content` and then the `appendContent` blocks are appended. To only append to the existing body, pass the current document content as `content` and include `appendContent`.

### Multi-line Content

MCP arguments are passed as JSON values, so `\n` characters are real newlines in the string. There is no shell escaping layer. Pass markdown content with literal line breaks:

```json
{
  "id": "doc-1",
  "content": "# Heading\n\nFirst paragraph.\n\nSecond paragraph."
}
```

### Key Rules

- Document paths are relative to `backlog/docs/`; absolute paths and `..` traversal are rejected.
- Document IDs are global across the entire docs tree, including nested subfolders.
- When referencing docs from tasks, use project-root-relative paths or URLs (`docs/architecture.md`), not bare doc IDs.
- Do not edit document files directly; use `document_update` so frontmatter stays valid.

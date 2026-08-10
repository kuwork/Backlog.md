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

### Links in Documents

Documents can contain two kinds of links: in-document heading links (table of contents) and links to other backlog items (tasks, docs, decisions, drafts, wiki pages).

#### In-document heading links

Use hash-only links (`[text](#heading)`) to jump to headings within the same document. The renderer resolves them against the current document context.

Supported anchor formats:

1. **Prefix anchor** (simplest, recommended for section-prefixed headings):
   ```markdown
   - [A1: Section Title](#A1)
   ## A1: Section Title
   ```

2. **Angle-bracket full-title anchor** (use when the heading text contains spaces or special characters):
   ```markdown
   - [A1: Section Title](<#A1: Section Title>)
   ## A1: Section Title
   ```
   Standard markdown does not allow spaces in plain link URLs, so the angle brackets are required for full titles.

3. **Github-slugger slug** (what the Web UI stores after saving):
   ```markdown
   - [A1: Section Title](#a1-section-title)
   ## A1: Section Title
   ```

Editing behavior:
- **Direct file editing**: keep the human-readable prefix or angle-bracket form. The renderer resolves both.
- **Web UI editing**: when a document is saved through the Web UI, human-readable hash anchors are automatically rewritten to the github-slugger slug form so the saved source is standard markdown while the heading text stays unchanged.

#### Local backlog links

Local paths to other backlog surfaces are automatically rendered as short aliases and open the target modal or page. This keeps documents readable even when referencing tasks, decisions, drafts, or wiki pages. The title slug is optional and ignored when generating the alias; use the ID-only path form for simplicity.

Supported patterns:

| Path pattern | Default alias | Opens |
|-------------|------------|-------|
| `/task/:id` (with optional `/:title`) | `TASK#:id` | Task modal |
| `/draft/:id` (with optional `/:title`) | `DRAFT#:id` | Draft modal |
| `/documentation/:id` (with optional `/:title`) | `DOC#:id` | Document modal |
| `/decisions/:id` (with optional `/:title`) | `Decisions#:id` | Decision modal |
| `/wiki/:path` | `WIKI#:path` | Wiki page |

When the link text is empty, the renderer fills in the default alias. If you provide a custom label, that label is shown instead.

Recommended examples (ID-only):
```markdown
- See [TASK#506](/task/506) for background.
- Read [DOC#001](/documentation/001) first.
- Check [Decisions#042](/decisions/042) for the related decision.
- Alias left empty: see [](/task/506) for the default alias.
```

When rendered, the links above display as `TASK#506`, `DOC#001`, `Decisions#042`, and `TASK#506` respectively, while remaining clickable. Only same-origin paths are transformed; external URLs are left unchanged.

### Key Rules

- Document paths are relative to `backlog/docs/`; absolute paths and `..` traversal are rejected.
- Document IDs are global across the entire docs tree, including nested subfolders.
- When referencing docs from tasks, use project-root-relative paths or URLs (`docs/architecture.md`), not bare doc IDs.
- Do not edit document files directly; use `document_update` so frontmatter stays valid.

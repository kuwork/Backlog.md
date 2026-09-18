## Document Management (CLI)

Documents live under `backlog/docs/` and are used for long-term project reference information such as development standards, configuration guides, architecture documentation, and runbooks. They differ from `tasks/` (specific work items), `decisions/` (decision records), and `drafts/` (draft ideas).

Always use Backlog.md CLI commands to create and update documents so IDs, frontmatter, paths, and search metadata stay consistent. Avoid editing document markdown files directly, except when adding complex content that cannot be safely passed through shell arguments (see [Complex content with backticks](#complex-content-with-backticks-or-shell-sensitive-characters) below).

### Document Commands

| Action | Command |
|--------|---------|
| Create a document | `backlog doc create "API Guidelines"` |
| Create in a subdirectory | `backlog doc create "Setup Guide" -p guides/setup` |
| Specify document type | `backlog doc create "Architecture" -t guide` |
| Replace document content | `backlog doc update doc-1 --content "Updated markdown"` |
| Append content to a document | `backlog doc update doc-1 --append-content "Additional section"` |
| Update metadata or move a doc | `backlog doc update doc-1 --title "Setup Handbook" -t guide --tags setup,runbook -p guides` |
| List all documents | `backlog doc list` / `backlog doc list --plain` / `backlog doc list --json` |
| View a document | `backlog doc view 1` / `backlog doc view doc-1` / `backlog doc view subdir/doc-1` / `backlog doc view Title` / `backlog doc view "doc-1 - Title.md"` / `backlog doc view 1 --plain` |

### Listing Documents

`backlog doc list` opens an interactive two-pane browser by default. The left pane shows the document list (`Documents (N)`), the right pane shows details for the selected document. Use `←/→` to switch panes, `↑/↓` or `j/k` to navigate the active pane, `Enter` to open the full document viewer from the details pane, and `q` to quit.

Pass `--plain` to print one document per line (`id - title`) for scripts and pipes. Pass `--json` for a versioned machine-readable JSON envelope. When stdout is not a TTY, plain output is emitted automatically.

### Viewing Documents

`backlog doc view <docId>` opens an interactive scrollable viewer by default. Pass `--plain` to print the raw document content to stdout instead (useful for agents, scripts, pipes, and CI). When stdout is not a TTY, plain output is emitted automatically, so scripts never get trapped in the interactive viewer.

For example `backlog/docs/subdir/doc-1 - Title.md`. The `<docId>` reference may take several forms. The most basic is the bare document ID: `backlog doc view 1` or `backlog doc view doc-1`. The other forms are:

- Code-name short path: `backlog doc view subdir/doc-1`
- Title: `backlog doc view Title`
- Full filename (quote when it contains spaces): `backlog doc view "doc-1 - Title.md"`

When several files share the referenced ID, path stem, or title, the command fails closed: it prints all matching candidates instead of picking one, together with ready-to-run `backlog doc view` alternatives for each candidate. Use the code-name short path form to disambiguate documents that legitimately share an ID in different subdirectories.

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

### Complex content with backticks or shell-sensitive characters

If the markdown body contains backticks (`` `` ``) or other characters that the shell interprets, passing it through `--content` or `--append-content` is unsafe: the shell treats text inside backticks as a command substitution and tries to execute it, which usually fails. In that case:

1. Create the document without content:
   ```bash
   backlog doc create "API Guidelines"
   ```
2. Use a text editor or file-writing tool to append the body to the generated file under `backlog/docs/`.
3. Write the markdown **after** the YAML frontmatter block (the `---` delimited header at the top). Do not remove the frontmatter block. You may overwrite the frontmatter contents if needed, but keep the block itself intact.

This avoids shell escaping issues while still keeping the document's frontmatter intact.

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

##### Line suffix

Append `:LINE` or `:START-END` to the id to open the target scoped to those lines instead of navigating. The migration classification document uses this form to point at the matching section of the analysis report: `[doc-13 CORE-19](/documentation/13:319-329)`.

```markdown
- [doc-13 CORE-19](/documentation/13:319-329) opens the analysis report at lines 319-329.
- [BACK-650](/task/650:30) opens the task at line 30.
- Alias left empty: [](/documentation/13:319) renders the default alias `DOC#13:319`.
```

Rules:

- The suffix belongs to the id segment, so an optional title slug still follows it: `/documentation/13:319-329/migration-analysis`.
- A link with a custom label keeps that label. A link without a label renders the default alias with the range appended: `DOC#13:319-329`, `TASK#650:30`.
- Clicking a suffixed link opens the preview modal scoped to those lines instead of navigating, and the modal title shows the range; a link without a suffix behaves as before.
- Links rendered by views that only navigate — a decision page, or the file preview modal itself — ignore the suffix and keep navigating.
- A relative project path such as `src/file-system/operations.ts` is **not** a short local link and gets no alias: it stays a code file link, where the same suffix scopes the file preview instead (see below).

**Code file links.** A link destination can be an external URL (left unchanged), a backlog item path such as `/task/506`, or a project-relative file path. A code file link carries the same `:LINE` / `:START-END` suffix, and the file preview opens at those lines — a single line or a multi-line range:

```markdown
- [sanitizeFilename](src/file-system/operations.ts:1811-1822) opens that function.
- [readProjectFile](src/file-system/operations.ts:2183) opens a single line.
- [operations.ts](src/file-system/operations.ts) opens the whole file, when the line is not the point.
```

An item link opens the item modal; a code file link opens the file preview. Add the suffix whenever the reader only needs part of a file — a bare path opens it from line 1.

### Key Rules

- Document paths are relative to `backlog/docs/`; absolute paths and `..` traversal are rejected.
- Document IDs are global across the entire docs tree, including nested subfolders.
- Use project-root-relative paths or URLs when referencing docs from tasks (`--doc docs/architecture.md`), not bare doc IDs.
- Do not edit document files directly; use `backlog doc update` so frontmatter stays valid.

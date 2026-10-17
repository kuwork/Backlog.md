## Document Management (MCP)

Documents live under `backlog/docs/` and are used for long-term project reference information such as development standards, configuration guides, architecture documentation, and runbooks. They differ from `tasks/` (specific work items), `decisions/` (decision records), and `drafts/` (draft ideas).

Documents (like any markdown body rendered by the Web UI) can embed **live query blocks** — SQL blocks (`sqlite-query` / `duckdb-query`) that execute against project-local SQLite / DuckDB / CSV / XLSX data sources, and Cypher blocks (`cypher-query`) that execute against the project's graph databases — and render results in the reading view. See [Live SQL Query Blocks](#live-sql-query-blocks-sqlite-query--duckdb-query) and [Live Cypher Query Blocks](#live-cypher-query-blocks-cypher-query) below before writing one.

Documents also support **rich links**: in-document heading anchors for a table of contents, short aliased links to backlog items (`/task/506`, `/documentation/001`, `/decisions/042`, `/wiki/...`) including `:LINE` / `:START-END` suffixes that open the target scoped to specific lines, and project-relative code file links that open a file preview — see [Links in Documents](#links-in-documents) below before referencing other items or files.

Always use Backlog.md MCP document tools to create and update documents so IDs, frontmatter, paths, and search metadata stay consistent. Do not edit document markdown files directly.

### MCP Document Tools

| Action | Tool |
|--------|------|
| List documents | `document_list` (returns versioned JSON; no interactive UI) |
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

### Live SQL Query Blocks (`sqlite-query` / `duckdb-query`)

Any markdown body rendered by the Web UI (documents, tasks, decisions, memos, wiki pages) can embed a **live** SQL query with a `sqlite-query` or `duckdb-query` fenced code block. In the reading view the block executes against the data source and renders the result; in the editor it stays raw source and never executes. A `cypher-query` block does the same for the project's graph databases — see [Live Cypher Query Blocks](#live-cypher-query-blocks-cypher-query) below.

````markdown
```sqlite-query
source: backlog/databases/shop.sqlite
view: table
sql: |
  SELECT product, price, stock
  FROM inventory
  ORDER BY price DESC
```
````

Fields are top-level `key: value` pairs; use the `sql: |` block scalar for multi-line SQL:

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `source` | yes | — | Project-root-relative path to the data source |
| `sql` | yes | — | A single `SELECT` or `WITH ... SELECT` statement |
| `view` | no | `table` | `table` (grid) / `list` (key-value per record) / `value` (first cell of the first row, inline — good for a single metric) |
| `refresh` | no | `manual` | Manual refresh only; no auto/scheduled refresh |
| `copy_to` | no | — | `duckdb-query` only: project-relative `.csv` / `.xlsx` target that enables the write path (see below) |

Data sources:

- `sqlite-query`: `.sqlite` / `.sqlite3` / `.db` files anywhere inside the project directory.
- `duckdb-query`: `.duckdb` files, plus CSV / Excel data sources (`.csv` / `.xlsx`). For CSV/XLSX the block opens an in-memory instance and the SQL reads the file directly:

  ````markdown
  ```duckdb-query
  source: backlog/databases/orders.csv
  sql: SELECT * FROM 'backlog/databases/orders.csv'
  ```
  ````

  ````markdown
  ```duckdb-query
  source: backlog/databases/products.xlsx
  sql: SELECT * FROM read_xlsx('backlog/databases/products.xlsx', sheet = 'Sheet2')
  ```
  ````

  The official `excel` extension autoloads on first use — never write `INSTALL` / `LOAD` yourself (both are rejected). `source` stays required for CSV/XLSX and must match the file the SQL reads: it is the security anchor the path gates are checked against.

Rules (fail-closed — a violation renders an error inside the block and never affects the rest of the page):

- `source` must be project-root-relative: no leading `/`, no absolute paths / drive letters / UNC / URLs / `~`, no `..` escape, no symlinks pointing outside the project. Files under ignored directories (`node_modules`, `.git`, `dist`, `build`, `.locks`, dot-directories except `.backlog`) are rejected.
- SQL must be read-only: a single `SELECT` / `WITH ... SELECT`, no internal semicolons (one trailing `;` is tolerated and stripped). Write keywords (`INSERT` / `UPDATE` / `DELETE` / `CREATE` / `DROP` / `ATTACH` / `COPY` / `PRAGMA` / `INSTALL` / `LOAD` / ...) are rejected by static validation before the engine runs, and the engine itself is opened read-only as the final guarantee.
- SQL string literals containing `http(s)://` / `s3://` URLs are rejected; local file paths inside literals must pass the same project gates as `source`.
- Results are capped at 500 rows and flagged as truncated beyond that; there is no pagination — tighten the SQL instead.
- `copy_to` (DuckDB only) wraps the block's `SELECT` in `COPY (<sql>) TO '<target>'` and writes a new `.csv` / `.xlsx` file inside the project on every run (idempotent overwrite; the block shows "written to: <path>"). The target passes the same project gates and can never be a `.duckdb` file — the database itself always stays read-only. A `sqlite-query` block carrying `copy_to` is rejected.
- DuckDB values render coerced: BIGINT → decimal text, DECIMAL → scaled decimal string, TIMESTAMP / DATE → ISO strings, BLOB → `<blob N bytes>` placeholder, NULL → empty cell.

Writing CSV / Excel output (`duckdb-query` only): add the `copy_to` field to export the query result as a new project-local file every time the block runs:

````markdown
```duckdb-query
source: backlog/databases/shop.duckdb
view: table
copy_to: output/category-revenue.csv
sql: |
  SELECT category,
         COUNT(*)              AS orders,
         ROUND(SUM(amount), 2) AS revenue
  FROM order_details
  GROUP BY category
  ORDER BY revenue DESC
```
````

The server wraps the `SELECT` in `COPY (<sql>) TO '<target>'` (`.csv` → `HEADER TRUE`; `.xlsx` → `FORMAT XLSX, HEADER TRUE`), overwrites the target idempotently, and the block shows "written to: <path>". The written file stays inside the project, so it can itself become the `source` of another query block.

#### Live Cypher Query Blocks (`cypher-query`)

Any markdown body rendered by the Web UI can also embed a **live** Cypher query with a `cypher-query` fenced code block, executed against the project's graph databases — the `default` corpus graph (tasks, docs, decisions, memos and their dependencies / links) or a user database created with `backlog graph create`. In the reading view the block executes and renders the result; in the editor it stays raw source and never executes.

````markdown
```cypher-query
source: default
view: table
query: |
  MATCH (t:FileNode)-[:DependsOn]->(d:FileNode)
  RETURN t.id AS task, d.id AS dependency
  ORDER BY task
  LIMIT 20
```
````

The grammar is the same tiny YAML subset with two deliberate differences: the statement field is `query` (not `sql`), and `source` is a **database registry name** (what `backlog graph list` prints, e.g. `default` or `people`), never a path.

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `source` | yes | — | Registered graph database name; an unknown name fails the block |
| `query` | yes | — | A single read-only statement: `MATCH` / `RETURN` / `WITH` / `CALL` |
| `view` | no | `table` | `table` / `list` / `value` as above, plus `graph` — a force-directed node/relationship drawing rendered by the same pane as the Databases page, reusing that database's legend configuration |
| `refresh` | no | `manual` | `manual`, or `auto` — re-run when a graph-updated broadcast names this block's database (one re-run per burst) |
There is no `copy_to` on a `cypher-query` block — the graph engine is read-only, full stop.

The `graph` view with `refresh: auto` (the block re-runs itself when the graph changes):

````markdown
```cypher-query
source: people
view: graph
refresh: auto
query: |
  MATCH (a:Person)-[:KNOWS]->(b:Person)
  RETURN a, b
```
````

Rules (fail-closed — a violation renders an error inside the block and never affects the rest of the page):

- Read-only: write keywords (`CREATE` / `DROP` / `DELETE` / `INSERT` / `MERGE` / `SET` / `UPDATE`) are rejected by static validation before the engine runs; `CALL` stays allowed for read-only introspection (e.g. `CALL show_tables() RETURN name, type`).
- `source` must be a registered database name — names resolve through `backlog/databases/registry.json`, so a path-shaped value simply cannot match.
- Results are capped at 500 rows by default (`queryMaxRows` config, hard ceiling 5000) and flagged as truncated beyond that; there is no pagination — tighten the query instead.
- The `graph` view draws up to 3000 nodes; a larger result falls back to the coerced table with a notice.
- `refresh: auto` is opt-in: it re-runs only when a graph-updated broadcast names this block's database (a CLI / MCP write, or the corpus graph being rebuilt), coalesced into one re-run per burst; `manual` blocks re-run only via the toolbar button.
- Cells are coerced to plain scalars: nodes render as a compact JSON string, relationships and paths as `(a)-[TYPE]->(b)` text, NULL as an empty cell.
- Toolbar actions: refresh, show/hide query, copy as Markdown, export CSV. No pagination, no `copy_to`.

MCP arguments are JSON, so fenced blocks pass through `content` / `appendContent` verbatim — no shell escaping concerns.

### Key Rules

- Document paths are relative to `backlog/docs/`; absolute paths and `..` traversal are rejected.
- Document IDs are global across the entire docs tree, including nested subfolders.
- When referencing docs from tasks, use project-root-relative paths or URLs (`docs/architecture.md`), not bare doc IDs.
- Do not edit document files directly; use `document_update` so frontmatter stays valid.

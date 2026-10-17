## Graph (MCP)

The graph tools run Cypher against the project's task/knowledge graph and against durable **user databases** you create. They are the MCP counterpart to the CLI `backlog graph` command family and to the Web UI's Cypher search (the magnifier dialog in `backlog browser`).

Use `graph_schema` to learn the graph's structure and `graph_query` to explore task structure, dependencies, milestones, tags, and cross-file links. Every graph tool works against a named **database**: `default` (the derived markdown graph) or a user database you created.

> **Important**: `default` is strictly read-only — it is a derived **cache** of the Markdown corpus, rebuilt on each call and never written to. Query write keywords (`CREATE` / `DROP` / `DELETE` / `INSERT` / `MERGE` / `SET` / `UPDATE`) are rejected. Writing is possible only on a **user database** via `graph_create_database` (create) and `graph_import_csv` (load CSV rows or edges).

Each call opens the database, answers, and closes it. `default` is reconciled and hydrated from the corpus on the call (a few seconds on a large corpus); a user database is replayed from its JSON snapshot, which is what makes it durable.

### MCP Graph Tools

| Action | Tool |
|--------|------|
| List databases | `graph_list_databases` |
| Describe a database | `graph_describe_database` |
| Inspect a database's schema | `graph_schema` |
| Run a Cypher query (read-only) | `graph_query` |
| Create a user database (write) | `graph_create_database` |
| Import a CSV as nodes or edges (write) | `graph_import_csv` |

`graph_list_databases`, `graph_describe_database`, `graph_schema`, and `graph_query` are read-only (`readOnlyHint: true`). `graph_create_database` and `graph_import_csv` are write operations (`destructiveHint: true`) and are refused for `default`.

### Listing and Describing Databases

`graph_list_databases` takes no arguments and returns the `default` derived graph plus every user database, each with its kind and node/edge counts. `graph_describe_database` takes a `db` name and returns one database's kind, description, creation/updated timestamps, and node/edge counts.

```json
{ "db": "default" }
```

An unknown database name is an error (`not found`), not an empty result.

### Inspecting the Schema

`graph_schema` introspects a database: every node table with its properties (name, type, primary key) and every relationship table with its source/target endpoints. Call it before writing a query so you do not have to guess labels.

```json
{ "db": "default" }
```

It returns the same structure the CLI prints with `backlog graph schema`: node tables (`FileNode`, `Meta`, `Tag`) and relationship tables (`ParentOf`, `BelongsToMilestone`, `DependsOn`, `SourcedFrom`, `LinksTo`, `TaggedWith`).

**Schema notes**: the node label is `FileNode` (**not** `File`); `CALL db.labels()` does not exist in ryu (`Parser exception`); `show_connection` works only on relationship tables. Relationship tables carry no user properties, so `table_info` on them returns nothing — use `show_connection` for their endpoints.

### Running a Cypher Query

`graph_query` takes a required `db` and an optional read-only `statement`. Omit `statement` to get a default overview of node labels; supply Cypher to explore the graph.

```json
{
  "db": "default",
  "statement": "MATCH (n:FileNode) RETURN n.type, count(n) ORDER BY count(n) DESC LIMIT 10"
}
```

More examples:

```cypher
-- List files with their type, newest path first
MATCH (n:FileNode) RETURN n.type, n.path ORDER BY n.path LIMIT 10

-- Walk a relationship (edge is directed parent -> child, so a is the parent, b is the child)
MATCH (a:FileNode)-[:ParentOf]->(b:FileNode) RETURN a.path, b.path LIMIT 10

-- Aggregate by tag
MATCH (n:FileNode)-[:TaggedWith]->(t:Tag) RETURN t.name, count(n) ORDER BY count(n) DESC LIMIT 10
```

Results are capped at 500 rows; the response notes truncation when the cap is hit. Narrow the query with `WHERE` / `LIMIT` to see more. A `query` that names its labels only replays the tables it needs (`MATCH (a:Person)-[:WORKS_AT]->(b:Company)` loads `Person`, `Company` and `WORKS_AT`); anything that cannot be pinned down — `CALL show_tables()`, an unlabelled `MATCH (n)`, a label the database does not have — replays the whole snapshot, so a scoped load is never wrong for being incomplete.

### Task Relationship Graph by Task ID

To explore a single task's associations, anchor the query on the task `id` and traverse its relationships. **Task IDs are stored UPPERCASE** (e.g. `BACK-521`, not `back-521`).

The `ParentOf` hierarchy edge is directed **parent → child** (`parent -[:ParentOf]-> child`). Other edges follow their own direction — e.g. `DependsOn` points from the dependent to its dependency (`dependent -[:DependsOn]-> dependency`).

```cypher
-- Look up one task by its ID
MATCH (t:FileNode {id: 'BACK-521'}) RETURN t.id, t.title, t.type, t.status

-- Parent it sits under (edge is parent -> child, so follow it backwards)
MATCH (c:FileNode {id: 'BACK-521.2'})<-[:ParentOf]-(p:FileNode) RETURN p.id, p.title

-- Child / subtasks it parents (follow the edge forwards)
MATCH (p:FileNode {id: 'BACK-521'})-[:ParentOf]->(c:FileNode) RETURN c.id, c.title, c.status

-- What it depends on / what depends on it
MATCH (t:FileNode {id: 'BACK-521'})-[:DependsOn]->(d:FileNode) RETURN d.id, d.title
MATCH (d:FileNode)-[:DependsOn]->(t:FileNode {id: 'BACK-521'}) RETURN d.id, d.title

-- Milestone and tags
MATCH (t:FileNode {id: 'BACK-521'})-[:BelongsToMilestone]->(m:FileNode) RETURN m.id, m.title
MATCH (t:FileNode {id: 'BACK-521'})-[:TaggedWith]->(tag:Tag) RETURN tag.name
```

ryu has no `type()` function for relationships, so to see the entire relationship map in one result, chain typed `MATCH`es with `UNION ALL`, leading each branch with a literal relationship-name string:

```cypher
MATCH (t:FileNode {id: 'BACK-521'})<-[:ParentOf]-(o:FileNode) RETURN 'ParentOf(parent)', o.id, o.type
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:ParentOf]->(o:FileNode) RETURN 'ParentOf(child)', o.id, o.type
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:DependsOn]->(o:FileNode) RETURN 'DependsOn', o.id, o.type
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})<-[:DependsOn]-(o:FileNode) RETURN 'DependedBy', o.id, o.type
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:BelongsToMilestone]->(o:FileNode) RETURN 'Milestone', o.id, o.type
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:SourcedFrom]->(o:FileNode) RETURN 'SourcedFrom', o.id, o.type
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:LinksTo]->(o:FileNode) RETURN 'LinksTo', o.id, o.type
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:TaggedWith]->(o:Tag) RETURN 'Tag', o.name, 'tag'
LIMIT 100
```

### Creating a User Database

`graph_create_database` creates a durable user database (a snapshot plus a registry entry). It is a write operation and requires an explicit confirmation flag, `acknowledged: true`.

```json
{
  "name": "people",
  "description": "people and their relationships",
  "acknowledged": true
}
```

- `name` must be letters/digits/`_`/`-`, must start with a letter, and cannot be `default`.
- A duplicate or illegal name is an error (`conflict`) with no side effects.
- A user database lives with the project under `<backlog>/databases/` (whichever of `backlog/` or `.backlog/` this project uses) and is kept durable in a JSON snapshot, because the ryu/WASM backend holds its data in WASM memory only.
- Snapshot limits: the whole database is serialised on write and replayed on open, so cost grows with size — comfortable to roughly 1e5 rows.

### Importing a CSV File as Rows

`graph_import_csv` loads a CSV file into a node table, so a spreadsheet can become a graph without writing Cypher by hand. It is a write operation on a **user database** (`default` is read-only and refused).

```json
{
  "db": "people",
  "csv": "data/people.csv",
  "node": "Person",
  "map": { "First Name": "firstName" }
}
```

- `csv` is absolute or relative to the project root. The whole file is parsed and validated **before** the database is opened, so a malformed file leaves the database exactly as it was.
- `node` names the target table; it defaults to a name derived from the CSV file name.
- `map` renames CSV headers to graph property names (keys are headers, values are property names).
- `header` defaults to `true`; set `false` for a headerless file, whose columns become `column1`, `column2`, ….
- **The first column is the primary key.** A row whose key the database already has **updates** that row (the import is an upsert on the key); a key repeated inside one file — the later row wins.
- A missing table is created with types inferred per column: `INT64` → `DOUBLE` → `BOOLEAN`, falling back to `STRING`. An empty cell does not force `STRING`; it becomes NULL.
- Importing into an existing table is checked against its declared columns: a CSV column the table does not have is an error (use `map` to rename it onto one that exists), and so is a value the column's type cannot hold.
- Values keep their commas, quotes and newlines. The one exception is the key column: a newline there is refused, because ryu's `MERGE` would split such a row in two.

### Importing a CSV File as Edges

With `rel`, the same file becomes **edges** instead of nodes: two columns hold the keys of the endpoints, and each row is matched against the nodes the database already has.

```json
{
  "db": "people",
  "csv": "data/knows.csv",
  "rel": "KNOWS",
  "from": "person",
  "to": "friend",
  "node": "Person"
}
```

- Nodes first — edges can only reference keys that exist.
- Endpoint keys are **matched, not created**: a row whose node is missing produces no edge, and the skipped count is reported. The same count covers a row whose edge the pair already has — `MERGE` never stacks a duplicate edge, so re-importing a file is safe.
- `fromNode` / `toNode` name the two endpoint tables, needed only when the relationship table does not exist yet; `node` is shorthand for "both endpoints are this table". Once the table exists, its own declaration names the endpoints and their keys.
- Two different endpoint tables: `{ "rel": "WORKS_AT", "from": "employee", "to": "employer", "fromNode": "Person", "toNode": "Company" }`.
- A missing relationship table is created as `CREATE REL TABLE <name>(FROM <from-node> TO <to-node>)`. Relationship tables carry no properties in the snapshot, so any other column in the file is ignored.
- A numeric endpoint key is matched with a cast, so an `INT64` primary key works like a `STRING` one.

### What the Graph Contains

The graph mirrors the Markdown corpus under `backlog/`:

- **Nodes**
  - `FileNode` — one per Markdown file. Properties: `path` (primary key, e.g. `backlog/tasks/back-521 - Title.md`), `id` (stored **UPPERCASE**, e.g. `BACK-521`), `type` (`task` / `doc` / `decision` / `draft` / `milestone` / …), `title`, `status`, `updatedDate`.
  - `Tag` — one per distinct tag used in the corpus. Property: `name`.
  - `Meta` — internal bookkeeping; not meaningful for queries.
- **Relationships** (all `FROM FileNode`, `TO FileNode` unless noted; directions are as stored)
  - `ParentOf` — parent → child hierarchy
  - `BelongsToMilestone` — task → milestone
  - `DependsOn` — dependent → dependency
  - `SourcedFrom` — task → source reference
  - `LinksTo` — task → linked file
  - `TaggedWith` — `FileNode` → `Tag`

> **Note**: the node label is `FileNode`, **not** `File`. `MATCH (n:File)` returns `Table File does not exist`.

### Graph legend config

The graph legend (per-type colours, captions, rule buckets, relation line styles, hidden buckets) is a project file, not a tool in this toolset: `backlog/databases/graph-legends.yaml`, a YAML mapping of database name → config. The CLI, the server and the Web UI's legend panel all read and write this one file, so every edit lands in the same place. Manage it through the CLI `backlog graph legend` family (direct file access - no server, no HTTP) or by editing the file itself:

```bash
# Print the stored legend config for a database (human-readable summary)
backlog graph legend get default

# Same, as raw JSON (for scripts / piping)
backlog graph legend get default --json

# Import one database's config from a YAML file (a JSON payload parses too - YAML is a superset)
backlog graph legend set demo legend.yaml

# Or read the config from standard input
cat legend.yaml | backlog graph legend set demo --stdin

# Remove a database's legend entry (idempotent: removing an absent one is a no-op)
backlog graph legend remove demo
```

- `get <database>` prints a human-readable summary by default (captions toggle, per-type colour / caption / rules, per-relation line style, hidden buckets); `--json` prints the raw JSON. An unknown database prints a "no config" message and exits 0.
- `set <database> <file>` takes **one database's config** - the inner mapping in the example below, not the whole store (the CLI wraps it under the database name). Invalid YAML, or a non-mapping payload (array / scalar), exits non-zero and leaves the store file untouched.
- Saving in the Web UI's legend panel **pins the automatic type colours** into the file: every type that had no explicit colour gets the one it was painted with, so the file records the whole picture instead of leaving those colours to be re-derived from the type name on every visit. The `×` next to a colour in the panel returns that type to automatic again.

#### Config structure

`graph-legends.yaml` maps each database name to its config. One config - the payload `set` writes - has four top-level keys:

- `captionsVisible` — bool, default `true`; `false` hides every node caption.
- `types` — map of node label → type settings. **Always include the key** (`{}` when empty): a config without `types` resets wholesale to the defaults on load.
- `relations` — map of relationship type → line settings; a type with no entry draws as a solid arrowed line.
- `hidden` — list of switched-off bucket keys: `"t:FileNode|s:r2"` (one rule bucket), `"t:Meta|s:type:only"` (a whole type), `"t:FileNode|s:rule:other"` (a type's catch-all).

Type settings (one entry of `types`):

- `caption` — template with `{{field}}` placeholders; empty guesses the first of `name` / `title` / `key` / `label` / `id` the type's nodes carry.
- `color` — `#rrggbb`; absent = an automatic hue derived from the label.
- `otherColor` — `#rrggbb`; the catch-all bucket's colour; absent = the type's deepest lightness step.
- `rules` — ordered list; the first match wins, the rest land in the catch-all.

Rule settings (one entry of `rules`):

- `id` — **required**, any non-empty unique string; a rule without one is dropped on load.
- `name` — the bucket's label in the legend.
- `expression` — a boolean condition over the node's own properties (grammar below); empty matches nothing.
- `color` — `#rrggbb`; absent = the type's lightness ramp decides.

Relation settings (one entry of `relations`):

- `dash` — `solid` | `dashed` | `dotted` | `long`; absent or unknown degrades to `solid`.
- `arrow` — `none` | `end` | `start` | `both`; absent or unknown degrades to `end`.
- `color` — `#rrggbb`; absent = the theme's default grey.
- `name` — display name replacing the raw type in the legend and on the edge.

A complete store file (`set` takes the part under one database name):

```yaml
demo:
  captionsVisible: true
  types:
    Person:
      caption: "{{name}} ({{age}})"  # {{field}} placeholders; empty guesses name/title/key/label/id
      color: "#204af3"               # absent = automatic hue derived from the label
      otherColor: "#93b4ff"          # catch-all bucket colour; absent = deepest lightness step
      rules:                         # ordered, first match wins; the rest land in the catch-all
        - id: r1                     # required: a rule without a non-empty id is dropped on load
          name: young
          expression: "age < 30"
        - id: r2
          name: senior
          expression: "age >= 60"
          color: "#b91c1c"           # absent = the type's lightness ramp decides
    Company:
      caption: "{{name}}"
      color: "#42d78c"
  relations:
    KNOWS:
      dash: dashed                   # solid | dashed | dotted | long (unknown degrades to solid)
      arrow: both                    # none | end | start | both (unknown degrades to end)
      color: "#0ef19a"               # absent = the theme's default grey
      name: works at                 # display name replacing the raw type in the legend
  hidden: []
```

**Rule expressions** are boolean conditions over a node's own properties: the comparisons `== != > >= < <=` over numbers, strings and booleans, plus `contains` and `startsWith` over text (case-insensitive), combined with `&&`, `||`, `!` and parentheses. String literals are quoted (`type == "task"`); a bare property is a value, never a test. A property a node does not carry reads as null and fails to match, so a rule written for one result never breaks the next. Within a type the matched rule owns the colour's lightness step (or its explicit colour) while the type owns the hue.

**Writing by hand.** The loader keeps whatever still makes sense and drops the rest rather than refusing to open, so a typo degrades quietly instead of failing loudly: write colours as 6-digit hex (`#f00`, `rgb(...)` and named colours are dropped), and match the graph's own vocabulary with exact casing (node labels as Cypher returns them, relationship types uppercase) - unknown fields are ignored and an expression that fails to compile matches nothing. After writing, read it back with `backlog graph legend get <database>` to confirm it parses the way you intended.

### Key Rules

- `default` is read-only: it is a derived cache of the Markdown corpus, and no tool writes to it. Writing is possible only on a user database, via `graph_create_database` (create) and `graph_import_csv` (rows/edges).
- Every tool opens the database, answers, and closes it. `default` is rebuilt from the corpus on each call; a user database is replayed from its snapshot, which is also what makes it durable. The Web UI keeps its own copy of a user database in the server process; the snapshot is the only thing the two share, and it is replaced atomically.
- `graph_schema` describes a database (node tables + properties, relationship tables + endpoints); `graph_list_databases` inventories databases; `graph_describe_database` reports one database's metadata and counts; `graph_query` reads; `graph_import_csv` writes a CSV; `graph_create_database` creates a user database.
- Results are capped at 500 rows; the response notes truncation when the cap is hit. Narrow the query with `WHERE` / `LIMIT` to see more.
- A write tool requires explicit intent (`graph_create_database` needs `acknowledged: true`) and is refused for `default`.
- The graph legend (per-type colours, captions, rule buckets, line styles, hidden buckets) is a project file, `backlog/databases/graph-legends.yaml`, managed through the CLI `backlog graph legend` family - this toolset has no legend tool. See Graph legend config.

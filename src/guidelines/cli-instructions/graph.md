## Graph

The `graph` command runs read-only Cypher queries against the project's task/knowledge graph from the command line. It is the CLI counterpart to the Web UI's Cypher search (the magnifier dialog in `backlog browser`). Each call builds the graph in memory from the Markdown corpus and runs your query against it.

Use `backlog graph schema` to see the graph's structure, and `backlog graph query` to explore task structure, dependencies, milestones, tags, and cross-file links without opening the browser — for ad-hoc analysis, scripting, or piping results into other tools.

> **Important**: Queries are strictly read-only. Write keywords (`CREATE` / `DROP` / `DELETE` / `INSERT` / `MERGE` / `SET` / `UPDATE`) are rejected, and the graph and corpus are never modified. The CLI builds a fresh in-memory graph on every run (the ryu/WASM backend does not persist between processes), so each call is independent of the Web UI's graph and takes a few seconds to build.

### CLI Usage

The `graph` command works against a named **database**: `default` (the derived markdown graph) or a user database you create. Its subcommands are `query` / `insert` (Cypher), `import` (CSV), `schema` / `show-schema`, `list`, `describe`, and `create` / `drop`.

#### Inspecting the graph schema

`backlog graph schema` prints the graph's structure — every node table with its properties, and every relationship table with its endpoints — so you do not have to know the labels up front. It introspects ryu with the read-only procedures `show_tables` / `table_info` / `show_connection`.

```bash
backlog graph schema
```
```
Node tables (NODE)
  FileNode
    path  STRING  (primary key)
    id  STRING
    type  STRING
    title  STRING
    status  STRING
    updatedDate  STRING
  Meta
    name  STRING  (primary key)
    value  STRING
  Tag
    name  STRING  (primary key)

Relationship tables (REL)
  FileNode -[:ParentOf]-> FileNode
  FileNode -[:BelongsToMilestone]-> FileNode
  FileNode -[:DependsOn]-> FileNode
  FileNode -[:SourcedFrom]-> FileNode
  FileNode -[:LinksTo]-> FileNode
  FileNode -[:TaggedWith]-> Tag
```

`--json` prints the same information as a machine-readable object:

```bash
backlog graph schema --json
# -> {
#      "nodes": [
#        { "name": "FileNode", "properties": [
#            { "name": "path", "type": "STRING", "primaryKey": true }, … ] },
#        …
#      ],
#      "relationships": [
#        { "name": "ParentOf", "from": "FileNode", "to": "FileNode" },
#        …
#      ]
#    }
```

The three underlying procedures are also reachable directly through `query` when you want them raw:

```bash
# All tables (name + kind)
backlog graph query default "CALL show_tables() RETURN name, type"

# Columns of one node table ("primary key" is a space-containing reserved name -> backticks)
backlog graph query default "CALL table_info('FileNode') RETURN name, type, \`primary key\`"

# Endpoints of one relationship table (REL tables only)
backlog graph query default "CALL show_connection('ParentOf') RETURN \`source table name\`, \`destination table name\`"
```

**Schema notes**: the node label is `FileNode` (**not** `File`); `CALL db.labels()` does not exist in ryu (`Parser exception`); `show_connection` works only on relationship tables. Relationship tables carry no user properties, so `table_info` on them returns nothing — use `show_connection` for their endpoints.

#### Databases

Every command takes a database name. `default` is the derived graph of the markdown corpus: a rebuildable **cache**, always read-only, rebuilt in-process on each run. Anything you create with `backlog graph create` is a **user database**: it lives with the project under `<backlog>/databases/` (whichever of `backlog/` or `.backlog/` this project uses) and is kept durable in a JSON snapshot, because the ryu/WASM backend holds its data in WASM memory only.

```bash
# What exists
backlog graph list

# Create one, then give it a schema and data
backlog graph create people "people and their relationships"
backlog graph insert people "CREATE NODE TABLE Person(name STRING PRIMARY KEY, age INT64)"
backlog graph insert people "CREATE REL TABLE KNOWS(FROM Person TO Person)"
backlog graph insert people "CREATE (:Person {name: 'Alice', age: 30}), (:Person {name: 'Bob', age: 41})"
backlog graph insert people "MATCH (a:Person {name: 'Alice'}), (b:Person {name: 'Bob'}) CREATE (a)-[:KNOWS]->(b)"

# Read it back - in any later process, the snapshot is reloaded automatically
backlog graph query people "MATCH (a:Person)-[:KNOWS]->(b:Person) RETURN a.name, b.name"
backlog graph describe people

# Remove it, snapshot included
backlog graph drop people
```

- `insert` takes write Cypher (`CREATE` / `MERGE` / `SET` / `DELETE`) and re-dumps the snapshot after every successful statement. Each `insert` is one statement followed by one snapshot write - durable, but not a transaction across statements.
- `insert` is **refused for `default`**: that graph is a derived cache, and the next rebuild would overwrite anything written into it. Create a user database instead.
- `list` reads the registry only (instant). `describe` and every other command open the database first, so `describe default` pays the full corpus rebuild.
- Snapshot limits: the whole database is serialised on write and replayed on open, so cost grows with database size - comfortable to roughly 1e5 rows.
- A `query` that names its labels only replays the tables it needs (`MATCH (a:Person)-[:WORKS_AT]->(b:Company)` loads `Person`, `Company` and `WORKS_AT`, nothing else). Anything that cannot be pinned down - `CALL show_tables()`, an unlabelled `MATCH (n)`, a label the database does not have - replays the whole snapshot, so a scoped load can never answer "no rows" because a table was missing.
- The Web UI (`backlog browser`) has a **Databases** page listing every database and running read-only Cypher against one. It is a resident process, so a user database it has opened stays loaded until its snapshot changes; a `query` run in the meantime sees the change and replays it. `default` on that page is answered by the same corpus rebuild the graph search uses.

#### Importing a CSV file

`backlog graph import <db> <csv>` loads a file of rows into a node table, so a spreadsheet can become a graph without writing Cypher by hand:

```bash
# Create the table `people` from the file name, with column types inferred from the data
backlog graph import people data/people.csv

# Name the table yourself, and rename a header that is not a valid property name
backlog graph import people data/people.csv --node Person --map "First Name=firstName"

# A headerless file: columns become column1, column2, …
backlog graph import people data/raw.csv --no-header --node Raw
```

- The file is read with node's `fs` and inserted with batched parameterised `UNWIND`. ryu's `COPY FROM` is never used: under the WASM build it silently imports zero rows.
- **The first column is the primary key.** A row whose key the database already has **updates** that row (import is an upsert on the key), so re-importing a corrected file does what one expects. A key repeated inside one file: the later row wins.
- A missing table is created with types inferred per column: `INT64` → `DOUBLE` → `BOOLEAN`, falling back to `STRING`. An empty cell does not force `STRING`; it becomes NULL.
- Importing into a table that already exists is checked against its declared columns: a CSV column the table does not have is an error (use `--map` to rename it onto one that exists), and so is a value the column's type cannot hold.
- A malformed file - a ragged row, an unclosed quote, a header-only file, a duplicate or invalid column name - is reported with its line number **before** the database is opened, so the database is left exactly as it was.
- Values keep their commas, quotes and newlines. The one exception is the key column: a newline there is refused, because ryu's `MERGE` would split such a row in two.
- `--force` skips the snapshot fingerprint check, like the other write commands.

#### Importing a CSV file as edges

With `--rel`, the same file becomes **edges** instead of nodes: two columns hold the keys of the endpoints, and each row is matched against the nodes the database already has.

```bash
# Nodes first - the edges can only reference keys that exist
backlog graph import people data/person.csv --node Person

# A self-referencing edge table: Person -[:KNOWS]-> Person
backlog graph import people data/knows.csv --rel KNOWS --from person --to friend --node Person

# Two different endpoint tables
backlog graph import people data/works.csv --rel WORKS_AT --from employee --to employer \
  --from-node Person --to-node Company
```

- Endpoint keys are **matched, not created**: a row whose node is missing produces no edge, and the CLI reports how many rows were skipped. The same count covers a row whose edge the pair already has - `MERGE` never stacks a duplicate edge, so re-importing a file is safe.
- `--from-node` / `--to-node` are only needed when the relationship table does not exist yet; `--node` is shorthand for "both endpoints are this table". Once it exists, its own declaration names the endpoints and their keys, so the options can be left out.
- A missing relationship table is created as `CREATE REL TABLE <name>(FROM <from-node> TO <to-node>)`. Relationship tables carry no properties in the snapshot, so any other column in the file is ignored.
- A numeric endpoint key is matched with a cast, so an `INT64` primary key works like a `STRING` one.

#### Running a Cypher query

```bash
# Count every node in the graph
backlog graph query default "MATCH (n:FileNode) RETURN count(n)"

# List files with their type, newest path first
backlog graph query default "MATCH (n:FileNode) RETURN n.type, n.path ORDER BY n.path LIMIT 10"

# Walk a relationship (edge is directed parent -> child, so a is the parent, b is the child)
backlog graph query default "MATCH (a:FileNode)-[:ParentOf]->(b:FileNode) RETURN a.path, b.path LIMIT 10"

# Aggregate by tag
backlog graph query default "MATCH (n:FileNode)-[:TaggedWith]->(t:Tag) RETURN t.name, count(n) ORDER BY count(n) DESC LIMIT 10"
```

#### Task relationship graph by task ID

To explore a single task's associations (its "task relationship graph"), anchor the query on the task `id` and traverse its relationships. This is the most useful pattern for understanding how one task fits into the project. **Task IDs are stored UPPERCASE** (e.g. `BACK-521`, not `back-521`).

In this graph the `ParentOf` hierarchy edge is directed **from parent to child**: a parent points at its child via `ParentOf` (`parent -[:ParentOf]-> child`). Other edges follow their own direction — e.g. `DependsOn` points from the dependent to its dependency (`dependent -[:DependsOn]-> dependency`). Keep each edge's direction in mind when choosing `-[:Rel]->` vs `<-[:Rel]-`.

```bash
# Look up one task by its ID
backlog graph query default "MATCH (t:FileNode {id: 'BACK-521'}) RETURN t.id, t.title, t.type, t.status"

# Parent task it sits under. Edge is parent -> child, so follow it backwards with <-[:ParentOf]-.
# BACK-521 is top-level, so this is empty; a subtask like BACK-521.2 would return BACK-521.
backlog graph query default "MATCH (c:FileNode {id: 'BACK-521.2'})<-[:ParentOf]-(p:FileNode) RETURN p.id, p.title"

# Child / subtasks it parents. Edge is parent -> child, so follow it forwards with -[:ParentOf]->.
backlog graph query default "MATCH (p:FileNode {id: 'BACK-521'})-[:ParentOf]->(c:FileNode) RETURN c.id, c.title, c.status"

# What it depends on (task -[:DependsOn]-> dependency)
backlog graph query default "MATCH (t:FileNode {id: 'BACK-521'})-[:DependsOn]->(d:FileNode) RETURN d.id, d.title"

# What depends on it
backlog graph query default "MATCH (d:FileNode)-[:DependsOn]->(t:FileNode {id: 'BACK-521'}) RETURN d.id, d.title"

# Milestone it belongs to (task -[:BelongsToMilestone]-> milestone)
backlog graph query default "MATCH (t:FileNode {id: 'BACK-521'})-[:BelongsToMilestone]->(m:FileNode) RETURN m.id, m.title"

# Tags attached to the task (task -[:TaggedWith]-> Tag)
backlog graph query default "MATCH (t:FileNode {id: 'BACK-521'})-[:TaggedWith]->(tag:Tag) RETURN tag.name"
```

To see the **entire** relationship map of a task in one result, chain typed `MATCH`es with `UNION ALL`, leading each branch with a literal relationship-name string (ryu does not provide a `type()` function for relationships):

```bash
backlog graph query default "\
MATCH (t:FileNode {id: 'BACK-521'})<-[:ParentOf]-(o:FileNode) RETURN 'ParentOf(parent)', o.id, o.type \
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:ParentOf]->(o:FileNode) RETURN 'ParentOf(child)', o.id, o.type \
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:DependsOn]->(o:FileNode) RETURN 'DependsOn', o.id, o.type \
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})<-[:DependsOn]-(o:FileNode) RETURN 'DependedBy', o.id, o.type \
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:BelongsToMilestone]->(o:FileNode) RETURN 'Milestone', o.id, o.type \
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:SourcedFrom]->(o:FileNode) RETURN 'SourcedFrom', o.id, o.type \
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:LinksTo]->(o:FileNode) RETURN 'LinksTo', o.id, o.type \
UNION ALL MATCH (t:FileNode {id: 'BACK-521'})-[:TaggedWith]->(o:Tag) RETURN 'Tag', o.name, 'tag' \
LIMIT 100"
```

Replace `'BACK-521'` with any task id (uppercase). Use the focused per-type queries when you only care about one relationship; use the `UNION` form for the complete picture.

The query prints as an aligned table (default) or as raw JSON with `--json`. After a table, the CLI prints the match summary (`匹配节点: N ｜ 行数: M`, with a truncation note when the 500-row cap was hit).

`backlog graph query` arguments and options:

- `<db>` (positional, required) — the database to query: `default` or a user database name.
- `[cypher]` (positional) — the Cypher statement. Quote it so the shell does not mangle it; double quotes work on every platform, single quotes on Unix/macOS/WSL. Omit it only in the legacy one-argument form (`backlog graph query "MATCH ..."`), which targets `default`.
- `--json` — print the raw `CypherQueryResult` (`{ columns, rows, nodeKeys, truncated }`) instead of the table. Use this for scripts and pipes.

#### JSON output for scripting

```bash
backlog graph query default "MATCH (n:FileNode) WHERE n.type = 'task' RETURN count(n)" --json
# -> {
#      "columns": ["COUNT(n._ID)"],
#      "rows": [[737]],
#      "nodeKeys": [],
#      "truncated": false
#    }
```

`rows` is a list of rows, each a list of column values; `nodeKeys` lists the matched node keys (used for highlighting in the Web UI, usually empty for aggregated results); `truncated` is `true` when the result exceeded the 500-row cap. Column names come from ryu, so an aggregate gets a generated name — `count(n)` arrives as `COUNT(n._ID)` — read those values by position, or add an explicit alias when a script needs a stable key.

#### What the graph contains

The graph mirrors the Markdown corpus under `backlog/`:

- **Nodes**
  - `FileNode` — one per Markdown file. Properties: `path` (primary key, e.g. `backlog/tasks/back-521 - Title.md`), `id` (stored **UPPERCASE**, e.g. `BACK-521`), `type` (`task` / `doc` / `decision` / `draft` / `milestone` / …), `title`, `status`, `updatedDate`.
  - `Tag` — one per distinct tag used in the corpus. Property: `name`.
  - `Meta` — internal bookkeeping; not meaningful for queries.
- **Relationships** (all `FROM FileNode`, `TO FileNode` unless noted; directions are as stored)
  - `ParentOf` — parent → child hierarchy (`parent -[:ParentOf]-> child`)
  - `BelongsToMilestone` — task → milestone (`task -[:BelongsToMilestone]-> milestone`, the milestone is a `FileNode` with `type: milestone`)
  - `DependsOn` — dependent → dependency (`dependent -[:DependsOn]-> dependency`)
  - `SourcedFrom` — task → source reference (`task -[:SourcedFrom]-> source`)
  - `LinksTo` — task → linked file (`task -[:LinksTo]-> file`)
  - `TaggedWith` — `FileNode` → `Tag`

> **Note**: the node label is `FileNode`, **not** `File`. `MATCH (n:File)` returns `Table File does not exist`.

#### Graph legend config

The legend (per-type colors, captions, line styles and hidden buckets shown in the graph view) lives in a version-controlled file `backlog/databases/graph-legends.yaml` - a YAML mapping of database name to that database's config. The CLI, the server and the Web UI's legend panel all read and write this one file, so every edit lands in the same place.

```bash
# Print the stored legend config for a database (human-readable summary)
backlog graph legend get default

# Same, as raw JSON (for scripts / piping)
backlog graph legend get default --json

# Import a config from a YAML file (a JSON payload parses too - YAML is a superset)
backlog graph legend set demo legend.yaml

# Or read the config from standard input
cat legend.yaml | backlog graph legend set demo --stdin

# Remove a database's legend entry (idempotent: removing an absent one is a no-op)
backlog graph legend remove demo
```

- `get <database>` prints a **human-readable summary** by default (captions toggle, per-type color / caption / rules, per-relation line style, hidden buckets); `--json` prints the raw JSON for scripts. An unknown database prints a "no config" message and exits 0.
- `set <database> <file>` takes **one database's config** - the inner mapping in the example below, not the whole store (the CLI wraps it under the database name). Invalid YAML, or a non-mapping payload (array / scalar), exits non-zero and leaves the store file untouched.
- `remove <database>` deletes that database's entry; removing one that has no config is a no-op (exits 0).
- The CLI edits the file directly (no HTTP, no server needed); a running server watches that file, so an open legend panel picks the change up live. Saving in the Web UI's legend panel **pins the automatic type colors** into the file: every type that had no explicit color gets the one it was painted with, so the file records the whole picture instead of leaving those colors to be re-derived from the type name on every visit. The `×` next to a color in the panel returns that type to automatic again.

##### Config structure

`graph-legends.yaml` maps each database name to its config. One config - the payload `set` writes - has four top-level keys:

- `captionsVisible` — bool, default `true`; `false` hides every node caption.
- `types` — map of node label → type settings. **Always include the key** (`{}` when empty): a config without `types` resets wholesale to the defaults on load.
- `relations` — map of relationship type → line settings; a type with no entry draws as a solid arrowed line.
- `hidden` — list of switched-off bucket keys: `"t:FileNode|s:r2"` (one rule bucket), `"t:Meta|s:type:only"` (a whole type), `"t:FileNode|s:rule:other"` (a type's catch-all).

Type settings (one entry of `types`):

- `caption` — template with `{{field}}` placeholders; empty guesses the first of `name` / `title` / `key` / `label` / `id` the type's nodes carry.
- `color` — `#rrggbb`; absent = an automatic hue derived from the label.
- `otherColor` — `#rrggbb`; the catch-all bucket's color; absent = the type's deepest lightness step.
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
      otherColor: "#93b4ff"          # catch-all bucket color; absent = deepest lightness step
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

**Rule expressions** are boolean conditions over a node's own properties: the comparisons `== != > >= < <=` over numbers, strings and booleans, plus `contains` and `startsWith` over text (case-insensitive), combined with `&&`, `||`, `!` and parentheses. String literals are quoted (`type == "task"`); a bare property is a value, never a test. A property a node does not carry reads as null and fails to match, so a rule written for one result never breaks the next. Within a type the matched rule owns the color's lightness step (or its explicit color) while the type owns the hue.

**Writing by hand.** The loader keeps whatever still makes sense and drops the rest rather than refusing to open, so a typo degrades quietly instead of failing loudly: write colors as 6-digit hex (`#f00`, `rgb(...)` and named colors are dropped), and match the graph's own vocabulary with exact casing (node labels as Cypher returns them, relationship types uppercase) - unknown fields are ignored and an expression that fails to compile matches nothing. After writing, read it back with `backlog graph legend get <database>` to confirm it parses the way you intended.

### Key Rules

- `default` is read-only: it is a derived cache of the markdown corpus, and no command writes to it. Writing is possible only on a user database, via `insert` (Cypher) or `import` (CSV).
- `schema` / `show-schema` describe a database (node tables + properties, relationship tables + endpoints); `list` inventories databases; `describe` reports table sizes; `query` reads; `insert` writes Cypher; `import` loads a CSV; `create` / `drop` manage user databases; `legend` get/set/remove manages the per-database legend config file (see Graph legend config).
- Every CLI command opens the database in memory and closes it on exit. `default` is rebuilt from the corpus on each run (a few seconds on a large corpus), while a user database is replayed from its snapshot - which is also what makes it durable. The Web UI keeps its own copy of a user database in the server process; the snapshot is the only thing the two share, and the CLI replaces it atomically.
- Results are capped at 500 rows. When the cap is hit, `truncated` is `true` (and the table notes the truncation). Narrow the query with `WHERE` / `LIMIT` to see more.
- Use `--json` for machine consumption; the default table is aligned plain text with no ANSI codes, so it is safe to pipe.
- Run from the project root (or a directory inside it) so the CLI can locate `backlog/`.

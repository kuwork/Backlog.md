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
backlog graph query default "MATCH (c:FileNode {id: 'BACK-521'})<-[:ParentOf]-(p:FileNode) RETURN p.id, p.title"

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

### Key Rules

- `default` is read-only: it is a derived cache of the markdown corpus, and no command writes to it. Writing is possible only on a user database, via `insert` (Cypher) or `import` (CSV).
- `schema` / `show-schema` describe a database (node tables + properties, relationship tables + endpoints); `list` inventories databases; `describe` reports table sizes; `query` reads; `insert` writes Cypher; `import` loads a CSV; `create` / `drop` manage user databases.
- Every command opens the database in memory and closes it on exit; nothing is shared with `backlog browser`. `default` is rebuilt from the corpus on each run (a few seconds on a large corpus), while a user database is replayed from its snapshot - which is also what makes it durable.
- Results are capped at 500 rows. When the cap is hit, `truncated` is `true` (and the table notes the truncation). Narrow the query with `WHERE` / `LIMIT` to see more.
- Use `--json` for machine consumption; the default table is aligned plain text with no ANSI codes, so it is safe to pipe.
- Run from the project root (or a directory inside it) so the CLI can locate `backlog/`.

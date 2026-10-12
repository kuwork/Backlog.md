## Graph

The `graph` command runs read-only Cypher queries against the project's task/knowledge graph from the command line. It is the CLI counterpart to the Web UI's Cypher search (the magnifier dialog in `backlog browser`). Each call builds the graph in memory from the Markdown corpus and runs your query against it.

Use `backlog graph query` to explore task structure, dependencies, milestones, tags, and cross-file links without opening the browser — for ad-hoc analysis, scripting, or piping results into other tools.

> **Important**: Queries are strictly read-only. Write keywords (`CREATE` / `DROP` / `DELETE` / `INSERT` / `MERGE` / `SET` / `UPDATE`) are rejected, and the graph and corpus are never modified. The CLI builds a fresh in-memory graph on every run (the ryu/WASM backend does not persist between processes), so each call is independent of the Web UI's graph and takes a few seconds to build.

### CLI Usage

The `graph` command exposes one subcommand, `query`.

#### Running a Cypher query

```bash
# Count every node in the graph
backlog graph query "MATCH (n:FileNode) RETURN count(n)"

# List files with their type, newest path first
backlog graph query "MATCH (n:FileNode) RETURN n.type, n.path ORDER BY n.path LIMIT 10"

# Walk a relationship (edge is directed parent -> child, so a is the parent, b is the child)
backlog graph query "MATCH (a:FileNode)-[:ParentOf]->(b:FileNode) RETURN a.path, b.path LIMIT 10"

# Aggregate by tag
backlog graph query "MATCH (n:FileNode)-[:TaggedWith]->(t:Tag) RETURN t.name, count(n) ORDER BY count(n) DESC LIMIT 10"
```

#### Task relationship graph by task ID

To explore a single task's associations (its "task relationship graph"), anchor the query on the task `id` and traverse its relationships. This is the most useful pattern for understanding how one task fits into the project. **Task IDs are stored UPPERCASE** (e.g. `BACK-521`, not `back-521`).

In this graph the `ParentOf` hierarchy edge is directed **from parent to child**: a parent points at its child via `ParentOf` (`parent -[:ParentOf]-> child`). Other edges follow their own direction — e.g. `DependsOn` points from the dependent to its dependency (`dependent -[:DependsOn]-> dependency`). Keep each edge's direction in mind when choosing `-[:Rel]->` vs `<-[:Rel]-`.

```bash
# Look up one task by its ID
backlog graph query "MATCH (t:FileNode {id: 'BACK-521'}) RETURN t.id, t.title, t.type, t.status"

# Parent task it sits under. Edge is parent -> child, so follow it backwards with <-[:ParentOf]-.
# BACK-521 is top-level, so this is empty; a subtask like BACK-521.2 would return BACK-521.
backlog graph query "MATCH (c:FileNode {id: 'BACK-521'})<-[:ParentOf]-(p:FileNode) RETURN p.id, p.title"

# Child / subtasks it parents. Edge is parent -> child, so follow it forwards with -[:ParentOf]->.
backlog graph query "MATCH (p:FileNode {id: 'BACK-521'})-[:ParentOf]->(c:FileNode) RETURN c.id, c.title, c.status"

# What it depends on (task -[:DependsOn]-> dependency)
backlog graph query "MATCH (t:FileNode {id: 'BACK-521'})-[:DependsOn]->(d:FileNode) RETURN d.id, d.title"

# What depends on it
backlog graph query "MATCH (d:FileNode)-[:DependsOn]->(t:FileNode {id: 'BACK-521'}) RETURN d.id, d.title"

# Milestone it belongs to (task -[:BelongsToMilestone]-> milestone)
backlog graph query "MATCH (t:FileNode {id: 'BACK-521'})-[:BelongsToMilestone]->(m:FileNode) RETURN m.id, m.title"

# Tags attached to the task (task -[:TaggedWith]-> Tag)
backlog graph query "MATCH (t:FileNode {id: 'BACK-521'})-[:TaggedWith]->(tag:Tag) RETURN tag.name"
```

To see the **entire** relationship map of a task in one result, chain typed `MATCH`es with `UNION ALL`, leading each branch with a literal relationship-name string (ryu does not provide a `type()` function for relationships):

```bash
backlog graph query "\
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

- `<cypher>` (positional, required) — the Cypher statement to run. Quote it so the shell does not mangle it; double quotes work on every platform, single quotes on Unix/macOS/WSL.
- `--json` — print the raw `CypherQueryResult` (`{ columns, rows, nodeKeys, truncated }`) instead of the table. Use this for scripts and pipes.

#### JSON output for scripting

```bash
backlog graph query "MATCH (n:FileNode) WHERE n.type = 'task' RETURN count(n)" --json
# -> {
#      "columns": ["count(n)"],
#      "rows": [[<count>]],
#      "nodeKeys": [],
#      "truncated": false
#    }
```

`rows` is a list of rows, each a list of column values; `nodeKeys` lists the matched node keys (used for highlighting in the Web UI, usually empty for aggregated results); `truncated` is `true` when the result exceeded the 500-row cap.

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

- The command is read-only and never writes to the graph or the corpus; write keywords are blocked with a clear error.
- Each invocation builds the graph from scratch in memory and closes it on exit. It does **not** share state with `backlog browser` and does **not** persist across runs, so expect a short build delay (a few seconds on a large corpus).
- Results are capped at 500 rows. When the cap is hit, `truncated` is `true` (and the table notes the truncation). Narrow the query with `WHERE` / `LIMIT` to see more.
- Use `--json` for machine consumption; the default table is aligned plain text with no ANSI codes, so it is safe to pipe.
- Run from the project root (or a directory inside it) so the CLI can locate `backlog/`.

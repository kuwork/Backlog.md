---
title: Graph CLI Commands
labels: [usermanual]
created_date: 2026-10-16 01:00
updated_date: 2026-11-04 00:00
---

# Graph CLI Commands

The `backlog graph` command group lets you run read-only Cypher queries against the project's task/knowledge graph directly from the terminal, and also create your own named databases, write data, and import from CSV. It is the command-line counterpart to the Web interface Cypher search (the magnifying-glass dialog in `backlog browser`), suitable for ad-hoc analysis, scripting, and pipeline output. The complete official guide is always available:

```bash
backlog instructions graph
```

> Queries are strictly read-only: write keywords (`CREATE` / `DROP` / `DELETE` / `INSERT` / `MERGE` / `SET` / `UPDATE`) are rejected; neither the graph nor the Markdown corpus is modified. Run from the project root (or a subdirectory) so the CLI can locate `backlog/`.

## Backend and Performance

- **Backend status**: the default backend is **RyuGraph WASM** (Kuzu's MIT fork built for WebAssembly), executing inside Bun's WebAssembly runtime and working out of the box on all platforms without any environment variables. The native Kuzu dependency has been removed; `BACKLOG_GRAPH_BACKEND=kuzu` is no longer a valid value. `BACKLOG_GRAPH_BACKEND=memory` forces a pure-JS memory fallback mode (Cypher search is not supported). If ryu initialization fails, it automatically falls back to the memory backend without crashing, and prints a one-line English warning explaining the failure path and cause (`database path not visible to the WASM filesystem` means MEMFS cannot see the path; `engine error` means an engine-level failure—only the latter needs to be reported). The database itself lives in the WASM in-memory filesystem, while the cache directory only stores locks and fingerprint sidecars; this is normal.
- **Snapshot reuse**: the first run of a `default` graph command requires a full build (about 6–11 seconds for this repository); the CLI writes the build result as a JSON snapshot to the OS cache directory. After that, as long as the corpus fingerprint, parser version, and graph-structure version have not changed, it restores directly from the snapshot (about twice as fast). When the corpus changes, it automatically rebuilds and refreshes the snapshot. Snapshots are only a cache; deleting them only costs one rebuild.
- **Each invocation is independent**: each CLI run opens the database in memory and closes it on exit, not contending with the graph held by the Web interface (each uses independent slots and locks).

## Database Concepts

Each subcommand operates on a **database name**:

- `default`: the graph derived from Markdown corpus (tasks, drafts, milestones, Wiki, documents, decisions). It is a **read-only cache**; any write operation is rejected and prompts you to use `graph create` instead.
- **User databases**: created with `backlog graph create`; data is persisted as JSON snapshots under `<backlog>/databases/` (can be version-controlled with the project) and is readable/writable across processes.

```bash
backlog graph list                              # list default and all user databases (with sizes)
backlog graph create people "people and their relationships"   # create a user database
backlog graph describe people                   # view description, timestamp, and per-table row counts for a database
backlog graph drop people                       # delete a database and its snapshot (default cannot be deleted)
```

## Viewing the Schema

```bash
backlog graph schema default          # print node tables (with properties and primary keys) and relationship tables (with endpoints)
backlog graph schema default --json   # machine-readable JSON
```

`schema` has the alias `show-schema`. The `default` graph's node tables are `FileNode` (one node per Markdown file, properties include `path` / `id` (uppercase task ID) / `type` / `title` / `status` / `updatedDate`), `Tag`, and `Meta` (internal bookkeeping, meaningless for queries); relationship tables are `ParentOf` (parent → child), `BelongsToMilestone` (task → milestone), `DependsOn` (dependent → dependency), `SourcedFrom`, `LinksTo`, and `TaggedWith`. Note that the node label is `FileNode`, not `File`.

## Running Cypher Queries

```bash
backlog graph query default "MATCH (n:FileNode) RETURN count(n)"
backlog graph query default "MATCH (a:FileNode)-[:ParentOf]->(b:FileNode) RETURN a.path, b.path LIMIT 10"
backlog graph query people "MATCH (a:Person)-[:KNOWS]->(b:Person) RETURN a.name, b.name"
```

- The first positional parameter is the database name, and the second is the Cypher statement (wrap it in quotes; double quotes work across platforms). The old single-argument form `backlog graph query "MATCH ..."` is still valid and equivalent to querying `default`.
- Default output is an aligned plain-text table (no ANSI escapes, safe for pipes); `--json` outputs the raw result object `{ columns, rows, nodeKeys, truncated }` for script consumption.
- Interactive display limit is 500 rows; results beyond that include a truncation hint; `--all` removes this limit and returns all rows.
- Task IDs are stored in uppercase. Pay attention to direction when traversing relationships: `ParentOf` is parent → child, and `DependsOn` is dependent → dependency.

## Writing to User Databases (insert)

```bash
backlog graph insert people "CREATE NODE TABLE Person(name STRING PRIMARY KEY, age INT64)"
backlog graph insert people "CREATE REL TABLE KNOWS(FROM Person TO Person)"
backlog graph insert people "CREATE (:Person {name: 'Alice', age: 30})"
```

`insert` accepts write Cypher (`CREATE` / `MERGE` / `SET` / `DELETE`); each successful statement rewrites the snapshot—persistent but not cross-statement transactional. Writes are protected by a per-database single-holder lock and snapshot fingerprint; `--force` skips fingerprint validation. `default` rejects `insert`. Snapshots are whole-database serialization/replay; they work well up to roughly 1e5 rows.

## Importing CSV

```bash
# Import as nodes: table name defaults to filename; use --node to specify, --map to rename columns
backlog graph import people data/people.csv --node Person --map "First Name=firstName"

# Headerless file: column names auto-generated as column1, column2…
backlog graph import people data/raw.csv --no-header --node Raw

# Import as edges: two columns are the primary keys of the endpoints; endpoints must already exist (matched only, not created)
backlog graph import people data/knows.csv --rel KNOWS --from person --to friend --node Person
```

- **The first column is the primary key**; importing the same file repeatedly upserts existing rows by primary key and does not produce duplicate edges.
- If the table does not exist, it is created automatically and types are inferred from columns (`INT64` → `DOUBLE` → `BOOLEAN`, fallback `STRING`); empty cells become NULL.
- Malformed files (uneven column counts, unclosed quotes, illegal column names, etc.) report line numbers **before** opening the database, leaving the database unchanged.
- Rows whose endpoints cannot be found during edge import are skipped and the skip count is reported; `--from-node` / `--to-node` are only needed when the relationship table does not yet exist.

## Drafts

Drafts capture ideas that are not yet committed work. They are stored as Markdown files in `backlog/drafts/` and differ from `tasks/` (committed, actionable work items).

Use a draft when the request is too vague for concrete acceptance criteria, when the work is exploratory, or when you want to park a possible task before it is ready to implement.

> **Important**: A draft is not a task. Promote it to a task only once the scope is clear enough to write acceptance criteria.

### CLI Usage

The CLI supports creating, listing, viewing, promoting, demoting, and archiving drafts.

#### Creating drafts

For a quick idea capture, use the dedicated draft command:

```bash
backlog draft create "Spike GraphQL resolver"
# -> Created draft DRAFT-1
```

If you already know details such as acceptance criteria, references, priority, or milestones, create a task that starts as a draft instead:

```bash
backlog task create "Spike GraphQL resolver" --draft \
  -d "Explore GraphQL resolver patterns" \
  --ac "Resolver returns correct data for happy path"
```

`backlog draft create` options:

- `-d, --description <text>` — description (multi-line: include real newlines inside the quoted string)
- `--desc <text>` — alias for `--description`
- `-a, --assignee <assignee>` — assignee
- `-s, --status <status>` — status (defaults to `Draft`)
- `-l, --labels <labels>` — comma-separated labels

#### Listing and viewing drafts

```bash
backlog draft list --plain
backlog draft view DRAFT-1 --plain
```

You can use either the bare number (`1`) or the full prefixed ID (`DRAFT-1`) in draft commands.

#### Promoting a draft to a task

When the draft is scoped and ready to implement, promote it:

```bash
backlog draft promote DRAFT-1
# -> Promoted draft 1 to task 7
```

**Note**: the output strips the task prefix and shows only the numeric body of the new task ID. Use that number (`7`) or the full prefixed ID (e.g., `BACK-7`) in the next command.

After promoting, treat the result as a new task: add a description, acceptance criteria, references, and dependencies before starting work.

```bash
backlog task edit 7 -d "Adds a GraphQL resolver for user queries" \
  --ac "Resolver returns correct data for happy path" \
  --ac "Error response matches REST format"
```

#### Demoting a task to a draft

If a task turns out to be too vague or needs more exploration, send it back to drafts:

```bash
backlog task demote BACK-42
# -> Demoted task 42 to draft 5
```

**Note**: the output strips the draft prefix and shows only the numeric body of the new draft ID. Use that number (`5`) or the full prefixed ID (`DRAFT-5`) in the next command.

```bash
backlog draft view 5 --plain
```

If the draft becomes actionable again, promote it with `backlog draft promote 5`.

#### Archiving a draft

Archive a draft that will not be pursued:

```bash
backlog draft archive DRAFT-5
```

### Key Rules

- Draft files live under `backlog/drafts/`. Promoting moves them to `backlog/tasks/` with a new task ID; demoting moves them back to `backlog/drafts/` with a new draft ID.
- `backlog draft promote` and `backlog task demote` output the new ID without its prefix. Use the bare number or the full prefixed ID in the next command.
- Prefer `backlog draft create` for quick captures. Use `backlog task create --draft` when you want to attach rich metadata (acceptance criteria, references, priority, etc.) at creation time.
- Do not edit draft markdown files directly. Use the `backlog draft` and `backlog task` commands so metadata and file naming stay consistent.

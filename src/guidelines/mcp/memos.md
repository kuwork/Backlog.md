## Memos

Memos are quick-capture notes: short, dated, written once and read back as a reverse-chronological feed. They are stored as Markdown files in `backlog/memos/` and differ from `tasks/` (committed, actionable work items) and from `docs/` (titled, curated documentation).

Use a memo for fleeting notes, ideas, and log-style entries that are worth keeping but do not need acceptance criteria, a status, or a title. When a note turns into real work, create a task and reference the memo ID in it.

> **Important**: A memo is not a task and not a document. It has no title and no status; its ID is `YYYYMMDD-N` (date + sequence), so it sorts naturally by day.

### MCP Tools

Memos have their own tool group: `memo_create`, `memo_list`, `memo_view`, `memo_update`, `memo_delete`.

#### Creating memos

```json
// memo_create
{
  "content": "Quick note worth keeping",
  "tags": ["idea", "cli"]
}
```

`content` is required; `tags` is optional. The response reports the created memo ID (`YYYYMMDD-N`).

#### Listing memos

```json
// memo_list — first page
{ "limit": 20 }

// memo_list — filtered
{ "date": "2026-10-01", "tags": ["idea"] }

// memo_list — next page, using the returned cursor
{ "limit": 20, "cursor": "20261001-5" }
```

Results come newest first with a `nextCursor`; it is `null` at the end of the list. `date` narrows to one day (`YYYY-MM-DD`); `tags` keeps memos carrying at least one of the given tags (case-insensitive). List rows are previews, not full bodies — use `memo_view` for the complete memo.

#### Viewing a memo

```json
// memo_view
{ "id": "20261001-1" }
```

Returns the full memo: id, dates, tags, and the complete body. An unknown ID returns a not-found error.

#### Updating a memo

`memo_update` takes `id` plus exactly one of `content` (replace the body) or `append` (add a line to the end); `tags` optionally replaces the tag list:

```json
// replace the body
{ "id": "20261001-1", "content": "Rewritten note" }

// append a line
{ "id": "20261001-1", "append": "One more line" }
```

Passing both `content` and `append`, or neither, is a validation error. Updating bumps the memo's updated date.

#### Deleting a memo

```json
// memo_delete
{ "id": "20261001-1" }
```

Deleting an unknown ID returns a not-found error.

### Key Rules

- Memo files live under `backlog/memos/`; the ID is `YYYYMMDD-N` (date + per-day sequence) and stays stable for the life of the memo.
- Memos have no title: listings show a short preview of the body; use `memo_view` to read the full body.
- The MCP tools, the `backlog memo` CLI commands, and the `/memos` web page share the same storage and ID scheme, so a memo captured through one surface shows up in the others immediately.
- Do not edit memo markdown files directly. Use the `memo_*` tools (or the CLI / web UI) so metadata and file naming stay consistent.

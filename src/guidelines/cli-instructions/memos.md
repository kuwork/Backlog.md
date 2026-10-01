## Memos

Memos are quick-capture notes: short, dated, written once and read back as a reverse-chronological feed. They are stored as Markdown files in `backlog/memos/` and differ from `tasks/` (committed, actionable work items) and from `docs/` (titled, curated documentation).

Use a memo for fleeting notes, ideas, and log-style entries that are worth keeping but do not need acceptance criteria, a status, or a title. When a note turns into real work, create a task and reference the memo ID in it.

> **Important**: A memo is not a task and not a document. It has no title and no status; its ID is `YYYYMMDD-N` (date + sequence), so it sorts naturally by day.

### CLI Usage

The CLI supports creating, listing, viewing, updating, and deleting memos.

#### Creating memos

```bash
backlog memo create --content "Quick note" --tags idea,cli
# -> Created memo 20261001-1
```

When `--content` is omitted, the body is read from stdin, which keeps shell quoting simple and makes multi-line capture easy:

```bash
printf "line one\nline two" | backlog memo create
# -> Created memo 20261001-2
```

`backlog memo create` options:

- `-c, --content <content>` — memo body (multi-line: write `\n` literally inside a single-quoted or double-quoted argument); omit to read the body from stdin
- `-t, --tags <tags>` — tags (comma-separated or use multiple times)

#### Listing memos

```bash
backlog memo list
backlog memo list --limit 5
backlog memo list --plain
backlog memo list --date 2026-10-01
backlog memo list --tags idea,cli
```

Output is one line per memo as `<id>\t<preview>`, newest first — the preview is the first 20 characters of the body with newlines stripped (truncated previews end with `…`); the list never prints full bodies. `--plain` is accepted for script consistency and produces the same output, since the list is already plain text. `--date` narrows the list to one day (`YYYY-MM-DD`), `--tags` keeps memos carrying at least one of the given tags (comma-separated or repeatable, case-insensitive); both combine with pagination. When more memos remain, the last line prints a next-cursor hint; resume from there with `--cursor`:

```bash
backlog memo list --cursor 20261001-5
```

#### Viewing a memo

`backlog memo view` prints the full memo — id, dates, tags, and the complete body:

```bash
backlog memo view 20261001-1
backlog memo view 20261001-1 --plain
```

With `--plain` (or when stdout is not a TTY) the text is printed directly; otherwise it opens in the interactive pager.

#### Updating a memo

`--content` replaces the body; `--append` adds a line to the end. Both bump the memo's updated date:

```bash
backlog memo update 20261001-1 --content "Rewritten note"
backlog memo update 20261001-1 --append "One more line"
```

A memo ID that does not exist is reported as an error.

#### Deleting a memo

```bash
backlog memo delete 20261001-1
# -> Deleted memo 20261001-1
```

### Key Rules

- Memo files live under `backlog/memos/`; the ID is `YYYYMMDD-N` (date + per-day sequence) and stays stable for the life of the memo.
- Memos have no title: listings show a display title derived from the first line of the body; use `backlog memo view <id>` to read the full body.
- The web UI (`backlog browser`, `/memos` page) and the CLI share the same storage and ID scheme, so a memo captured in the terminal shows up in the feed immediately.
- Do not edit memo markdown files directly. Use the `backlog memo` commands (or the web UI) so metadata and file naming stay consistent.

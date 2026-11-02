---
title: CLI Memo Commands
labels: [usermanual]
created_date: 2026-10-03 01:14
updated_date: 2026-11-04 00:00
---

# CLI Memo Commands

The `backlog memo` subcommand group provides fast capture and browsing in the terminal. It shares the same storage module (`src/core/memos.ts`) with the HTTP API and MCP tools, ensuring a single ID scheme and a single file format.

## Creating Memos

```bash
# Inline creation (memo create does not accept positional arguments; body must use --content)
backlog memo create --content "Weekly meeting conclusion: v2 release delayed by one week" --tags meeting

# Multi-line content read from stdin (when --content is omitted)
cat debug.log | backlog memo create --tags debug

# Manual multi-line input: type the body directly in the terminal, end with EOF
backlog memo create --tags debug
# Type the memo, then end with Ctrl+D (Ctrl+Z on the classic Windows console). Ctrl+C aborts.
# First line
# Second line
```

> In an interactive terminal, omitting `--content` enters keyboard capture: prompts go to stderr (so they do not mix into the body), and multiple lines are written as-is. `Ctrl+C` aborts without creating a file (exit code 130). Ending input with an empty body reports `Memo content is empty.` and does not create a file.
>
> **End key**: prefer `Ctrl+D`—VS Code integrated terminal, Git Bash, and Windows Terminal all pass this key to the program as-is, and on Unix/macOS/WSL it produces a real EOF. The classic Windows console (cmd/PowerShell) does not deliver any EOF, so use `Ctrl+Z` instead; note that `Ctrl+Z` is intercepted in VS Code and is a suspend signal in mintty (Git Bash), so use `Ctrl+D` uniformly in those two environments.
>
> Implementation note: in TTY mode the command switches to raw mode to recognize these keys, so echo is handled by the CLI itself (character-by-character echo, `Enter` for new line, `Backspace` to erase the current line). In pipe/redirect mode it remains "read stdin directly, no echo".

- `--content <text>`: inline body; when omitted, read from stdin—direct read for pipes/redirects, keyboard capture in TTY.
- `--tags <tags>`: comma-separated tag list; effective in both input modes.
- On success, the CLI prints the new memo ID (such as `20261003-1`).

## Listing Memos

```bash
backlog memo list

# View memos for a specific day only
backlog memo list --date 2026-10-01

# Filter by tags (comma-separated or repeatable, case-insensitive, any match)
backlog memo list --tags meeting,debug
```

The list outputs the latest first, one line per memo as "ID + one-line preview" (first 20 characters of the body, newlines removed, truncated with ellipsis). Use `memo view` for the full text.

### List Paging

`memo list` supports the same unified paging window options as other list commands:

| Option | Description | Example |
|--------|-------------|---------|
| `--max-count <n>` | Output at most n items | `--max-count 20` |
| `--skip <n>` | Skip the first n items (next page) | `--skip 20` |
| `--count` | Output only the total match count (a single number) | `--count` |

Truncated text output ends with `Showing <first>-<last> of <total> items. Next: backlog memo list --skip <n>`; copy it to page forward. `--count` outputs only a number and cannot be combined with `--json`. The centralized explanation of paging semantics for list commands is in the "List Paging" section of [Search & Sequences](../10-任务管理/04-搜索与序列.md).

### Plain-Text Output

```bash
backlog memo list --plain
```

`--plain` outputs a plain-text list, good for AI agents and scripts to parse. Note: CLI text search output (`backlog search`) **does not** include memo results—memos are treated as Web-only types (consistent with Wiki results); JSON output carries memo summaries.

## Viewing a Memo

```bash
# TTY environment: open scrollable viewer (PageUp / PageDown to page)
backlog memo view 20261003-1

# Non-TTY or --plain: print full text and frontmatter directly
backlog memo view 20261003-1 --plain
```

## Updating a Memo

```bash
# Replace the body
backlog memo update 20261003-1 --content "Corrected conclusion"

# Append a line (preserves existing content)
backlog memo update 20261003-1 --append "Supplement: performance regression located in cache layer"

# Change only tags (body unchanged)
backlog memo update 20261003-1 --tags meeting,important

# Change body and tags together
backlog memo update 20261003-1 --append "Add one sentence" --tags meeting,important

# Clear tags
backlog memo update 20261003-1 --tags ""
```

`--content` and `--append` are mutually exclusive; `--tags` can be combined with either or used alone (changing only tags is a valid update). Providing none of the three errors with `No update options provided.` and exits. Omitting `--tags` leaves the original tags unchanged; passing an empty value `--tags ""` clears tags. Updates refresh `updated_date`.

Tag parsing is consistent with REST `PATCH /api/memos/:id`: trim, drop empty items, deduplicate, and support comma-separated or repeated input (`--tags a --tags b`). Note that memos have no title; modifying the first non-empty line of the body changes the card title shown in lists.

## Deleting a Memo

```bash
backlog memo delete 20261003-1
```

Deletion success prints a confirmation; a non-existent ID is reported clearly.

## Viewing the Usage Guide

The CLI has a built-in memos usage guide:

```bash
backlog instructions memos
```

This guide covers parameters, filtering, paging semantics, and not-found error handling for all subcommands. AI agents read it along with configuration on first load.

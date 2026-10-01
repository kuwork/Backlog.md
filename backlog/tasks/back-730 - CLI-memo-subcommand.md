---
id: BACK-730
title: CLI memo subcommand
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
updated_date: '2026-10-02 01:01'
labels: []
milestone: m-10
dependencies:
  - BACK-728
references:
  - 'src/cli.ts:5006'
  - 'src/cli.ts:5040'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
modified_files:
  - src/cli.ts
ordinal: 300400
actual_start: '2026-10-01 10:28'
actual_end: '2026-10-01 11:26'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Memos live in files, so the fastest capture path is the terminal: backlog memo create "..." should work the same way backlog decision create does. Because memos deliberately do not reuse the doc channel (date+sequence IDs, no title), they need their own lightweight subcommand that shares the same storage module as the HTTP API.

Add a memo command group to src/cli.ts mirroring the existing decision group (decisionCmd at cli.ts:5006) with create / list / update / delete. Every subcommand resolves the project root the same way the neighbouring commands do and delegates to src/core/memos.ts, so CLI and server share one ID scheme and one file format.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog memo create --content "..." [--tags a,b] creates a memo and prints its id
- [x] #2 backlog memo create accepts content from stdin or the --content flag so shell quoting stays simple
- [x] #3 backlog memo list prints one line per memo (id and displayTitle) newest first and honours --limit
- [x] #4 backlog memo list prints a next-cursor hint when more memos remain
- [x] #5 backlog memo update <id> can replace the body with --content or append a line with --append
- [x] #6 backlog memo delete <id> removes the file and reports success
- [x] #7 Each subcommand appears in backlog memo --help with a short description
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the decision command group at src/cli.ts:5006-5131 (create 5008, list 5040, view 5095, update 5131) and copy its house style: addHelpSchema, .option declarations, async .action handlers, and plain-text output.
2. Declare const memoCmd = program.command("memo") next to the other entity command groups, and wrap every subcommand with addHelpSchema so backlog memo --help lists them.
3. memo create: --content <text> for inline text; when --content is omitted, read the body from stdin so shell quoting stays simple and multi-line captures work. --tags takes a comma-separated list. Resolve the project root the same way the neighbouring commands do, call createMemo(root, content, tags), and print the created id.
4. memo list: --limit (default 30), print one line per memo as "<id>\t<displayTitle>" newest first, and print a next-cursor hint when the page is not the last one.
5. memo update <id>: --content replaces the body, --append appends a line; report a clear error when the id does not exist.
6. memo delete <id>: call deleteMemo and report success or a not-found message.
7. Manual verification: run create / list / update / delete against a scratch project created outside the repo and paste the transcript into the implementation notes.
8. Verify: bunx tsc --noEmit, then bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Manual verification against a scratch project outside the repo:
- memo create --content 'First quick note' --tags idea,cli -> Created memo 20261001-1
- printf 'Line one
Line two' | memo create -> Created memo 20261001-2 (stdin path works)
- memo list -> 20261001-2<tab>Line one / 20261001-1<tab>First quick note (newest first)
- memo --help lists create / list / update / delete
Also covered by the agent: update --content, update --append (body becomes 'Rewritten body
Appended line'), delete, unknown-id errors, --limit 0 rejection, and an empty stdin guard.

Follow-up: shipped the missing usage guide. New src/guidelines/cli-instructions/memos.md documents memo create (stdin + --content, --tags), list (--limit/--cursor paging), update (--content/--append), and delete, following the drafts.md guide style; registered as 'backlog instructions memos' (CLI-only instruction guide, not an MCP workflow resource) via workflow-guides.ts; overview.md gained the detailed-guides bullet and the backlog/memos/ directory-layout line. cli.test.ts pinned guide-key list updated. Verified: tsc, biome, and the cli.test.ts instruction tests pass.

Follow-up 2: memo list now accepts --plain (output unchanged - the list was already plain text; the flag exists for script consistency) and a new 'backlog memo view <id>' prints the full memo (id, dates, tags, complete body), paging through scrollableViewer on a TTY and printing directly with --plain or non-TTY, matching 'decision view'. memos.md guide updated with the view section and the --plain note. Manually verified against a scratch project; tsc, biome, and the memo test suites pass.

Follow-up 3: memo list now prints a one-line preview instead of the display title: first 20 characters of the body with newlines stripped, plus an ellipsis when truncated. Full body stays available via 'backlog memo view <id>'. memos.md guide and the help-schema output description updated.

Follow-up 4: memo list gained --date (YYYY-MM-DD, validated) and --tags (comma-separated or repeatable, case-insensitive, matches any tag) filters; corrupt memo files with an empty id are now skipped in listMemos so they never render as blank rows. memos.md documents both. Notes: backlog/memos/ files are scratch data and intentionally not committed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a lightweight `backlog memo` command group so memos can be captured from the terminal.

Changes:
- src/cli.ts: a `memo` command group (create / list / update / delete) placed next to the decision group, each subcommand wrapped with addHelpSchema so `backlog memo --help` describes it.
- create takes --content inline or reads the body from stdin when --content is omitted (multi-line captures stay simple), plus comma-separated --tags.
- list prints "<id>\t<displayTitle>" newest first with --limit and a next-cursor hint when more pages remain.
- update <id> replaces the body with --content or adds a line with --append; delete <id> removes the file. Both report a clear not-found error.

Design notes:
- Memos deliberately do not route through the doc channel (their ids are YYYYMMDD-N and they have no title), so the group calls src/core/memos.ts directly, the same module the HTTP API uses. One ID scheme, one file format.
- The CLI plain search output skips memo results, matching how wiki results are already treated as web-only.

Verification:
- scratch-project transcript in the implementation notes, confirmed again in review (create inline, create from stdin, list, help)
- bun test src/test/cli.test.ts -> 94 pass / 0 fail
- bunx tsc --noEmit and bun run check . clean
<!-- SECTION:FINAL_SUMMARY:END -->

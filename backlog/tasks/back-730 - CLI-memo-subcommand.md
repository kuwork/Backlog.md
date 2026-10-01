---
id: BACK-730
title: CLI memo subcommand
status: To Do
assignee:
  - '@kimi'
created_date: '2026-10-01 10:12'
labels: []
milestone: m-10
dependencies:
  - BACK-728
references:
  - 'src/cli.ts:5006'
  - 'src/cli.ts:5040'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 300400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Memos live in files, so the fastest capture path is the terminal: backlog memo create "..." should work the same way backlog decision create does. Because memos deliberately do not reuse the doc channel (date+sequence IDs, no title), they need their own lightweight subcommand that shares the same storage module as the HTTP API.

Add a memo command group to src/cli.ts mirroring the existing decision group (decisionCmd at cli.ts:5006) with create / list / update / delete. Every subcommand resolves the project root the same way the neighbouring commands do and delegates to src/core/memos.ts, so CLI and server share one ID scheme and one file format.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 backlog memo create --content "..." [--tags a,b] creates a memo and prints its id
- [ ] #2 backlog memo create accepts content from stdin or the --content flag so shell quoting stays simple
- [ ] #3 backlog memo list prints one line per memo (id and displayTitle) newest first and honours --limit
- [ ] #4 backlog memo list prints a next-cursor hint when more memos remain
- [ ] #5 backlog memo update <id> can replace the body with --content or append a line with --append
- [ ] #6 backlog memo delete <id> removes the file and reports success
- [ ] #7 Each subcommand appears in backlog memo --help with a short description
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
- [ ] #4 bunx tsc --noEmit passes
- [ ] #5 bun run check . passes on touched files
- [ ] #6 Manual run of create / list / update / delete against a scratch project is recorded in the implementation notes
<!-- DOD:END -->

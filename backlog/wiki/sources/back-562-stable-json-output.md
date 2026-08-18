---
title: BACK-562 Stable JSON output for read commands
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - cli
  - json
  - api-contract
source_path: backlog/tasks/back-562 - Add-stable-JSON-output-to-read-commands.md
---

# BACK-562 Stable JSON output for read commands

Added a stable, versioned `--json` output to read commands: `task list`, `task view`, the bare `task` shorthand, `search`, and `doc list`.

## Summary

- Added `src/utils/read-output-mode.ts` with `resolveReadOutputMode(options, hasInteractiveTTY)` returning `json`/`plain`/`interactive` and rejecting `--json` combined with `--plain`.
- Added `src/formatters/json-output.ts` with fork-adapted contract envelopes (`schemaVersion: 1, kind`), nullable fields, ISO date normalization (`normalizePublicDate`), project-relative paths, and `printJson` writing only to stdout.
- `src/cli.ts` wires `--json` into search, task list, task view, and the bare task shorthand; a `preSubcommand` hook rejects `--json` on non-read task subcommands.
- Contract omits `type` (fork Task has none), includes fork date fields (`dueDate`, `plannedStart`, `plannedEnd`, `actualStart`, `actualEnd`), and serializes wiki search results.
- Missing-task view now exits with code 1.
- Follow-up: `doc list` also gained `--json` with a versioned document-list envelope.

## Implementation Notes

Deliberately did not port the upstream `printDuplicateIntegrityWarning` gate: duplicate-ID integrity stays a `backlog doctor` and Web `/api/tasks/duplicate-ids` concern. Verified by `read-output-mode` unit tests and `cli-json-output` integration tests.

## Related Concepts

- [[concepts/cli-entry]] — CLI command surface
- [[concepts/json-output]] — Stable JSON output contract

## Related Sources

- [[sources/back-545-cli-task-edit-numeric-id]] — Numeric ID lookup in task edit

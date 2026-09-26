---
title: BACK-657 Watch task lists with the existing JSON output
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - json-output
  - watch
  - upstream-migration
source_path: backlog/tasks/back-657 - Watch-task-lists-with-the-existing-JSON-output.md
---

# BACK-657 Watch task lists with the existing JSON output

Subscribers needed a live task list: a complete initial list and refreshed full lists when local state changes. This task adds `task list --json --watch`, streaming exactly the existing JSON schema — a current-state stream with no event wrappers, cursors, or per-change events.

## Summary

- The task-list action was lifted into `runTaskList(options, emitJson = printJson)` (`src/cli.ts:2393`) so repeated reads cannot drift from the one-shot command: options are re-validated and filters, sorting, limits, `--ready`, and local-only scope are re-resolved on every read; the watch path only supplies a different sink
- The watch loop is upstream's file ported byte for byte (`src/commands/watch-json.ts`): attach directory notifications before the first read, emit full pretty-printed replacements (byte-identical to one-shot `--json`), suppress unchanged bytes, reconcile periodically to recover missed notifications, and shut down bounded on SIGINT/SIGTERM, closed pipe, slow reader, or read failure
- Two behaviours the fork lacked: a duplicate task identity discovered after the first response now fails the JSON read closed (colliding files named on stderr, exit 1) via the ported `duplicate-detection.ts` formatter; and an empty JSON result now emits an empty envelope instead of `No tasks found.` — the loop must never leave a subscriber without a replacement list
- Platform finding: on Windows, a signal-stopped child whose cwd is the project directory leaves it permanently unremovable (EBUSY) for the test process lifetime, so the integration suite runs the CLI from the repo root and points it at the temp project through `BACKLOG_CWD`; killed children's stdout/stderr never report end, so reads settle on `process.exited`
- Documentation landed where this fork is actually read (upstream's JSON-section anchors don't exist here): the `task list` help schema, `CLI-INSTRUCTIONS.md`, and the shipped overview/execution guides — every example names a filtered scenario (live queue for one assignee), never a bare list-all
- Verified: both new suites red first (6/6 failing with `unknown option '--watch'`), then 49 + 104 cases green, and a real-CLI smoke where the live frame matched the one-shot read byte for byte and SIGTERM exited 143 with empty stderr

## Acceptance Criteria

- `task list --json --watch` writes the complete initial list as one pretty-printed JSON document, byte-identical to the one-shot command for the same filters
- Full replacements are emitted on change (including an empty `tasks` array), unchanged bytes suppressed, missed notifications recovered by periodic reconciliation
- Filters, sorting, limits, `--ready`, and local-only scope are re-resolved on every read through the same action as the one-shot command
- A duplicate identity fails the JSON read closed; `--watch` requires `--json`, is rejected with `--plain`, and invalid input is rejected before any response
- Shutdown is bounded on signals, closed pipe, slow reader, and read failure

## Related Concepts

- [[concepts/json-output]] — the versioned JSON contract the watch stream reuses verbatim
- [[concepts/cli-instructions]] — where the watch contract is documented in this fork
- [[concepts/upstream-migration]] — ports upstream BACK-686 (39912b864)

## Related Sources

- [[sources/back-658-json-readiness-publication]] — dependency: watch frames carry the `isReady` field BACK-658 added
- [[sources/back-562-stable-json-output]] — the stable JSON output the stream is byte-identical to
- [[sources/back-538-duplicate-task-id-recovery]] — duplicate identity handling; watch now fails closed on it

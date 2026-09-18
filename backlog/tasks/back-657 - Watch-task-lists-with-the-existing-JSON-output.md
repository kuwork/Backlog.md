---
id: BACK-657
title: Watch task lists with the existing JSON output
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-12 11:22'
updated_date: '2026-09-18 20:22'
labels:
  - cli
dependencies:
  - BACK-658
references:
  - 'src/commands/watch-json.ts:6'
  - 'src/commands/watch-json.ts:70'
  - 'src/commands/watch-json.ts:81'
  - 'src/commands/watch-json.ts:93'
  - 'src/cli.ts:2385'
  - 'src/cli.ts:2393'
  - 'src/cli.ts:2406'
  - 'src/cli.ts:2557'
  - 'src/cli.ts:2803'
  - 'src/cli.ts:2835'
  - 'src/cli.ts:2841'
  - 'src/cli.ts:2848'
  - 'src/formatters/json-output.ts:278'
  - 'src/utils/duplicate-detection.ts:76'
  - 'src/guidelines/cli-instructions/overview.md:202'
  - 'src/guidelines/cli-instructions/task-execution.md:179'
  - 'CLI-INSTRUCTIONS.md:59'
  - 'CLI-INSTRUCTIONS.md:88'
  - 'src/test/watch-json.test.ts:1'
  - 'src/test/cli-json-watch.test.ts:1'
modified_files:
  - src/commands/watch-json.ts
  - src/cli.ts
  - src/formatters/json-output.ts
  - src/utils/duplicate-detection.ts
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/task-execution.md
  - CLI-INSTRUCTIONS.md
  - src/test/watch-json.test.ts
  - src/test/cli-json-watch.test.ts
actual_start: '2026-09-18 19:35'
actual_end: '2026-09-18 19:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Subscribers need a complete initial task list and refreshed full lists when local task state changes. Add task list --json --watch using exactly the existing JSON schema, fields, formatting, filters, sorting and limits. The agreed scope is a current-state stream, without event wrappers, cursors or individual change events.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-686` and `git show 39912b864`, and confirm each stated change against the fork before porting it.
- [x] #2 `task list --json --watch` writes the complete initial matching list as one pretty-printed JSON document followed by a newline, byte-identical to the one-shot `task list --json` for the same filters.
- [x] #3 A full replacement is emitted whenever the result changes, including an empty `tasks` array, and a response whose bytes did not change is suppressed; missed filesystem notifications are recovered by the periodic reconciliation.
- [x] #4 Filters, sorting, limits, `--ready` and local-only scope are re-resolved on every read through the same action the one-shot command uses, so a watch response cannot disagree with that command run once.
- [x] #5 A duplicate task identity that appears after the first response fails the JSON read closed: the colliding files are named on stderr and the process exits 1 instead of publishing a list the schema cannot disambiguate.
- [x] #6 `--watch` requires `--json` and is rejected with `--plain`; invalid filters and limits are rejected before any response is written.
- [x] #7 Shutdown is bounded: SIGINT/SIGTERM, a closed output pipe, a slow reader and a read failure each end the loop, release the watchers and timers, and leave no replacement for a failed read.
- [x] #8 The fork's own surfaces document the contract - the `task list` help schema, `CLI-INSTRUCTIONS.md` and the shipped CLI guides - because upstream's JSON-section anchors do not exist here; every example names a filtered scenario rather than the whole list.
- [x] #9 `bunx tsc --noEmit`, `bun run check .`, the two new suites and the affected suites pass, and every new case was first confirmed red against the unmodified code.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the canonical task-list action and serializer for one-shot and repeated reads, including fresh validation and local-only semantics. 2. Add a bounded watch loop: attach directory notifications before the first read, serialize refreshed full responses, suppress unchanged bytes, reconcile periodically, and clean up signals/output failures. 3. Document the existing pretty-printed JSON framing and replacement semantics. 4. Test byte equality, changes and filters, readiness, invalid input, empty lists, slow output and termination; run type, lint and relevant test checks; review for simplification.

5. Include watch filesystem and stdio tests in the platform CI selection and resolve PR review findings before merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fork shape: this fork already funnelled every JSON read through `printJson`, so the serializer was split rather than rewritten (`src/formatters/json-output.ts:278`) and the watch loop is upstream's file ported byte for byte (`src/commands/watch-json.ts:6`). The task-list action was lifted into `runTaskList(options, emitJson = printJson)` (`src/cli.ts:2393`) so repeated reads cannot drift from the one-shot command: options are re-validated, filters, sorting, limits and the readiness projection are all recomputed on every read, and the watch path only supplies a different sink. `--watch` itself is a thin wrapper that checks the output mode and hands `[backlogDir, dirname(configFilePath)]` to the loop (`src/cli.ts:2835`, `src/cli.ts:2841`, `src/cli.ts:2848`).

Two behaviours the fork did not have and the upstream contract needs. A duplicate task identity is now detected before the list is built and fails the JSON read closed, with the colliding files named on stderr (`src/cli.ts:2385`, `src/cli.ts:2406`), using the formatter the fork was missing (`src/utils/duplicate-detection.ts:76`, ported verbatim; upstream's unused `formatDuplicateTaskIdSummary` was deliberately left out). And an empty JSON result now emits an empty envelope instead of the `No tasks found.` text (`src/cli.ts:2557`), because the loop must never leave a subscriber without a replacement list; the plain and interactive paths keep the old text unchanged. Before this task the fork was silent about duplicates - two files claiming one ID listed as two rows and exited 0.

Platform finding, and it is the reason the test harness does not look like upstream's. On Windows a child spawned with its project directory as `cwd` and then stopped by signal leaves that directory permanently unremovable: `safeCleanup` fails with EBUSY for the lifetime of the test process. A minimal probe with a bare `bun -e` child reproduces it while a child that exits on its own does not, so it is neither the watch loop nor `fs.watch`. The integration suite therefore runs the CLI from the repository root and points it at the temporary project through `BACKLOG_CWD`, the pattern `src/test/mcp-stdio-exit.test.ts:151` already uses; the project directory is never any process's working directory and the suite left no residue. A second platform behaviour is folded into the stream collector: a killed child's stdout and stderr never report end here, so reads settle on `process.exited` instead of hanging on a final chunk that cannot arrive.

Verification. Against the unmodified code both new suites are red - `src/test/watch-json.test.ts` cannot import the command at all, and `src/test/cli-json-watch.test.ts` fails 6 of 6 with `unknown option '--watch'`. Restored, they are 6 pass and 6 pass. The combined gate over the two new suites plus `readiness.test.tsx`, `cli-task-list-ready.test.ts` and `cli-json-output.test.ts` is 49 pass with 0 fail, the guide consumers `cli.test.ts` and `mcp-server.test.ts` are 104 pass with 0 fail, `bunx tsc --noEmit` is clean, `bun run check .` reports 421 files with 0 errors and the three pre-existing `assets.ts` non-null-assertion warnings, and the guide example contract verifier passes every check.

Real CLI rather than the harness: `task list --json --watch --limit 2` in this repository writes one 1515-byte envelope that is byte-identical to the one-shot read, every row carries `isReady`, and SIGTERM exits 143 with empty stderr. Against a temporary project, creating a second task produced a second full frame containing both tasks - again byte-identical to the one-shot read - with the same exit code and empty stderr, which also confirms that the `BACKLOG_CWD` harness resolves the project, its watch targets and its config exactly as a working directory would.

Documentation diverges from upstream by necessity: the fork's `CLI-INSTRUCTIONS.md` has no JSON section and `src/guidelines/cli-instructions/overview.md` carries no `--json` guidance, so upstream's paragraphs had no anchor to edit. The contract is documented where this fork is actually read - the `task list` help schema (the `watch` field, the output contract and an example), a watch row and paragraph in `CLI-INSTRUCTIONS.md` (`CLI-INSTRUCTIONS.md:59`, `CLI-INSTRUCTIONS.md:88`) a live-list example in the shipped overview (`src/guidelines/cli-instructions/overview.md:202`) and a watch bullet beside the other read commands in the execution guide (`src/guidelines/cli-instructions/task-execution.md:179`). Every example names a scenario rather than the unfiltered list, so the guides teach a live queue for one assignee (`--status "In Progress" --assignee @sara`, `@your-name` in the execution guide) instead of re-reading the whole backlog. The fork's `README.md` and `scripts/run-ci-tests.ts` know nothing about JSON, and this fork has no `src/test/test-cli.ts`, so those upstream edits have no target and were not invented. The wiki was not touched: its JSON contract page is maintained in ingest waves rather than per task, so the new surface is left for the next wave.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog task list --json --watch` now streams a live view of the filtered list: the complete JSON result immediately, then a full replacement whenever it changes, in exactly the bytes one-shot `task list --json` produces, with unchanged results suppressed and a periodic reconciliation that recovers missed notifications. Filters, sorting, limits, `--ready` and local-only scope are re-resolved on every read through the same action the one-shot command uses, so a watch frame cannot disagree with that command run once. A duplicate identity discovered after the first response fails the JSON read closed, `--watch` requires `--json` and is rejected with `--plain`, and SIGINT/SIGTERM, a closed output pipe, a slow reader and a read failure each end the loop with bounded resources and no replacement for a failed read. Verified by first reverting the implementation (both new suites red, the integration suite reporting `unknown option '--watch'`), then 49 cases green across the new and adjacent suites plus 104 in the guide consumers, a clean type check and Biome run, and a real-CLI smoke where the live frame matched the one-shot read byte for byte and SIGTERM exited 143 with empty stderr.
<!-- SECTION:FINAL_SUMMARY:END -->

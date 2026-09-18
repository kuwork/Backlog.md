---
id: BACK-658
title: Publish task readiness in the JSON read paths
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-01 17:04'
updated_date: '2026-09-18 14:38'
labels: []
dependencies: []
references:
  - 'src/utils/readiness.ts:125'
  - 'src/utils/readiness.ts:133'
  - 'src/formatters/json-output.ts:39'
  - 'src/formatters/json-output.ts:60'
  - 'src/formatters/json-output.ts:77'
  - 'src/formatters/json-output.ts:85'
  - 'src/formatters/json-output.ts:141'
  - 'src/formatters/json-output.ts:186'
  - 'src/formatters/json-output.ts:236'
  - 'src/formatters/json-output.ts:252'
  - 'src/formatters/json-output.ts:256'
  - 'src/cli.ts:2146'
  - 'src/cli.ts:2560'
  - 'src/cli.ts:2562'
  - 'src/cli.ts:3542'
  - 'src/cli.ts:3717'
  - 'src/test/readiness.test.tsx:185'
  - 'src/test/cli-task-list-ready.test.ts:147'
  - 'src/test/cli-task-list-ready.test.ts:175'
  - 'src/test/cli-json-output.test.ts:142'
  - 'src/test/cli-json-output.test.ts:222'
modified_files:
  - src/utils/readiness.ts
  - src/formatters/json-output.ts
  - src/cli.ts
  - src/test/readiness.test.tsx
  - src/test/cli-task-list-ready.test.ts
  - src/test/cli-json-output.test.ts
actual_start: '2026-09-18 14:21'
actual_end: '2026-09-18 14:38'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task list --json`, `search --json` and `task view --json` say nothing about readiness, although the CLI already answers the question: `task list --ready` filters on it. A consumer of the JSON either re-implements the dependency walk or shells out to `--ready` per candidate, and neither answer is guaranteed to match what the other JSON surfaces would have said about the same record.

The versioned contract is meant to be usable on its own, so the verdict belongs in the payload. `isReady` joins the compact task summary that task list and search share, and `task view` publishes `readiness` beside it with the blockers behind the verdict. Both are derived at read time, never stored in the Markdown record, and both come from the readiness engine the fork already has rather than a second one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-672` and `git show f1c14f6a9`, and confirm each stated change against the fork before porting it.
- [x] #2 `task list --json` publishes `isReady` on every task summary, derived from the whole visible corpus rather than from the rows left after filtering.
- [x] #3 `task list --json --ready` serializes the verdict it selected on, from one corpus pass, so a row selected as ready cannot be published as not ready.
- [x] #4 `search --json` carries the verdict on each task record rather than rejoining verdicts by task ID, so two records claiming one identity keep their own answers.
- [x] #5 `task view --json` publishes `readiness` (`isReady`, `isBlocked`, `blockingDependencies`, `missingDependencies`) beside `isReady`, from the same derivation.
- [x] #6 Reads that neither filter on nor publish the verdict - plain, interactive, and a search whose results hold no task - load no completed corpus for it.
- [x] #7 The fork's own readiness engine and its existing `loadReadinessGraph` callers keep their current shape: no core fold, no surface rewrite, and no change to how `--ready` resolves dependencies.
- [x] #8 Tests cover ready, blocked, finished-by-status, unfinished-dependency and unresolvable-dependency verdicts across all three JSON surfaces, agreement between the surfaces for one record, and the completed-corpus plus configured-terminal-status inputs.
- [x] #9 `bunx tsc --noEmit`, `bun run check .`, and the affected suites pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. `src/utils/readiness.ts`: add `TaskListItem` (`Task & { isReady }`) and `withReadiness(tasks, graph)` so a list read attaches the verdict to every row from one index instead of resolving dependencies per row.
2. `src/formatters/json-output.ts`: give the compact summary an `isReady` field and have `toTaskSummaryJson` read it off the record; add `readiness` to the detail payload; introduce `TaskDetail` and `SearchResultInput` so the formatters take records that already carry a verdict instead of deriving one.
3. `src/cli.ts` task list: derive readiness once when `--ready` or `--json` asks for it, filter on that verdict, and serialize the rows it passed through; keep the ordering, parent, label and limit narrowing generic over the row type so the projection is not derived twice.
4. `src/cli.ts` search `--json`: attach the verdict to each task record as it is written, loading the corpus at most once and not at all for a result set holding no task.
5. `src/cli.ts` task view and the `task <id>` shorthand: attach `readiness` to the record handed to the formatter.
6. Tests: `withReadiness` cases in `src/test/readiness.test.tsx`; verdict publication plus the completed-corpus and configured-status inputs in `src/test/cli-task-list-ready.test.ts`; the list envelope and cross-surface agreement in `src/test/cli-json-output.test.ts`.
7. Gates: `bunx tsc --noEmit`, `bun run check .`, the affected suites; then revert-verify each new case.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fork shape: the readiness engine was already here (`src/utils/readiness.ts`, BACK-615) and four surfaces already consume it, so nothing had to be recomputed or moved. What was missing was publication, and the fork's JSON formatter is the single funnel that task list, search and task view all pass through. `withReadiness` builds the index once from the corpus the caller already loads and maps the whole list against it, which is what keeps a list read linear; `getTaskReadiness` is then called once per row rather than once per dependency.

Task list: `--ready` used to filter the query result in place and `--json` serialized a fresh slice, so the two could disagree, and `--json` alone published no verdict at all. The rows are now projected once when either flag asks for readiness, the `--ready` filter runs on `isReady` from that projection, and the JSON branch serializes the very rows the filter passed through. Ordering, the parent narrowing, the labels and the limit moved into one generic helper so they apply to whichever row type travels through them. A second, unreachable copy of the sort-field validation inside the plain branch was removed rather than duplicated; the field is validated once, before any task is read.

Search: the verdict is attached to the record it was read for as the payload is written, never rejoined by task ID. Two files can claim one identity with different dependencies, so a per-ID join would mark every claimant with whichever verdict was looked up. The corpus is loaded at most once and only once a task result is actually reached, so a document-only search pays nothing.

Deliberately not changed: `loadReadinessGraph` and its four existing callers (`--ready`, MCP tasks and drafts, the TUI ready filter), the algorithm itself, and the empty-result behaviour of `task list --json`, which still prints `No tasks found.` instead of an empty envelope. That last one is a separate divergence from the upstream contract and is being handled apart from this task.

Verification. Before the change, against the new cases: `src/test/cli-task-list-ready.test.ts` 2 fail (the publication cases), `src/test/cli-json-output.test.ts` 4 fail (the list envelope, the task-view readiness block, the search verdict, and cross-surface agreement), and `src/test/readiness.test.tsx` fails to compile with `Export named 'withReadiness' not found` - the unit cases cannot go red individually because the export they exercise does not exist yet. After the change: 5 pass, 10 pass, and 23 pass respectively; the surrounding suites (`subtask-ordering-consistency`, `cli-search-command`, `search-command-query`, `cli-doc-search`, `task-search-label-filter`) 48 pass. `bunx tsc --noEmit` clean, `bun run check .` 418 files with 0 errors and the three pre-existing `assets.ts` non-null-assertion warnings.

Two load-sensitive flakes were seen and both were cleared against unmodified code: `should filter tasks by readiness using --ready and --ready --json` failed once in a five-case run and passed on re-run, and `CLI doc search command > limits document search results` failed once inside a six-file batch and passed both alone and on a repeat of the same batch. Neither path touches readiness, and `backlog doc search` does not go through `searchJson` at all.

Not touched: the wiki. Its JSON contract page is maintained in ingest waves rather than per task (the last one covered BACK-624~628), so the new fields are left for the next wave instead of being written here by hand.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`task list --json`, `search --json` and `task view --json` now publish the readiness verdict the CLI already acted on. The compact task summary carries `isReady`, derived from the whole visible corpus in a single pass off the existing `src/utils/readiness.ts` engine; `task view --json` adds `readiness` with `isBlocked`, the blocking dependency IDs and the unresolvable ones, from the same derivation. `--ready --json` serializes the rows its own filter selected, so a row can no longer be filtered on one verdict and published under another, and search attaches the verdict to the record it was read for rather than rejoining by task ID, which keeps two claimants of one identity apart. Nothing new is computed, nothing is stored: the engine, `loadReadinessGraph` and its existing callers are untouched, and plain, interactive and taskless-JSON reads still load no completed corpus. Verified with `bunx tsc --noEmit`, `bun run check .`, and the affected suites (5, 10 and 23 cases green, plus 48 in the surrounding files), with every new case first confirmed red against the unmodified code.
<!-- SECTION:FINAL_SUMMARY:END -->

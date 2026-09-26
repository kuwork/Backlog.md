---
title: BACK-658 Publish task readiness in the JSON read paths
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - json-output
  - readiness
  - upstream-migration
source_path: backlog/tasks/back-658 - Publish-task-readiness-in-the-JSON-read-paths.md
---

# BACK-658 Publish task readiness in the JSON read paths

`task list --json`, `search --json`, and `task view --json` said nothing about readiness although the CLI already filtered on it via `--ready`; JSON consumers had to re-implement the dependency walk or shell out per candidate. This task publishes the verdict in the payload, derived at read time from the existing readiness engine and never stored.

## Summary

- `src/utils/readiness.ts` gained `TaskListItem` (`Task & { isReady }`) and `withReadiness(tasks, graph)`, which builds the readiness index once from the corpus the caller already loads and maps the whole list against it — keeping a list read linear instead of resolving dependencies per row
- The compact task summary in `src/formatters/json-output.ts` (shared by task list and search) gained `isReady`; `task view --json` adds a `readiness` block with `isReady`, `isBlocked`, `blockingDependencies`, and `missingDependencies`, from the same derivation
- Task list: `--ready` used to filter in place while `--json` serialized a fresh slice, so the two could disagree; rows are now projected once when either flag asks for readiness, the filter runs on that projection's verdict, and JSON serializes the very rows the filter passed through
- Search attaches the verdict to the record it was read for as the payload is written, never rejoining by task ID — two files claiming one identity keep their own answers; the completed corpus is loaded at most once and not at all for a taskless result set
- Deliberately untouched: `loadReadinessGraph` and its four existing callers, the algorithm, and the empty-result `No tasks found.` text (a separate divergence handled apart)
- Tests: `withReadiness` unit cases plus verdict publication across all three JSON surfaces with cross-surface agreement, completed-corpus, and configured-terminal-status inputs; every new case confirmed red against unmodified code first

## Acceptance Criteria

- `task list --json` publishes `isReady` on every summary, derived from the whole visible corpus
- `--ready --json` serializes the verdict it selected on, from one corpus pass
- `search --json` carries the verdict per record without rejoining by ID
- `task view --json` publishes `readiness` (blockers and missing dependencies) beside `isReady`
- Reads that neither filter on nor publish the verdict load no completed corpus

## Related Concepts

- [[concepts/json-output]] — the compact task summary that gained `isReady`
- [[concepts/task-lifecycle]] — readiness verdicts over dependency state
- [[concepts/upstream-migration]] — ports upstream BACK-672 (f1c14f6a9)

## Related Sources

- [[sources/back-615-dependency-readiness-guidance]] — the readiness engine this task publishes from
- [[sources/back-657-task-list-json-watch]] — watch frames carry this `isReady` field
- [[sources/back-625-ac-progress-json-output]] — sibling JSON publication task

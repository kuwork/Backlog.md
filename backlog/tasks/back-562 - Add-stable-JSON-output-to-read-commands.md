---
id: BACK-562
title: Add stable JSON output to read commands
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-07-13 16:06'
updated_date: '2026-08-15 18:34'
labels:
  - cli
dependencies: []
references:
  - src/utils/read-output-mode.ts
  - src/formatters/json-output.ts
  - src/cli.ts
actual_start: '2026-08-15 08:44'
actual_end: '2026-08-15 08:53'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Read commands (task list, task view, the bare task shorthand, and heterogeneous search) only offered interactive TUI or --plain text output, which is awkward for agents and automation to consume reliably.

Add a stable, versioned --json output to these four commands: a curated contract with fixed null and array semantics and project-relative paths, JSON written only to stdout, errors on stderr, conflicting output modes rejected, and --json rejected on non-read task subcommands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-545 and git show 22a091b as implementation reference.
- [x] #2 task list, task view, the task shorthand, and search support a --json flag producing a versioned envelope ({ schemaVersion: 1, kind }) with fixed null and array semantics and project-relative paths.
- [x] #3 JSON is written only to stdout; errors go to stderr; combining --json with --plain is rejected with a non-zero exit code.
- [x] #4 The JSON contract matches the fork Task model: no type key, fork date fields (dueDate/plannedStart/plannedEnd/actualStart/actualEnd) included, and the wiki search-result type serialized.
- [x] #5 Non-read task subcommands reject --json via the preSubcommand hook (unknown option, non-zero exit).
- [x] #6 Viewing a missing task with --json exits with code 1.
- [x] #7 Focused tests cover the envelope shape, curated details, absent-description null, heterogeneous search (task/document/decision), stdout/stderr separation, conflicting modes, and --json rejection on write commands.
- [x] #8 doc list supports --json with a versioned document-list envelope (schemaVersion 1, kind document-list, curated DocumentSummaryJson entries).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/utils/read-output-mode.ts with resolveReadOutputMode(options, hasInteractiveTTY) returning json/plain/interactive and rejecting json+plain.
2. Add src/formatters/json-output.ts: TaskSummaryJson / TaskDetailsJson / DocumentSummaryJson / DecisionSummaryJson / WikiSummaryJson, nullable(), normalizePublicDate() (ISO normalization), toProjectRelativePath(), taskListJson / taskViewJson / searchJson envelopes with { schemaVersion: 1, kind }, and printJson() writing only to stdout.
3. Fork adaptations in json-output.ts: no type key (fork Task has no type); include fork date fields dueDate/plannedStart/plannedEnd/actualStart/actualEnd; serialize the wiki search-result type (WikiSummaryJson with wiki-relative path).
4. src/cli.ts: add getReadOutputMode() and getTaskReadOutputMode() helpers (merging task-level --json/--plain opts), a taskCmd preSubcommand hook rejecting --json on non-list/view subcommands, and wire --json + output-mode branches into search, task list, task view, and the task shorthand actions. Do NOT add the upstream printDuplicateIntegrityWarning gate (fork decision: duplicate-ID integrity is checked via backlog doctor and the Web endpoint instead).
5. Viewing a missing task now sets exit code 1 (not only a stderr message).
6. Tests: read-output-mode.test.ts (4 unit cases) and cli-json-output.test.ts (fork-adapted: envelope shape, curated details for view/shorthand, absent-description null, heterogeneous search, clean stdout, conflicting modes, --json rejection on create). Note the description multiline value must be passed as the literal 
 escape so processCliEscapes converts it.
7. Verify bunx tsc --noEmit, biome check, focused JSON tests, and cli/search regression tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented.

Changes:
- Added src/utils/read-output-mode.ts: resolveReadOutputMode returns json/plain/interactive; --json + --plain is rejected.
- Added src/formatters/json-output.ts with fork-adapted contract: TaskSummaryJson without a type key, fork date fields (dueDate, plannedStart, plannedEnd, actualStart, actualEnd), wiki search-result serialization, normalizePublicDate ISO normalization, toProjectRelativePath, and printJson writing only to stdout.
- src/cli.ts: getReadOutputMode / getTaskReadOutputMode helpers, taskCmd preSubcommand hook rejecting --json on non-read subcommands, and --json wired into search, task list, task view, and the task shorthand. Missing-task view now exits 1.
- Deliberately did not port the upstream printDuplicateIntegrityWarning gate on read commands (fork decision recorded in doc-8 CLI-1): duplicate-ID integrity stays a backlog doctor / Web endpoint concern.

Follow-up scope extension (same session):
- doc list gained --json (versioned document-list envelope via the new documentListJson(); empty docs still emit an empty array).
- decision list does not exist as a command in this fork or upstream; decision reads are covered by search --type decision --json (already serialized via DecisionSummaryJson).

Tests:
- src/utils/read-output-mode.test.ts: 4 pass.
- src/test/cli-json-output.test.ts (fork-adapted from upstream): envelope shape for task list, curated details for view + shorthand, absent-description null, heterogeneous search rank (task/document/decision), document-list envelope, clean stdout / stderr separation, conflicting --json+--plain rejection, and --json rejection on task create — 7 pass.
- The multiline --description test passes the literal 
 escape (processCliEscapes converts it to real newlines; a raw newline in argv is truncated on this platform).
- Regression: cli-search-command + cli-doc-search 10 pass. Two pre-existing failures in cli.test.ts (plain-limit regrouping, doc update Path) fail identically without these changes (verified via git stash).
- bunx tsc --noEmit pass; biome check pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added stable versioned JSON output (schemaVersion 1) to task list, task view, the task shorthand, search, and doc list, with fixed null/array semantics, project-relative paths, JSON on stdout only, and --json rejected on non-read task subcommands and in combination with --plain. The contract is adapted to the fork model (no task type, fork date fields included, wiki search results serialized).

Decision reads have no dedicated list command (neither this fork nor upstream defines one); they are covered by search --type decision --json.

Verified by 4 output-mode unit tests and 7 CLI JSON integration tests, plus search regression; typecheck and biome pass.
<!-- SECTION:FINAL_SUMMARY:END -->

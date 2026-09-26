---
title: BACK-697 Add references and modifiedFiles to task list --json
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - json-output
source_path: backlog/tasks/back-697 - Add-references-and-modifiedFiles-to-task-list-json.md
---

# BACK-697 Add references and modifiedFiles to task list --json

External tools consuming `backlog task list --json` needed each task's `references` and `modifiedFiles` without fetching tasks one by one. Both arrays moved from the detail payload onto the shared summary projection, so list, search, view, and the `--watch` stream all carry them from one edit.

## Summary

- `src/formatters/json-output.ts`: `TaskSummaryJson` declares `references` and `modifiedFiles` right after the acceptance-criteria counts; `toTaskSummaryJson` fills both with an empty array as the default
- `TaskDetailsJson` drops its two duplicate declarations — it extends the summary, so the spread carries both fields into the view payload unchanged; nothing is renamed and no existing key changes value, keeping the addition additive under `schemaVersion 1`
- The projection has three call sites in one file (task list envelope, search envelope, detail payload); all inherit the fields from the single edit, and the `--watch` stream republishes the same envelope verbatim — MCP read surfaces build their own shape and are out of scope
- The fork's summary-only fields (`dueDate`, `plannedStart`, `plannedEnd`, `actualStart`, `actualEnd`, `isReady`, `source`) and the acceptance-criteria field naming are untouched
- Documentation: no shipped surface in this fork enumerates the summary field list, so there was no anchor to update — inventing one would add a contract the fork does not maintain; the landing is recorded in the migration ledger instead
- Tests: `cli-json-output.test.ts` 11 green (populated list row, neither-field empty arrays, search row, unchanged view payload); a pre-existing red in the list-envelope case (missing `source` expectation) was repaired first; 4-variant × 4-case rollback matrix pins each clause

## Acceptance Criteria

- Every task in `task list --json` and `search --json` carries `references` and `modifiedFiles`, as empty arrays when absent
- `task view --json` keeps the same payload content — no key renamed, dropped, or retyped
- The addition stays additive under `schemaVersion 1` and the fork's summary-only fields are unchanged
- Tests pin a populated row, the empty-array case, and the unchanged view payload

## Related Concepts

- [[concepts/json-output]] — the summary/detail projection and schemaVersion 1 stability rule
- [[concepts/cli-tui]] — the CLI surfaces consuming the projection

## Related Sources

- [[sources/back-562-stable-json-output]] — JSON envelope stability this addition respects
- [[sources/back-625-ac-progress-json-output]] — the acceptance-criteria counts the new fields sit next to
- [[sources/back-526-create-task-references-and-backlog-autocomplete]] — where task references come from

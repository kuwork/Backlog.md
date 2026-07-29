---
id: BACK-533
title: >-
  Parse block-style YAML lists in config and fix config set guidance for list
  keys
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-12 14:59'
updated_date: '2026-07-29 06:04'
labels:
  - migration
dependencies: []
references:
  - src/file-system/operations.ts
  - src/cli.ts
  - src/test/config-commands.test.ts
modified_files:
  - src/file-system/operations.ts
  - src/cli.ts
  - src/test/config-commands.test.ts
priority: medium
actual_start: '2026-07-29 04:46'
actual_end: '2026-07-29 05:13'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`parseConfig` currently only accepts inline flow arrays for list keys (`statuses` and `labels`), so block-style YAML sequences in `config.yml` are silently dropped. This breaks the intended hand-editing path for user-defined lists.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched.
- [x] #2 bun run check . passes when formatting/linting touched.
- [x] #3 bun test (or scoped config tests) passes.
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.47.1..v1.48.0 --grep BACK-540` and `git show da0784d` as implementation reference.
- [x] #2 Block-style YAML sequences for `statuses` and `labels` parse identically to inline arrays.
- [x] #3 Quoted values, commas inside quoted items, and legacy non-YAML inline arrays still parse correctly.
- [x] #4 `config set` for every non-settable list key (`statuses`, `labels`) explains it cannot be set directly and points to `backlog config get <key>` and editing `config.yml`.
- [x] #5 `config get` and `config set` show the same available-keys list.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect `src/file-system/operations.ts` and confirm `parseDefinitionOfDone` uses a gray-matter YAML pass; reuse that pass for `statuses` and `labels`, keeping the inline-bracket line parser as fallback for legacy not-quite-YAML configs. (Do not drop the fallback; some hand-edited configs are not valid YAML.)
2. In `src/cli.ts`, treat `statuses` and `labels` as non-settable array keys; guidance should reference only real commands (`backlog config get <key>`) and editing `config.yml`. Extract one shared `CONFIG_AVAILABLE_KEYS` constant so `config get` and `config set` report the same list.
3. Add parser-equivalence tests for block-style vs inline arrays, quoted values, commas inside quoted items, and legacy fallback. Add a CLI end-to-end test that creates a project with block-style labels and verifies `config get labels` works.
4. Run `bunx tsc --noEmit`, `bun run check .`, and `bun test` for the touched config suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented block-style YAML parsing for statuses/labels in src/file-system/operations.ts with legacy inline-bracket fallback.
Extracted CONFIG_AVAILABLE_KEYS constant in src/cli.ts and made config get/set share the same unknown-key list.
Corrected config set guidance for list keys to reference 'backlog config get <key>' instead of the nonexistent list-<key> command.
Added 4 tests to src/test/config-commands.test.ts covering block-vs-inline equivalence, quoted-comma preservation, end-to-end config get, and guidance/key-list consistency.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented block-style YAML list parsing for config list keys and corrected config set guidance.

Changes:
- src/file-system/operations.ts: parseConfig now resolves statuses/labels through a gray-matter YAML pass first, falling back to the legacy inline-bracket line parse for non-YAML configs. Block sequences, quoted values, and commas inside quoted items now parse correctly.
- src/cli.ts: added CONFIG_AVAILABLE_KEYS constant; config get and config set now report the same available-keys list. Corrected config set guidance for non-settable list keys to reference 'backlog config get <key>' and editing config.yml (the previous copy referenced a nonexistent list-<key> command).
- src/test/config-commands.test.ts: added tests for block-vs-inline parser equivalence, quoted-comma preservation, end-to-end block-style labels through config get, and guidance/key-list consistency.

Verification:
- bunx tsc --noEmit passes.
- bunx biome check on modified files passes.
- bun test src/test/config-commands.test.ts passes (12/12).
<!-- SECTION:FINAL_SUMMARY:END -->

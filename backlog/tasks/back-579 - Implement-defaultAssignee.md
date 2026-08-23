---
id: BACK-579
title: Implement defaultAssignee
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-23 10:40'
labels: []
dependencies: []
references:
  - src/types/index.ts
  - src/file-system/operations.ts
  - src/utils/config-watcher.ts
  - src/cli.ts
  - src/core/backlog.ts
  - src/guidelines/cli-instructions/task-creation.md
  - src/mcp/utils/schema-generators.ts
documentation:
  - ADVANCED-CONFIG.md
modified_files:
  - src/file-system/operations.ts
  - src/utils/config-watcher.ts
  - src/test/config-watcher.test.ts
priority: high
actual_start: '2026-08-23 08:53'
actual_end: '2026-08-23 10:32'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADVANCED-CONFIG.md documents a `defaultAssignee` setting, but `config get` and `config set` reject it as an unknown key and no non-test code reads it. The setting is documented but entirely inert.

Most of the plumbing already exists: the type, YAML parse/serialize, and the watcher key. Implement the documented behavior by making defaultAssignee a string list, wiring config get/set/list, and applying the default during task creation across all surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.49.3..v1.50.1 --grep BACK-583` and `git show <commit>` as implementation reference.
- [x] #2 `backlog config get defaultAssignee` returns the configured value
- [x] #3 `backlog config set defaultAssignee <value>` stores the value
- [x] #4 `backlog config list` includes defaultAssignee
- [x] #5 `backlog task create` with no -a applies the configured defaultAssignee
- [x] #6 An explicit -a on `task create` overrides the configured defaultAssignee
- [x] #7 ADVANCED-CONFIG.md accurately describes the shipped behavior
- [x] #8 Tests cover both the apply and the override paths
- [x] #9 Malformed config values do not replace the last good cached config in the file watcher.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make `defaultAssignee` a string list (`string[]`) in BacklogConfig, matching the documented `[]` default and the multi-assignee task model. Parse accepts a legacy scalar, inline arrays, and block YAML sequences; serialize writes an inline list and omits the key when empty.
2. Wire config get/set/list: add defaultAssignee to CONFIG_GET_KEYS, CONFIG_SET_KEYS, CONFIG_AVAILABLE_KEYS; get prints comma-joined values; set parses with the shared parseDelimitedStringList (comma-separated), storing undefined for an empty value so the key is removed; list prints the bracketed list.
3. Apply the default in core createTaskFromInput (same layer as defaultStatus and definitionOfDone defaults), not in the CLI: every create surface (task create, draft create, creation wizard, TUI composer, web POST /api/tasks, MCP task_create) already funnels through it, so one change gives uniform behavior. Empty/absent assignee input applies the default; any explicit assignee replaces it entirely (no merging).
4. Update ADVANCED-CONFIG.md so the row describes the shipped list behavior and add the set example.
5. Tests: config get/set/list round-trip, YAML scalar/list parse compatibility, create-with-default and explicit-override across CLI task create, draft create, and core; update existing tests that typed defaultAssignee as a string.
6. Verify: bunx tsc --noEmit, bun run check ., scoped test files, then full bun test.

7. Port upstream config-watcher validation (hasValidExplicitValues) so malformed explicit config values keep the previous good config cached.

8. Add FileSystem helpers getCachedConfigContent/publishConfig and make parseConfig public so the watcher can publish only valid configs.

9. Add tests covering invalid config rejection and last-good-config fallback.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reviewed upstream BACK-583 commit 84ea3fa which changes BacklogConfig.defaultAssignee from string to string[], wires config get/set/list, applies the default in core createTaskFromInput, updates ADVANCED-CONFIG.md, and adds tests. Adapted to current fork watcher implementation (simpler than upstream).

Migrated upstream hasValidExplicitValues validation into src/utils/config-watcher.ts, adapted to the current fork's supported config keys.
Added FileSystem.getCachedConfigContent/publishConfig, made parseConfig public, and updated saveConfig to cache content.
The watcher now performs stable reads and only publishes configs that pass explicit-value validation, keeping the last good config cached when the file is malformed.
Added src/test/config-watcher.test.ts covering valid publish, malformed rejection, and defaultAssignee scalar/inline/block forms.

Re-added task_prefix validation (letters only) to hasValidExplicitValues per review; added a watcher test confirming valid 'back' publishes and invalid 'back-1' keeps the previous good config cached.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented defaultAssignee end-to-end (string[], config get/set/list, core createTaskFromInput default, ADVANCED-CONFIG.md and guide updates, tests).
Hardened the config file watcher with upstream-inspired hasValidExplicitValues validation, adapted to the fork's supported keys. The watcher now reads until the file is stable, validates explicit config values, and only publishes valid configs so malformed edits do not evict the last good cached config.
Added FileSystem helpers getCachedConfigContent/publishConfig, made parseConfig public, and updated saveConfig to keep cached content in sync.
Added src/test/config-watcher.test.ts.
Verified bunx tsc --noEmit passes, bun run check . shows only pre-existing warnings in src/core/assets.ts, and targeted tests pass (91/91). Full bun test has pre-existing failures unrelated to this change.

Full bun test finished with 39 failures (1921 tests total); all are in pre-existing areas: code-path styling, CLI newline handling, append-plan/append-notes, MCP bootstrap, MermaidMarkdown heading slugs, web task popup, CLI priority filtering, etc. None involve config-watcher, FileSystem, or defaultAssignee.

Per review, re-added task_prefix validation (letters only) to hasValidExplicitValues and added a corresponding watcher test. Targeted tests now 92 pass / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->

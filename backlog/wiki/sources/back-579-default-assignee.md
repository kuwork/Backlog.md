---
title: Implement defaultAssignee
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - migration
  - config
  - core
  - cli
  - mcp
source_path: backlog/tasks/back-579 - Implement-defaultAssignee.md
---

# Implement defaultAssignee

Made the documented-but-inert `defaultAssignee` config setting actually work. `ADVANCED-CONFIG.md` described the setting, but `config get`/`config set` rejected it as an unknown key and no non-test code read it. The task wires it end-to-end as a string list, applies it during task creation across all surfaces, and hardens the config file watcher so malformed values no longer evict the last good cached config.

## Summary

- Type change: `defaultAssignee` became `string[]` in `BacklogConfig` (matching the multi-assignee task model); parse accepts legacy scalar, inline arrays, and block YAML sequences; serialize writes an inline list and omits the key when empty.
- `src/cli.ts`: added to `CONFIG_GET_KEYS` / `CONFIG_SET_KEYS` / `CONFIG_AVAILABLE_KEYS`; `config get` prints comma-joined values; `config set` uses shared `parseDelimitedStringList` (empty value stores `undefined` so the key is removed); `config list` prints the bracketed list.
- Default applied in `core.createTaskFromInput` — the same layer as `defaultStatus` and `definitionOfDone` — not in the CLI: every create surface (CLI task create, draft create, creation wizard, TUI composer, web POST `/api/tasks`, MCP `task_create`) funnels through it, so one change gives uniform behavior. Empty/absent assignee input applies the default; any explicit assignee replaces it entirely (no merging).
- Config watcher hardening: migrated upstream `hasValidExplicitValues` validation into `src/utils/config-watcher.ts` (adapted to the fork's supported keys, including task_prefix letters-only validation re-added per review); watcher performs stable reads and only publishes configs that pass validation, keeping the last good config cached on malformed edits. New `FileSystem.getCachedConfigContent`/`publishConfig` helpers; `parseConfig` made public; `saveConfig` keeps cached content in sync.
- `ADVANCED-CONFIG.md` and task-creation guides updated to describe the shipped list behavior.
- Tests: new `src/test/config-watcher.test.ts` (valid publish, malformed rejection, scalar/inline/block defaultAssignee forms, task_prefix validation); create-with-default and explicit-override paths covered across CLI, draft create, and core.

## Acceptance Criteria

- `config get/set/list` all support `defaultAssignee`; `task create` with no `-a` applies the configured default; explicit `-a` overrides it.
- `ADVANCED-CONFIG.md` accurately describes shipped behavior; malformed config values do not replace the last good cached config in the watcher.

## Related Concepts

- [[concepts/core-architecture]] — defaults applied at the core funnel layer cover every create surface at once
- [[concepts/task-lifecycle]] — assignee model and create-time defaults
- [[concepts/cli-entry]] — config get/set/list key registries

## Related Sources

- [[sources/back-533-config-block-yaml-lists]] — the config YAML list parsing this task builds on
- [[sources/back-581-web-settings-default-assignee]] — the web Settings editor for the same setting (same batch)
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — CLI-2 deep analysis (upstream BACK-583, merge `84ea3fa`)

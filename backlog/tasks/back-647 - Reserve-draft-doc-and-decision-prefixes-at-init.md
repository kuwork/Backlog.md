---
id: BACK-647
title: 'Reserve draft, doc, and decision prefixes at init'
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-15 14:00'
updated_date: '2026-09-17 16:29'
labels:
  - core
dependencies: []
references:
  - src/utils/prefix-config.ts
  - src/core/init.ts
  - src/cli.ts
  - src/server/index.ts
modified_files:
  - src/utils/prefix-config.ts
  - src/core/init.ts
  - src/cli.ts
  - src/server/index.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/prefix-config.test.ts
  - src/test/enhanced-init.test.ts
  - src/test/server-init.test.ts
  - src/test/cli-doctor.test.ts
  - src/test/cli-init-reserved-prefix.test.ts
priority: low
actual_start: '2026-09-17 16:26'
actual_end: '2026-09-17 16:29'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog init --task-prefix` accepts any letters-only value, including `draft`, `doc`, and `decision`, which are the hard-coded system prefixes for drafts (`backlog/drafts/`), documents, and decisions. A project initialized with `--task-prefix draft` stores its regular tasks as `DRAFT-n`, and every prefix-routed consumer then treats them as drafts: the web server's draft handling answers them from the draft store, and MCP `task_edit` prefers the draft store for `DRAFT-` ids. Creating one real draft in such a project also guarantees an ID collision across `tasks/` and `drafts/`. The task prefix is init-only, so validating it at init is enough: reject the reserved names case-insensitively with a clear error.

This fork has the same gap. `src/utils/prefix-config.ts` defines only `DRAFT_PREFIX` and has no reserved-prefix concept, and `src/core/init.ts` writes `advancedConfig.taskPrefix` into `prefixes.task` without checking it. The fix is a pure additive guard: one shared validator, applied at every entry point that can set a task prefix, plus a `doctor` report so an already-broken project is told what is wrong instead of silently misrouting.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-635 and git show 27ab33027 as implementation reference.
- [x] #2 backlog init rejects draft, doc, and decision (case-insensitive) as --task-prefix and as a wizard value, with a clear error naming why, and no config file is written.
- [x] #3 The same rule is enforced by initializeProject(), so the browser init endpoint answers 400 and the CLI and web paths fail identically.
- [x] #4 Existing projects that already carry a reserved prefix keep working at runtime: task list, task create, and re-init all succeed, and re-init preserves the existing prefix.
- [x] #5 backlog doctor reports the collision using the on-disk task_prefix key name, exits 1 independently of duplicate-ID findings, and refuses --fix so duplicate repair cannot allocate an ID into the colliding store.
- [x] #6 The reserved names are documented in the --task-prefix help, the init help schema, and the web wizard's task-prefix hint.
- [x] #7 Tests cover case-insensitive and padded rejection, the shared initializeProject path, the doctor report and --fix no-op, and runtime commands on a reserved-prefix project.
- [x] #8 bunx tsc --noEmit, bun run check . and the scoped init/doctor/prefix tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the reserved-prefix rule to `src/utils/prefix-config.ts` as the single source of truth: private `DOC_PREFIX` / `DECISION_PREFIX` constants (also reused by `getPrefixForType` instead of the inline string literals), a private `RESERVED_TASK_PREFIXES` list, `isReservedTaskPrefix()`, and `getTaskPrefixError()` — the letters-only check plus the reserved-name check, judging the value exactly as given because init persists it verbatim.

2. Apply `getTaskPrefixError()` at every entry point that can set a task prefix: the `--task-prefix` flag validation and the interactive init wizard's `clack.text` validator in `src/cli.ts`, and `initializeProject()` in `src/core/init.ts` so the shared core path rejects it for any caller. An explicitly requested prefix is always validated; existing config prefixes stay preserved untouched on re-init.

3. Return 400 from the browser init endpoint (`src/server/index.ts`) when the submitted `advancedConfig.taskPrefix` is reserved, so the web wizard surfaces the message instead of a 500 from the core throw.

4. Document the reserved names in the public init help (`--task-prefix` commander option, the init help schema) and in the web wizard's task-prefix hint.

5. Report the collision in `backlog doctor`: when `config.prefixes.task` is reserved, print the warning with the on-disk `task_prefix` key name, set exit code 1 independently of duplicate-ID findings, and refuse `--fix` so duplicate repair cannot allocate an ID into the colliding draft/doc/decision store. Suppress the "no duplicates found" line in that case so the warning is not masked. Existing reserved-prefix projects keep working at runtime — no new failures beyond current behavior.

6. Tests: unit coverage for `isReservedTaskPrefix()` / `getTaskPrefixError()` including case-insensitivity and padding; CLI coverage for flag rejection with no config written; shared `initializeProject` rejection (first init and re-init); doctor mention plus `--fix` no-op; and a reserved-prefix project where `task list` still succeeds.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC1: verified the upstream scope with `git log --oneline v1.50.1..v1.52.0 --grep BACK-635` (implementation commit 27ab33027, plus the follow-up task commit 110431c37) and `git show --stat 27ab33027` - the same surfaces apply here: prefix-config, init, cli, server, the web wizard hint, and the four test files.

AC2: added DOC_PREFIX/DECISION_PREFIX (now also reused by getPrefixForType instead of the inline literals), RESERVED_TASK_PREFIXES, isReservedTaskPrefix() and getTaskPrefixError() to src/utils/prefix-config.ts as the single owner of the rule. src/cli.ts validates both the --task-prefix flag and the interactive init wizard prompt through getTaskPrefixError(); the wizard trims before calling so blank input still means "use the default" and a padded value typed at the prompt is still accepted and trimmed, while the flag and the other entry points judge the value exactly as given, because init persists it verbatim. Verified end to end in tmp/core6-e2e: `init --task-prefix DECISION` and `--task-prefix draft` exit 1 with `Task prefix "X" is reserved for drafts, docs, or decisions. Choose a different prefix.` and write no backlog/config.yml; `--task-prefix JIRA` succeeds (task_prefix: "JIRA") and creates jira-1.

AC3: initializeProject() validates advancedConfig.taskPrefix before doing any work and throws, so the shared core path enforces the rule for every caller including re-init. The browser init endpoint validates the same value in its input-validation block and answers 400 with the same message instead of falling through to a 500 from the core throw.

AC4: existing reserved-prefix projects are untouched at runtime. Confirmed manually on a project rewritten to task_prefix: "draft": `task list` exits 0, and a re-init without the flag preserves the prefix. A re-init that explicitly requests a reserved prefix is rejected and leaves the config on disk unchanged.

AC5: doctor reports the collision. Placement differs from upstream on purpose: fork handles --commit/--rollback first, so the check sits after those branches (they still work) and before the repair preview, then prints two lines naming the on-disk task_prefix key, sets exit code 1 independently of duplicate-ID findings, refuses --fix, and suppresses "No duplicate task IDs found." so the warning is not masked. Verified: `doctor` exits 1 with the warning and no "no duplicates" line; `doctor --fix --yes` exits 1 with "Resolve the reserved task prefix before running --fix." and renames nothing.

AC6: reserved names are documented in the --task-prefix commander option, in the init help schema, and in the web wizard's task-prefix hint across all four locales (en/ja/zh-CN/zh-TW).

AC7/AC8 tests: prefix-config (isReservedTaskPrefix case-insensitivity, trimming, look-alikes; getTaskPrefixError empty/ordinary/reserved/padding cases), enhanced-init (initializeProject rejects draft/DRAFT/doc/Doc/decision/DECISION and writes no config; padded input rejected; re-init rejection leaves the prefix untouched; a re-init without a prefix preserves a legacy reserved prefix), server-init (400 plus no config; clean prefix accepted), cli-doctor (collision reported with the task_prefix key name, --fix refused with no backups created, task list/create still work on a reserved-prefix project, warning clears once the prefix is not reserved), and a new cli-init-reserved-prefix suite covering the flag path end to end and the init --help copy. Upstream put the flag-level cases in cli-init-create.test.ts, which this fork does not have, so they live in the new file instead.

Verification: bunx tsc --noEmit clean; bun run check . 412 files, 0 error (3 pre-existing warnings in src/core/assets.ts); scoped tests 111 pass / 0 fail (prefix-config, server-init, enhanced-init) and 19 pass / 0 fail (cli-doctor, cli-init-reserved-prefix).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog init can no longer create a project whose task prefix is draft, doc, or decision. One validator, getTaskPrefixError() in src/utils/prefix-config.ts, backs every entry point - the --task-prefix flag, the interactive init wizard prompt, the browser init endpoint (400), and initializeProject() itself - so the CLI and the web wizard fail identically and no config file is written. The rule is case-insensitive, and it judges the value exactly as given, because init stores the prefix verbatim: padded input is now rejected instead of being persisted into task IDs and filenames. Reserved names are documented in the commander option, the init help schema, and the web wizard hint in all four locales.

Existing projects that already carry a reserved prefix keep working exactly as before, since the prefix is only validated when it is explicitly requested and existing config prefixes are preserved untouched on re-init. backlog doctor reports the collision instead of staying silent: it names the on-disk task_prefix key, explains that there is no automated migration, exits 1, and refuses --fix so a duplicate-ID repair cannot allocate an ID into the colliding draft/doc/decision store.

Verified end to end in a scratch project: reserved values rejected at exit 1 with no config written; JIRA accepted, persisted, and tasks created as jira-1; re-init preserves JIRA and rejects a reserved value without touching the config; a simulated legacy task_prefix draft project still lists and creates tasks at exit 0 while doctor warns, exits 1, and --fix --yes renames nothing. Backed by unit and integration coverage across prefix-config, enhanced-init, server-init, cli-doctor, and a new cli-init-reserved-prefix suite.
<!-- SECTION:FINAL_SUMMARY:END -->

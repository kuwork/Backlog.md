---
title: BACK-647 Reserve draft, doc, and decision prefixes at init
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - core
  - cli
  - i18n
source_path: backlog/tasks/back-647 - Reserve-draft-doc-and-decision-prefixes-at-init.md
---

# BACK-647 Reserve draft, doc, and decision prefixes at init

`backlog init --task-prefix` accepted any letters-only value, including `draft`, `doc`, and `decision` — the hard-coded system prefixes — so a project initialized with `--task-prefix draft` had every prefix-routed consumer treating its tasks as drafts, with guaranteed ID collisions. A pure additive guard now validates the prefix at every entry point, and `doctor` reports already-broken projects. Ports upstream BACK-635.

## Summary

- `src/utils/prefix-config.ts` is the single owner of the rule: private `DOC_PREFIX`/`DECISION_PREFIX` (also reused by `getPrefixForType` instead of inline literals), `RESERVED_TASK_PREFIXES`, `isReservedTaskPrefix()`, and `getTaskPrefixError()` (letters-only plus reserved-name check, judged exactly as given because init persists the value verbatim — padded input is now rejected too)
- Applied at every entry point: the `--task-prefix` flag and the interactive wizard's `clack.text` validator in `src/cli.ts` (wizard trims first so blank still means default), `initializeProject()` in `src/core/init.ts` so the shared core path rejects for any caller, and the browser init endpoint answering 400 instead of a 500
- Existing reserved-prefix projects keep working at runtime: `task list`/`task create` succeed, re-init preserves the prefix unless a reserved one is explicitly requested
- `backlog doctor` reports the collision naming the on-disk `task_prefix` key, exits 1 independently of duplicate-ID findings, suppresses the "no duplicates found" line, and refuses `--fix` so duplicate repair cannot allocate an ID into the colliding store; placement after the fork's `--commit`/`--rollback` branches differs from upstream on purpose
- Reserved names documented in the commander option, the init help schema, and the web wizard hint in all four locales
- Tests: 111 pass across prefix-config/server-init/enhanced-init plus 19 across cli-doctor and the new cli-init-reserved-prefix suite (upstream's flag cases lived in a file this fork lacks); end-to-end verified in a scratch project (`DECISION`/`draft` rejected with no config written, `JIRA` accepted, legacy `task_prefix: draft` project still lists and creates)

## Acceptance Criteria

- Init rejects draft/doc/decision case-insensitively via flag, wizard, `initializeProject()`, and the browser endpoint (400), writing no config
- Existing reserved-prefix projects keep working; re-init preserves their prefix
- Doctor reports the collision with the `task_prefix` key name, exits 1, and refuses `--fix`
- Reserved names documented in help and the web wizard across all locales

## Related Concepts

- [[concepts/task-identity]] — prefix routing that a colliding task prefix corrupts
- [[concepts/core-architecture]] — `initializeProject` as the shared init path
- [[concepts/upstream-migration]] — ports upstream BACK-635 (commit 27ab33027)

## Related Sources

- [[sources/back-642-draft-identity-fail-closed]] — draft prefix routing this guard protects
- [[sources/back-596-fail-closed-document-decision-identity]] — doc/decision prefix identities likewise protected
- [[sources/back-593-init-backlog-cwd-runtime-core]] — init flow and runtime core the validator plugs into

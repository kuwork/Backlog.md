---
id: BACK-719
title: Make backlog config list accept the --plain flag the overview prints
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-29 09:12'
updated_date: '2026-09-29 09:43'
labels: []
dependencies: []
references:
  - 'src/guidelines/cli-instructions/overview.md:22'
  - 'src/guidelines/cli-instructions/overview.md:36'
  - 'src/guidelines/cli-instructions/overview.md:217'
  - 'src/guidelines/cli-instructions/decisions.md:26'
  - 'src/cli.ts:5771'
  - 'src/test/config-commands.test.ts:157'
modified_files:
  - src/cli.ts
  - src/test/config-commands.test.ts
ordinal: 289400
actual_start: '2026-09-29 09:37'
actual_end: '2026-09-29 09:43'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog instructions overview` prints `backlog config list --plain` as the way to read the live project config, but this build rejects the flag with `error: unknown option '--plain'`. The line arrived with BACK-582, which listed the config commands a session must load first and assumed the same flag convention the other read commands use; `backlog config list` declares no options at all (`--help` shows only `-h`). So an agent that follows the overview literally - including its own rule "Always use `--plain` flag for AI-readable output" - gets a hard error instead of the config it was told to load before doing anything else.

An audit of every `backlog <command> --plain` printed in `src/guidelines/cli-instructions/*.md` found 15 distinct commands, and `config list` is the only one that fails; the other 14 accept the flag. This is a single-command gap, not a general flag-plumbing problem.

Direction: keep the documented command working by accepting `--plain` on `config list` as an output-mode flag that proceeds without changing the already-plain output, matching the existing `decision create --plain` precedent documented in `decisions.md`. Rejected alternative: deleting `--plain` from the two overview lines, which leaves the guide telling agents to always pass a flag that one command still refuses. Adding `--json` or any other new config output format is out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog config list --plain exits successfully and prints the same configuration values as backlog config list, with no unknown-option error
- [x] #2 backlog config list --help lists --plain among its accepted options
- [x] #3 The overview can be followed literally: the command printed at overview.md:22 and overview.md:36 runs clean in this repository
- [x] #4 No other command documented with --plain in the CLI guidance gains or loses flag behavior
- [x] #5 A test in src/test/config-commands.test.ts asserts config list --plain succeeds and matches plain config list output
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Baseline: confirm `bun src/cli.ts config list --plain` fails with unknown option today, and capture `config list` stdout as the reference text.
2. src/cli.ts (configCmd.command("list"), ~5771): add `plain` to the addHelpSchema optional list and `.option("--plain", "use plain text output")`, mirroring the decision create accept-and-proceed precedent (decision create prints a single plain line, so the flag is accepted without changing output). No change to the printed body, no new output mode.
3. Verify AC2: `bun src/cli.ts config list --help` lists --plain.
4. Verify AC4: re-run the guidance audit over the 15 `--plain` commands documented in src/guidelines/cli-instructions/*.md, diffing each command's --help option list before/after to prove only config list changed.
5. Test (AC5) in src/test/config-commands.test.ts beside "exposes config list/get/set subcommands": assert `config list --plain` exits 0 and its stdout equals `config list` stdout, and that `config list --help` contains --plain.
6. Gates: bunx tsc --noEmit; bun run check .; bun test --timeout 240000 src/test/config-commands.test.ts.
7. Record notes / modified files / final summary, check AC 1-5 and DoD 1-3, then In Progress -> In Review (allowed_if: finalSummary non-empty). In Review -> Done stays with you.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented by declaring --plain on configCmd.command("list") (src/cli.ts:5779-5790): `.option("--plain", "use plain text output")` plus `plain` in the addHelpSchema optional list and a `backlog config list --plain` example. Accept-and-proceed, exactly like the decision create precedent - the action callback and the printed Configuration block are untouched.
AC1/AC3 evidence: `bun src/cli.ts config list --plain` exits 0 and diffs byte-identical against `bun src/cli.ts config list` (tmp/b719/list-*.txt).
AC2 evidence: `config list --help` now prints `--plain  use plain text output` under Options, `plain: Boolean - Use plain text output` under Optional fields, and `backlog config list --plain` under Examples.
AC4 evidence: extracted the 15 commands documented with --plain in src/guidelines/cli-instructions/*.md (tmp/b719/audit.py) and diffed each command --help option set before/after - only `config list` changed (+--plain, nothing removed).
Gates: bunx tsc --noEmit clean; bunx biome check src/cli.ts src/test/config-commands.test.ts clean (repo-wide 3 warnings + 1 info are pre-existing in src/core/assets.ts and one test); bun test --timeout 240000 src/test/config-commands.test.ts -> 20 pass / 0 fail including the new test.
No docs changed: overview.md already prints the command and is the single source (imported with { type: "text" }); decisions.md:26 precedent already documents the accept-and-proceed convention.
Follow-up outside this task: the installed global CLI (~/.local/bin/backlog, a compiled exe built 2026-09-29 02:00) still rejects --plain - it needs a rebuild/reinstall before agents invoking `backlog` directly see the fix.

User accepted the result at 09:42 (approved the plan, then "通过验证"). No code change after the scoped suite; task moved to the configured terminal status Done.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
BACK-719: `backlog config list` now accepts `--plain`.

Changed files:
- src/cli.ts - config list declares `--plain` (option + help-schema optional field + example). Output is unchanged: the flag is accepted-and-proceeds, matching the decision create precedent recorded in decisions.md.
- src/test/config-commands.test.ts - new test asserts `config list --plain` succeeds with stdout equal to plain `config list`, and that `config list --help` mentions `--plain`.

Verification: bunx tsc --noEmit clean; biome clean on both changed files; scoped suite 20 pass / 0 fail; 15-command help audit shows only config list gained a flag. The installed global binary still needs a rebuild to pick this up.
<!-- SECTION:FINAL_SUMMARY:END -->

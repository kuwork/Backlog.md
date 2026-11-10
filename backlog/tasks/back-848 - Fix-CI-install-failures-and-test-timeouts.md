---
id: BACK-848
title: Fix CI install failures and test timeouts
status: Done
assignee:
  - '@hy4'
created_date: '2026-11-10 02:45'
updated_date: '2026-11-10 02:49'
labels:
  - ci
dependencies: []
references:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
modified_files:
  - .github/workflows/ci.yml
ordinal: 407004
actual_start: '2026-11-09 23:18'
actual_end: '2026-11-10 02:44'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI on the fork (kuwork/Backlog.md) fails at install and test time. Both install steps in ci.yml use --linker=isolated, which leaves directly imported transitive packages (github-slugger, refractor, @eigenpal/docx-editor-i18n) unresolvable from the project root and prevents scripts/build.ts from resolving the target DuckDB native binding; Linux tests also time out at 10s while CLI/graph tests take 10-12s. BACK-800 did not introduce the isolated linker: it only added --os/--cpu (the linker came from TASK-191, 2025-07-21). The fork CI has been red since 2026-06-02 but green release.yml runs and a mistaken read of upstream MrLesk/Backlog.md status masked it. Align ci.yml with release.yml, raise the timeout, and record the diagnosis so fork CI status is checked correctly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both ci.yml install steps use Bun default hoisted linker, with no --linker=isolated, matching release.yml
- [x] #2 The cross-compile install keeps --os/--cpu so target-platform DuckDB bindings are installed
- [x] #3 Linux test timeout is raised from 10000 to 30000, matching the Windows job and bunfig.toml
- [x] #4 Comments in ci.yml explain why the isolated linker cannot be used and why the 30s timeout is required
- [x] #5 The task records why the failure surfaced only now: TASK-191 introduced the linker, BACK-800 only added --os/--cpu, fork CI has been red since 2026-06-02, and release runs plus upstream/fork status confusion masked it
- [x] #6 CI status checks target the fork itself with --repo kuwork/Backlog.md, not the upstream repository
- [x] #7 No test semantics, dependencies or other workflows are changed; only the ci.yml diff is staged for the user to commit
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bun install --frozen-lockfile (hoisted) resolves the imported packages locally and bunx tsc --noEmit passes
- [x] #2 The ci.yml diff is reviewed and staged, with modified files, actual start/end and final summary recorded in the task
- [x] #3 Pre-existing local failures caused by missing MDB fixtures are documented as out of scope, without changing tests or adding fixtures
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce locally with bun install --frozen-lockfile --linker=isolated and identify the resolution errors (ghost dependencies, DuckDB binding).
2. Confirm the hoisted install resolves the same imports and that release.yml already uses the hoisted command.
3. Remove --linker=isolated from the lint/unit-test install and the cross-compile install, keeping --os/--cpu.
4. Raise the Linux test timeout to 30000 and add inline comments documenting both decisions.
5. Trace ci.yml history to answer why it surfaced now (21 commits, TASK-191, BACK-800) and inspect the fork own CI runs with --repo kuwork/Backlog.md.
6. Verify locally (install, tsc) and stage only ci.yml for the user commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: with --linker=isolated, packages that the source imports directly but that are not declared in package.json (github-slugger, refractor, @eigenpal/docx-editor-i18n) are only linked inside a nested node_modules and cannot be resolved from the project root; scripts/build.ts also resolves the target DuckDB native binding from the root. Both install paths in ci.yml were affected. release.yml never had the isolated linker, which is why the release channel stayed green while CI was red.

Why it surfaced only now: ci.yml has 21 commits in its history. --linker=isolated came from TASK-191 (2025-07-21); BACK-800 (2026-10-15) only appended --os/--cpu to the cross-compile install for DuckDB bindings and did not touch the linker. The fork CI has been failing since 2026-06-02, but the green release.yml runs and a misread of upstream MrLesk/Backlog.md status (instead of --repo kuwork/Backlog.md) made it look healthy. ci.yml only triggers on push to main and pull_request, so pushes to release or wiki-tmp never exercise it; extending branch coverage is a separate follow-up that needs approval.

Changes: two install commands now use bun install --frozen-lockfile (keeping --os/--cpu on the cross-compile job), Linux test timeout goes from 10000 to 30000 to match Windows and bunfig.toml, and both decisions are documented inline so the linker is not reintroduced. No source, dependency, test or release.yml changes were made.

Verification: bun install --frozen-lockfile succeeds (837 installs, no changes); github-slugger, refractor and @eigenpal/docx-editor-i18n all resolve from the project root; bunx tsc --noEmit exits 0. The earlier isolated install reproduced the resolution failures. Local MDB tests still fail because backlog/assets MDB fixtures are absent on this machine; that is a pre-existing, unrelated issue and the test semantics were deliberately left untouched. Remote CI results can only be confirmed after the user commits and pushes the staged ci.yml diff.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the fork CI install and test-timeout failures in ci.yml. Both install steps now use Bun default hoisted linker (--linker=isolated removed) so directly imported transitive packages and the target DuckDB native binding resolve from the project root; the cross-compile job keeps --os/--cpu. The Linux test timeout is now 30000, matching the Windows job and bunfig.toml, and inline comments explain both decisions so the isolated linker is not reintroduced.

The investigation also answers why this appeared only now: the linker dates back to TASK-191 (2025-07-21), BACK-800 only added --os/--cpu, and the fork CI has been red since 2026-06-02 while green release.yml runs and a misread of upstream status hid it. CI checks must target the fork with --repo kuwork/Backlog.md.

Verification: bun install --frozen-lockfile succeeds, the three ghost dependencies resolve, bunx tsc --noEmit exits 0. Remote CI can only be confirmed once the staged ci.yml diff is committed and pushed by the user. Missing local MDB fixtures cause unrelated pre-existing test failures and are out of scope.
<!-- SECTION:FINAL_SUMMARY:END -->

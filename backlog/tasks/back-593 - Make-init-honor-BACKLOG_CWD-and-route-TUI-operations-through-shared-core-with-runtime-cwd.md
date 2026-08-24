---
id: BACK-593
title: >-
  Make init honor BACKLOG_CWD and route TUI operations through shared core with
  runtime cwd
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-24 19:01'
updated_date: '2026-08-24 20:04'
labels:
  - cli
  - tui
dependencies: []
references:
  - src/cli.ts
  - src/core/backlog.ts
  - src/ui/board.ts
  - src/utils/runtime-cwd.ts
priority: high
ordinal: 203400
actual_start: '2026-08-24 19:10'
actual_end: '2026-08-24 20:04'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`init` and several TUI/tooling paths still read process.cwd() directly, bypassing the shared runtime cwd resolution in src/utils/runtime-cwd.ts:

- The init handler in src/cli.ts uses const cwd = process.cwd(): with BACKLOG_CWD pinned to one project, running init from another directory silently re-initializes the wrong board (rewriting its config.yml and agent instruction files) and exits 0.
- Bare new Core(process.cwd()) constructions remain across interfaces: seven mutation handlers in src/ui/board.ts, the fallbacks in src/ui/task-viewer-with-search.ts and src/ui/enhanced-views.ts (lazy import), src/utils/status.ts, two sites in src/utils/task-path.ts, and src/completions/data-providers.ts. TUI rendering resolves the project root through requireProjectRoot(), but mutations bind to the process directory, so under BACKLOG_CWD or a subdirectory launch every board mutation reads and writes the wrong project, and each keypress discards a throwaway watcher-enabled Core instance.

Goals:

- init follows the same runtime resolution as every other command, with one shared helper and one error message plus exit code for an invalid override.
- One shared runtime-core factory becomes the only remaining Core construction path; TUI handlers reuse the caller-provided Core when available and fall back to the factory otherwise, resolving the runtime cwd and ascending to the project root without exiting for library-style callers.
- No code path constructs Core directly from process.cwd().
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with git log --oneline v1.49.3..v1.50.1 and git show c87bbde, git show 7359267 as implementation reference
- [x] #2 With BACKLOG_CWD set, backlog init targets the pinned directory (config.yml and agent instruction files land there) while the process directory stays untouched; without the variable init behaves unchanged
- [x] #3 An invalid BACKLOG_CWD makes init exit non-zero with the shared resolver message; requireRuntimeCwd() is factored out of requireProjectRoot() so the CLI keeps one resolution path
- [x] #4 createRuntimeCore() exists in src/core/backlog.ts: resolves the runtime cwd, ascends via findBacklogRoot(), keeps the resolved directory when no project is found (graceful degradation, never exits) and fails closed on invalid overrides
- [x] #5 No interface constructs Core from process.cwd(): all board.ts handlers reuse a passed Core with a memoised factory fallback, views thread their existing core, remaining fallbacks (task-viewer-with-search, status, task-path, completions) use the factory, and a repo-wide source search for Core(process.cwd constructions returns nothing
- [x] #6 Tests cover init honoring BACKLOG_CWD end to end, the factory cases (process.cwd default, override, invalid rejection, subdirectory ascent, completion graceful degradation), and a TUI mutation landing in the pinned project while process.cwd differs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Shared resolution helpers

- 1.1 Factor requireRuntimeCwd() out of requireProjectRoot() in src/cli.ts: wrap resolveRuntimeCwd(), print its message and exit 1 on an invalid override; requireProjectRoot() delegates to it.
- 1.2 Switch the init handler from const cwd = process.cwd() to await requireRuntimeCwd(); audit the whole init path (git detection and initializeGitRepository, new Core(cwd), re-init config probe, initializeProject agent instruction files, MCP guideline nudges and client setup, advanced config wizard, shell completion install) so everything derives from the resolved directory; leave user/global-scoped MCP registration subprocesses alone.
- 1.3 Add createRuntimeCore(options?) next to Core in src/core/backlog.ts: resolveRuntimeCwd() then findBacklogRoot() ascent with (await findBacklogRoot(cwd)) ?? cwd fallback semantics so optional-core library callers degrade gracefully instead of exiting; invalid overrides still fail closed.

### Phase 2 - Thread Core through TUI

- 2.1 Add core?: Core to renderBoardTui options in src/ui/board.ts and replace all seven new Core(process.cwd(), { enableWatchers: true }) handler sites with one memoised getCore() closure returning the passed instance.
- 2.2 Thread the existing core from unified-view.ts, simple-unified-view.ts and enhanced-views.ts (preserve the enhanced-views lazy-import form if cheaper than direct threading); switch the task-viewer-with-search.ts fallback to createRuntimeCore({ enableWatchers: true }).
- 2.3 Align non-TUI stragglers on the factory: src/utils/status.ts, both src/utils/task-path.ts fallback sites, and src/completions/data-providers.ts.

### Phase 3 - Tests and verification

- 3.1 Init integration tests in src/test/cli-init-create.test.ts with suite-level BACKLOG_CWD save/restore: a sibling-repo pinning case asserting the pinned directory receives config.yml and AGENTS.md while the process directory stays empty, an unchanged-behavior case without the variable, and an invalid-override case asserting exit 1 with the shared message and nothing initialized.
- 3.2 Factory unit tests in src/test/runtime-cwd.test.ts: process.cwd default, BACKLOG_CWD override, invalid override rejection, nested-subdirectory ascent to the parent project root, and completion providers degrading to static fallbacks when no project exists.
- 3.3 TUI test driving a board mutation persist path once with BACKLOG_CWD at a fixture and once with an explicit core for a second fixture, proving the task lands accordingly and the passed instance wins.
- 3.4 Verify: a repo-wide source search for Core(process.cwd returns nothing; bunx tsc --noEmit; bun run check .; scoped suites then bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- src/cli.ts: factored requireRuntimeCwd() out of requireProjectRoot() so the CLI keeps one resolution path and one error message plus exit code on an invalid override; the init handler now awaits requireRuntimeCwd() instead of reading process.cwd(), and its help description documents the BACKLOG_CWD behavior.
- src/core/backlog.ts: added createRuntimeCore(options?) next to Core - resolves the runtime cwd then ascends via findBacklogRoot(), keeping the resolved directory when no project exists so library-style fallbacks degrade gracefully instead of exiting, and failing closed on invalid overrides.
- src/ui/board.ts: renderBoardTui accepts core?: Core; a memoised getCore() closure now backs all eight mutation sites (create persist, editor, details complete/archive, reorder move, board-key complete/archive, and the hideEmptyColumns toggle), replacing every bare watcher-enabled construction.
- Views thread their existing core: unified-view.ts and simple-unified-view.ts pass options.core into renderBoardTui, enhanced-views.ts forwards its optional core, and task-viewer-with-search.ts falls back to createRuntimeCore({ enableWatchers: true }).
- Non-TUI stragglers aligned on the factory: getValidStatuses in utils/status.ts, both getTaskPath/getTaskFilename fallbacks in utils/task-path.ts, and completions/data-providers.ts which dropped its local createCore for withCore over createRuntimeCore.

### Verification

- Repo-wide search for bare constructions returns nothing; bunx tsc --noEmit clean; bun run check . clean apart from 3 pre-existing noNonNullAssertion warnings in untouched src/core/assets.ts.
- runtime-cwd.test.ts additions cover the factory (process.cwd default, BACKLOG_CWD override, subdirectory ascent from override and from cwd, staying on the resolved directory when projectless, fail-closed on a missing directory) and completion providers reading the parent project from a subdirectory plus static-fallback degradation when projectless or invalid.
- tui-runtime-cwd.test.ts drives the board n-handler persist from an unrelated process directory: the task lands in BACKLOG_CWD without an instance and a supplied Core wins over BACKLOG_CWD. A composer-completion deferred plus one setImmediate macrotask clears the modal guard deterministically before quitting, avoiding wall-clock polling.
- cli-init-backlog-cwd.test.ts: init pins config.yml to the BACKLOG_CWD directory while the process directory stays untouched, unchanged behavior without the variable, invalid override exits non-zero with the shared message and initializes nothing (nothrow shell mode).
- Scoped suites green: the three new or extended files 19 pass; existing init suites (enhanced-init, cli-init-no-git, cli-init-claude-default, server-init) 32 pass.
- Full bun test 1968 pass / 14 fail; a HEAD baseline worktree run of the five affected files reproduced the same failure families (installClaudeAgent content, MCP clearable dependency semantics) with more failures than the working tree, confirming them pre-existing and unrelated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
init now resolves through the same shared runtime flow as every other command, so BACKLOG_CWD pins it to the intended project and an invalid override exits loudly instead of silently re-initializing another board. One createRuntimeCore factory is the only remaining Core construction path: board mutations reuse the caller-provided core through getCore(), every view and tooling fallback resolves the runtime cwd and ascends to the project root without exiting, and a repo-wide search confirms nothing constructs Core directly from process.cwd(). Covered by factory unit tests, init integration tests, and a TUI test proving mutations land in the pinned project while the process directory differs.
<!-- SECTION:FINAL_SUMMARY:END -->

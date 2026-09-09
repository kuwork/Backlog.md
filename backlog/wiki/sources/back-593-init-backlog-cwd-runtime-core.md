---
title: BACK-593 Make init honor BACKLOG_CWD and route TUI operations through shared core with runtime cwd
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - cli
  - tui
source_path: backlog/tasks/back-593 - Make-init-honor-BACKLOG_CWD-and-route-TUI-operations-through-shared-core-with-runtime-cwd.md
---

# BACK-593 Make init honor BACKLOG_CWD and route TUI operations through shared core with runtime cwd

`init` and several TUI/tooling paths read `process.cwd()` directly, bypassing the shared runtime cwd resolution: with BACKLOG_CWD pinned to one project, `init` run from another directory silently re-initialized the wrong board, and every TUI board mutation bound to the process directory and discarded a throwaway watcher-enabled Core per keypress. Now one `createRuntimeCore()` factory is the only Core construction path and init follows the shared runtime flow.

## Summary

- `src/cli.ts`: `requireRuntimeCwd()` factored out of `requireProjectRoot()` (one resolution path, one error message + exit 1 on invalid override); the init handler awaits it instead of `process.cwd()`, covering git detection, Core construction, re-init probe, agent instruction files, MCP nudges, config wizard, and completion install.
- `src/core/backlog.ts`: new `createRuntimeCore(options?)` — resolves runtime cwd, ascends via `findBacklogRoot()`, keeps the resolved directory when no project exists (graceful degradation for library callers, never exits), fails closed on invalid overrides.
- `src/ui/board.ts`: `renderBoardTui` accepts `core?: Core`; a memoised `getCore()` closure backs all eight mutation sites (create persist, editor, details complete/archive, reorder move, board-key complete/archive, hideEmptyColumns toggle), replacing every bare `new Core(process.cwd(), { enableWatchers: true })`.
- Views thread their existing core (unified-view, simple-unified-view, enhanced-views); `task-viewer-with-search.ts` falls back to `createRuntimeCore({ enableWatchers: true })`; stragglers aligned: `src/utils/status.ts`, both `src/utils/task-path.ts` fallback sites, `src/completions/data-providers.ts` (dropped its local createCore for `withCore` over the factory).
- Repo-wide search confirms no `Core(process.cwd())` constructions remain; full suite 1968 pass / 14 pre-existing unrelated failures confirmed via HEAD baseline worktree.

## Acceptance Criteria

- init targets the BACKLOG_CWD-pinned directory end to end; invalid override exits non-zero with the shared message; createRuntimeCore exists with graceful degradation; no interface constructs Core from process.cwd(); tests cover init pinning, factory cases, and a TUI mutation landing in the pinned project.

## Related Concepts

- [[concepts/core-architecture]] — Core construction and runtime cwd resolution
- [[concepts/cli-tui]] — TUI core threading through views and board handlers

## Related Sources

- [[sources/back-590-hide-empty-board-columns]] — board mutation/persist paths that gained the shared core

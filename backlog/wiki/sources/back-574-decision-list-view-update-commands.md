---
title: Add decision list, view, and update commands with task-list-style interactive browser
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - migration
  - cli
  - tui
  - decisions
source_path: backlog/tasks/back-574 - Add-decision-list-view-and-update-commands-with-task-list-style-interactive-browser.md
---

# Add decision list, view, and update commands with task-list-style interactive browser

Expanded the CLI decision surface from a single `backlog decision create` to full `list` / `view` / `update` commands, plus an interactive two-pane decision browser that mirrors the existing task-list interaction pattern. Also hardened the shared blessed TUI program for sequential screens, fixing PowerShell/VS Code hangs after closing a viewer.

## Summary

- `backlog decision list` enumerates decisions with `--plain` and `--json` modes; JSON uses a versioned `{ schemaVersion: 1, kind: "decision-list", decisions: [...] }` envelope; empty log prints `No decisions found.`; non-TTY defaults to plain.
- `backlog decision view <decisionId>` prints frontmatter and markdown body, defaulting to an interactive scrollable viewer in TTY mode and `--plain` otherwise.
- `backlog decision update <decisionId>` supports `--content` (replace body) and repeatable `--append-content` (append blocks); both accept literal `\n` escapes via the shared `processCliEscapes()` helper; reuses `core.updateDecisionFromContent()` for structured section parsing (Context / Decision / Consequences / Alternatives).
- New `src/ui/decision-list-viewer.ts`: two-pane browser referencing the task-list interaction model — left pane `Decisions (N)`, right pane raw markdown details, `←/→` switches panes, `↑/↓/j/k` navigates or scrolls, active pane border turns yellow and reverts on blur, bottom help bar.
- TUI hardening in `src/ui/tui.ts`: new `releaseSharedProgram()` cleans up the shared blessed program between sequential screens; `scrollableViewer()` now disables mouse tracking on Windows, adds explicit scroll keys (`PgUp/PgDn/Home/End`), calls `screen.enter()` on open and `screen.leave()` + `releaseSharedProgram()` on close, and falls back to plain output when terminal size is unavailable.
- Guide registration: added `decision-list` help context to `src/ui/components/help-popup.ts`; added `CLI_DECISIONS_GUIDE` / `MCP_DECISIONS_GUIDE` exports, `"decisions"` in `WORKFLOW_GUIDE_KEYS` / `INSTRUCTION_GUIDE_KEYS` (`src/mcp/workflow-guides.ts`), so `backlog instructions decisions` works for CLI and MCP agents.
- Tests in `src/test/cli-doc-decision-board.test.ts` (create `--plain`, list plain/json/empty, view, update) and `src/test/cli-json-output.test.ts` (envelope, conflicting output modes).

## Acceptance Criteria

- `decision list` supports `--plain`/`--json` and reports `No decisions found.` for an empty log; `decision view` and `decision update` (`--content` / `--append-content` with literal `\n`) work.
- Interactive list opens a two-pane browser matching the task-list interaction model (pane switching, vim keys, yellow active-border, help bar).
- TTY handles Windows/PowerShell/VS Code via `releaseSharedProgram()`, terminal-state restore, disabled mouse tracking, and plain fallback.
- CLI and MCP decision guides updated; tests cover list/view/update.

## Related Concepts

- [[concepts/cli-tui]] — two-pane browser and shared blessed program lifecycle
- [[concepts/json-output]] — versioned decision-list JSON envelope contract
- [[concepts/cli-instructions]] — new decisions guide registered with the instructions system

## Related Sources

- [[sources/back-521.7]] — milestone CLI parity work that established the pattern of extending CLI surfaces to match MCP
- [[sources/back-562-stable-json-output]] — the stable JSON contract the decision-list envelope follows

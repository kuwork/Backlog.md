---
title: doc-002 Configuring VIM and Neovim as Default Editor
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - cli
  - documentation
source_path: backlog/docs/doc-002 - Configuring-VIM-and-Neovim-as-Default-Editor.md
---

# doc-002 Configuring VIM and Neovim as Default Editor

User guide for pointing Backlog.md at VIM/Neovim as the editor for task editing, covering three configuration routes, editor resolution priority, and a troubleshooting catalog for terminal-rendering and input issues.

## Summary

- Three configuration routes: `EDITOR` environment variable (recommended), `backlog config set defaultEditor`, or the `backlog init` wizard prompt
- Editor resolution priority: `EDITOR` env var > `config.defaultEditor` in `backlog/config.yml` > platform default (nano on macOS/Linux, notepad on Windows)
- Troubleshooting sections: partial screen rendering, editor not responding to input, broken colors (`TERM=xterm-256color`), editor exiting immediately — each with cause and fix
- Technical root cause documented: pre-task-318 Backlog.md used Bun's `$` shell template which didn't inherit stdio; fixed in v1.21.0 by switching to `Bun.spawn()` with explicit `stdio: "inherit"` in `src/utils/editor.ts`
- TUI integration: editing from `backlog board` (press `E`) suspends the blessed screen, exits the alternate buffer, restores terminal state after the editor exits
- Best practices: full editor paths, markdown-specific vimrc settings, git editor alignment, per-tool aliases (`EDITOR=nvim backlog`)

## Acceptance Criteria

- Not applicable (user guide); verification recipe included: `backlog config get defaultEditor`, then edit a task via viewer `E` key or `backlog task edit`.

## Related Concepts

- [[concepts/cli-tui]] — TUI editor-handoff behavior (screen suspend/restore) this guide explains
- [[concepts/cli-instructions]] — `defaultEditor` config key and its precedence

## Related Sources

- [[sources/config-docs]] — broader configuration documentation
- [[sources/back-586-clear-default-editor]] — how the `defaultEditor` config value is cleared

---
title: doc-002 - 配置 Vim/Neovim 为默认编辑器
labels: [source, cli, documentation]
created_date: 2026-09-26 14:15
updated_date: 2026-10-09 23:30
source_path: backlog/docs/doc-002 - Configuring-VIM-and-Neovim-as-Default-Editor.md
---

# doc-002 - 配置 Vim/Neovim 为默认编辑器

用户指南：如何将 Backlog.md 的编辑器指向 VIM/Neovim，涵盖三条配置路径、编辑器解析优先级，以及终端渲染与输入问题的排障目录。

## 目标

让用户能通过 `EDITOR` 环境变量、`backlog config set defaultEditor` 或 `backlog init` 向导三种方式把默认编辑器设为 Vim/Neovim，并能自行排查终端渲染、输入响应、颜色与立即退出等常见问题。

## 实现要点

- 三条配置路径：`EDITOR` 环境变量（推荐）、`backlog config set defaultEditor`、`backlog init` 向导提示
- 编辑器解析优先级：`EDITOR` 环境变量 > `backlog/config.yml` 中的 `config.defaultEditor` > 平台默认（macOS/Linux 为 nano，Windows 为 notepad）
- 排障章节：半屏渲染、编辑器不响应输入、颜色异常（`TERM=xterm-256color`）、编辑器立即退出——每项均给出原因与修复方法
- 技术根因已记录：task-318 之前的 Backlog.md 使用 Bun 的 `$` shell 模板，无法继承 stdio；v1.21.0 起改用 `Bun.spawn()` 并显式指定 `stdio: "inherit"`（`src/utils/editor.ts`）
- TUI 集成：在 `backlog board` 中编辑（按 `E`）会挂起 blessed 屏幕、退出 alternate buffer，并在编辑器退出后恢复终端状态
- 最佳实践：使用完整编辑器路径、markdown 专用 vimrc 设置、与 git 编辑器对齐、按工具设置别名（`EDITOR=nvim backlog`）

## 验证

不适用（用户指南）；附验证方法：`backlog config get defaultEditor`，然后通过查看器 `E` 键或 `backlog task edit` 编辑任务验证。

## Related Concepts

- [[concepts/cli-tui]] — 本指南解释的 TUI 编辑器交接行为（屏幕挂起/恢复）
- [[concepts/cli-instructions]] — `defaultEditor` 配置键及其优先级

## Related Sources

- [[sources/config-docs]] — 更广泛的配置文档
- [[sources/back-586-clear-default-editor]] — `defaultEditor` 配置值的清除方式

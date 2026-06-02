---
title: AI 代理与集成
labels: [entity]
created_date: 2026-05-06 00:00
---


# AI 代理与集成

Backlog.md 支持多种 AI 编码助手通过 MCP 或 CLI 指令集成。

## 支持的 AI 工具

| 工具 | 集成方式 | 配置命令 |
|---|---|---|
| Claude Code | MCP | `claude mcp add backlog --scope user -- backlog mcp start` |
| OpenAI Codex | MCP | `codex mcp add backlog backlog mcp start` |
| Google Gemini CLI | MCP | `gemini mcp add backlog -s user backlog mcp start` |
| Kiro | MCP | `kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start` |
| Cursor | MCP | 手动配置 `mcpServers` |
| GitHub Copilot | CLI 指令 | `CLAUDE.md` / `AGENTS.md` / `.github/copilot-instructions.md` |

## 代理指令文件

`backlog init` 可自动生成以下文件：
- `CLAUDE.md` — Claude Code / Claude Desktop
- `AGENTS.md` — 通用代理指令
- `GEMINI.md` — Gemini CLI
- `.github/copilot-instructions.md` — GitHub Copilot

包含工作流指南、任务创建规范、验收标准格式等。

## MCP 与 CLI 的区别

- **MCP（推荐）**：AI 直接调用 Backlog.md 的工具，无需解析 shell 输出。更可靠、更安全。
- **CLI 指令**：AI 通过阅读指令文件了解如何使用 `backlog` 命令，然后自行执行 shell 命令。适合不支持 MCP 的环境。

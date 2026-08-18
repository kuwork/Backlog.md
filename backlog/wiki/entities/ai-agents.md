---
title: AI 代理与集成
labels: [entity]
created_date: '2026-05-06 00:00'
updated_date: '2026-07-14 11:20'
---

# AI 代理与集成

Backlog.md 支持多种 AI 编码助手通过 MCP 或 CLI 指令集成。

## 支持的 AI 工具

| 工具 | 默认/可选 | 集成方式 | 配置命令 |
|---|---|---|---|
| Claude Code | 可选 | MCP | `claude mcp add backlog --scope user -- backlog mcp start` |
| OpenAI Codex | 可选 | MCP | `codex mcp add backlog backlog mcp start` |
| Google Gemini CLI | 可选 | MCP | `gemini mcp add backlog -s user backlog mcp start` |
| Kiro | 可选 | MCP | `kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start` |
| Cursor | 可选 | MCP | 手动配置 `mcpServers` |
| GitHub Copilot | 可选 | CLI 指令 | `CLAUDE.md` / `AGENTS.md` / `.github/copilot-instructions.md` |
| 通用 Agent | 默认推荐 | CLI 指令 | `AGENTS.md` |

## 默认集成路径

`backlog init` 默认推荐 **CLI instructions** 作为 AI 集成路径（[[sources/back-521.2|BACK-521.2]]）：

- 生成一个短的、幂等的 CLI nudge 到 `AGENTS.md`（以及 `CLAUDE.md`、`GEMINI.md`、Copilot instructions）。
- nudge 指示代理在创建/执行任务前运行 `backlog instructions`，并在不熟悉命令时使用 `backlog <command> --help`。
- 旧的 757 行长 CLI 指南不再被安装到 agent instruction 文件中。
- MCP 集成与 no-AI 集成作为显式替代选项保留。

## 代理指令文件

`backlog init` 可自动生成或更新以下文件：
- `AGENTS.md` — 通用代理指令（CLI instructions 默认目标）
- `CLAUDE.md` — Claude Code / Claude Desktop
- `GEMINI.md` — Gemini CLI
- `.github/copilot-instructions.md` — GitHub Copilot

这些文件中的 Backlog 块是幂等的：切换集成模式时会替换 Backlog 块，同时保留用户自己的其他内容。

### Cursor 行为（BACK-410）

Cursor 作为 init 选项映射到共享的 `AGENTS.md` 目标：
- 不再创建 `.cursorrules` 等 Backlog 拥有的 Cursor 规则文件
- `CURSOR_GUIDELINES` 导出已移除
- CLI 与 Web init 的描述文案已同步说明 Cursor 写入/使用 `AGENTS.md`
- 保留用户已有的 `.cursor/rules` 内容

## MCP 与 CLI instructions 的区别

- **CLI instructions（默认推荐）**：AI 通过阅读 `backlog instructions` 输出与命令帮助了解如何使用 `backlog` 命令，然后自行执行 shell 命令。适合广泛的 Agent 环境，无需 MCP 支持。
- **MCP（可选）**：AI 直接调用 Backlog.md 的工具，无需解析 shell 输出。更可靠、更安全，但需要客户端支持 MCP 协议。

两种路径共享同一工作流指南注册表，但分别提供 CLI 命令示例与 MCP 工具/字段示例。

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/cli-entry]] — CLI 入口与命令体系

## Related Entities

- [[entities/backlog-cli]] — Backlog.md CLI 工具

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.2]] — BACK-521.2 Short agent nudge and init default migration
- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance
- [[sources/back-410-cursor-agents-md-cleanup]] — Cursor AGENTS.md cleanup

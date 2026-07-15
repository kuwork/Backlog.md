---
title: CLI instructions 作为默认 AI 集成路径
labels: [decision, agent-guidance, cli, mcp]
created_date: '2026-07-14 11:20'
updated_date: '2026-07-14 11:20'
---

# CLI instructions 作为默认 AI 集成路径

## 决策内容

`backlog init` 默认推荐 CLI instructions 作为 AI 集成路径，MCP 作为显式可选连接器保留。

## 背景

BACK-521 的目标是让 `backlog` 命令成为人类和代理的默认入口，同时保持 MCP 可用。旧的 agent instruction 文件安装了一份 757 行的长 CLI 指南，导致：
- 生成文件臃肿，容易过时。
- 代理无法自动获取最新指南内容。
- 用户切换 MCP/CLI 模式时难以维护。

## 选择对比

| 方案 | 优点 | 缺点 |
|---|---|---|
| 保留长 CLI 指南安装 | 代理离线可用 | 文件臃肿、与源码不同步、切换模式困难 |
| 短 nudge + `backlog instructions`（选择） | 文件轻量、指南随版本更新、幂等块管理、保留 MCP 选项 | 代理需要能运行 `backlog` 命令 |
| 仅 MCP | 工具调用可靠 | 不支持非 MCP 客户端（Copilot、通用 Agent） |

## 理由

- 大多数 Agent 环境可以执行 shell 命令，`backlog instructions` 提供最新指南。
- 短 nudge 保持 agent instruction 文件简洁，便于版本控制和用户自定义。
- 保留 MCP 选项满足需要原生工具调用的场景。
- 与「公共命令同时服务人类和代理」的 BACK-521 原则一致。

## 影响

- `backlog init --defaults` 现在创建/追加 `AGENTS.md` 短 CLI nudge。
- 旧的 `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`/Copilot instructions 中的长指南被替换为短 nudge。
- README 和 CLI-INSTRUCTIONS.md 文档描述 CLI instructions 为默认路径。

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成

## Related Entities

- [[entities/ai-agents]] — AI 代理与集成

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.2]] — BACK-521.2 Short agent nudge and init default migration

---
title: 使用短 CLI nudge 替代长 agent instruction 指南
labels: [decision, agent-guidance, cli]
created_date: '2026-07-14 11:20'
updated_date: '2026-07-14 11:20'
---

# 使用短 CLI nudge 替代长 agent instruction 指南

## 决策内容

CLI-mode 的 agent instruction 文件（`AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、Copilot instructions）只接收一个短的、幂等的 CLI nudge，而不是旧的 757 行完整指南。

## 背景

旧的 `backlog init` 将完整的 CLI 指南嵌入到 agent instruction 文件中，导致：
- 文件体积大。
- 指南更新后已安装文件不会自动同步。
- 与 MCP nudge 不一致。

## 选择对比

| 方案 | 优点 | 缺点 |
|---|---|---|
| 长指南（旧方案） | 代理无需调用 CLI 即可读取完整流程 | 文件臃肿、易过时、切换模式困难 |
| 短 nudge + 动态 `backlog instructions`（选择） | 文件轻量、随版本更新、与 MCP nudge 形状一致、安全插入现有文件 | 首次需要调用 CLI |

## 短 nudge 要求

- 与 MCP nudge 形状类似：短、幂等、被 Backlog 标记包围。
- 安全插入现有文件，不覆盖用户内容。
- 指示代理运行 `backlog instructions` 并使用 `backlog <command> --help`。

## 理由

- 指南内容应 living in the binary，而不是复制到每个项目的 agent 文件中。
- 保持 agent instruction 文件聚焦在项目特定上下文，而非通用 Backlog 流程。
- 切换 AI 集成模式时，只需替换 Backlog 块，不影响用户自己的指令内容。

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/cli-entry]] — CLI 入口与命令体系

## Related Entities

- [[entities/ai-agents]] — AI 代理与集成

## Related Sources

- [[sources/back-521.2]] — BACK-521.2 Short agent nudge and init default migration

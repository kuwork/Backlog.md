---
title: BACK-521.2 Short agent nudge and init default migration
labels: [source, cli, agent-guidance, init]
source_path: backlog/tasks/back-521.2 - Short-agent-nudge-and-init-default-migration.md
created_date: '2026-06-13 14:13'
updated_date: '2026-07-14 11:20'
---

# BACK-521.2 Short agent nudge and init default migration

**状态**: Done | **负责人**: @codex | **优先级**: high | **父任务**: [[sources/back-521|BACK-521]]

将 `backlog init` 的 AI 集成默认路径从完整 CLI 指令文件安装改为短 CLI 引导语（nudge），同时保留 MCP 与无 AI 集成的显式选项。

## 关键变更

- `backlog init` 将 CLI instructions 标记为推荐的 AI 集成路径，MCP / no-AI 作为显式替代选项。
- `backlog init --defaults` 默认创建或追加短 CLI nudge 到 `AGENTS.md`。
- 旧的 757 行长 CLI 指南不再安装到 `AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、Copilot instructions 或 `README.md`。
- CLI nudge 形状与现有 MCP nudge 类似：短、幂等、被 Backlog 标记包围、安全地插入现有文件而不覆盖用户内容。
- nudge 内容要求代理在创建或执行任务前运行 `backlog instructions`，并在使用不熟悉的命令前先查看命令帮助。
- 切换集成模式（MCP ↔ CLI instructions ↔ no-AI）时，现有 Backlog 块被干净替换，无关文件内容保留。

## 实现要点

1. 新增短 CLI nudge 常量，指示代理运行 `backlog instructions` 并在不熟悉操作时使用 `backlog <command> --help`。
2. 更新 agent instruction writer，使 CLI 模式文件接收短 nudge 而非旧长指南，同时保留标记替换与幂等性。
3. 修改 `backlog init` 默认值：非交互默认使用 CLI instructions 并创建 `AGENTS.md`。
4. 保留显式 MCP 模式与 no-AI 模式行为。
5. 更新 instruction/init 测试，断言新的 nudge 契约而非旧长指南内容。

## 验证

- `bun test src/test/agent-instructions.test.ts`
- `bun test src/test/cli.test.ts --test-name-pattern "agent instructions|MCP integration|default to CLI|skipping AI"`
- `bunx tsc --noEmit`

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面与工作流指南
- [[concepts/cli-entry]] — CLI 入口与命令体系
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成

## Related Entities

- [[entities/ai-agents]] — AI 代理与集成方式
- [[entities/backlog-cli]] — Backlog.md CLI 工具

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.1]] — BACK-521.1 Shared workflow instruction registry and CLI access

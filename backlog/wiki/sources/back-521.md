---
title: BACK-521 CLI-first agent workflow refactor and local instruction surface
labels: [source, cli, agent-guidance, mcp]
source_path: backlog/tasks/back-521- CLI-workflow-guidance-for-agents-and-humans.md
created_date: '2026-06-13 14:12'
updated_date: '2026-07-14 11:20'
---

# BACK-521 CLI-first agent workflow refactor and local instruction surface

**状态**: Done | **负责人**: @codex | **优先级**: high | **里程碑**: m-8

让 `backlog` 命令成为人类和代理的默认入口。生成的指令文件保持简短并指向当前 CLI 指南；工作流指南通过公共 CLI 命令可读；命令帮助包含清晰的输入 schema；MCP 仍作为可选连接器保留。

## 关键 Acceptance Criteria

- `backlog init` 推荐 CLI instructions 作为 AI 集成路径，同时保留显式 MCP 和 no-AI 选项。
- 生成的 agent instruction 文件使用短的、幂等的 CLI nudge，指向 CLI 指南入口并保留现有用户内容。
- 工作流指南可通过公共 CLI 命令读取，人类和代理均可使用。
- 公共命令帮助包含 required/optional 字段的文本输入 schema，不引入单独的 agent-only 命名空间。
- 常见无效命令、选项、字段和值的错误帮助代理自我纠正（指向相关帮助或接受的值）。
- 现有 MCP 集成保持可用并继续暴露工作流指南。
- 文档和测试将 CLI instructions 描述为默认 AI 工作流，MCP 为可选。
- `backlog instructions` 输出是 CLI 专用的，不会告诉 CLI-only 代理使用 MCP 工具或 `backlog://workflow/...` 资源。

## 主要子任务

- [[sources/back-521.1]] — Shared workflow instruction registry and CLI access
- [[sources/back-521.2]] — Short agent nudge and init default migration
- [[sources/back-521.6]] — Root command local instruction hub
- [[sources/back-521.7]] — Milestone CLI parity with MCP operations
- [[sources/back-521.14]] — Update CLI/MCP instruction guides with missing agent guidance

## 实现原则

- 使用公共命令服务人类和代理；不添加 agent-only 命名空间。
- 复用现有工作流指南注册表，避免重复指令内容。
- 使用 Commander v14；不引入新 CLI 框架。
- 文本输入 schema 帮助包含 String、Markdown、Integer、Boolean、Status、Task ID、docs-relative path、project-root-relative path 等字段类型。
- 生成的 instruction 文件保留标记化幂等性，保留现有用户内容。

## 验证

- `bun test`（1327+ pass, 2 skip, 0 fail）
- `bunx tsc --noEmit`
- `bun run check .`
- `bun run build`
- `git diff --check`

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/cli-entry]] — CLI 入口与命令体系
- [[concepts/milestones]] — 里程碑管理

## Related Entities

- [[entities/ai-agents]] — AI 代理与集成
- [[entities/backlog-cli]] — Backlog.md CLI 工具

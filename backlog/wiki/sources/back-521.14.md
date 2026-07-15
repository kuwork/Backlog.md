---
title: BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance
labels: [source, docs, agent-guidance, cli, mcp]
source_path: backlog/tasks/back-521.14 - Update-CLI-MCP-instruction-guides-with-missing-agent-guidance.md
created_date: '2026-07-14 17:19'
updated_date: '2026-07-14 11:20'
---

# BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance

**状态**: Done | **负责人**: @kimi | **父任务**: [[sources/back-521|BACK-521]]

将 `agent-guidelines.md` 中缺失的运营指导回传到新的 CLI/MCP 指令表面，补充目录布局、黄金法则、任务字段速查、里程碑指南、图片/资源处理、常见问题（含文档引用路径示例），并更新相关测试。

## 关键变更

- 为 CLI 与 MCP 分别创建 `milestones.md` 指南，并在 `workflow-guides.ts`、`index.ts`、`commands/instructions.ts` 中注册。
- 在 CLI 与 MCP overview 中补充：Backlog 目录布局、黄金法则、禁止直接编辑任务的 DO/DON'T 示例、任务图片/资源、搜索速查、其他常用命令、常见问题（含文档引用路径示例）。
- 将「任务字段速查」与「验收标准/DoD 操作」从 overview 移动到 `task-execution` 指南。
- 在 CLI 与 MCP `task-creation` 指南中明确：**创建任务时不要包含 Implementation Plan**；执行代理会在后续补充计划并等待用户批准。
- 强化 CLI `task-execution` 指南：编码前必须获得用户批准或显式跳过审查。
- 更新 `src/test/cli.test.ts` 与 `src/test/mcp-server.test.ts`，覆盖新的 milestones 指南与内容迁移。
- 重新构建 `dist/backlog.exe`，使新的 milestones 指南在发布二进制中可用。

## 依赖

- [[sources/back-521.1]] — Shared workflow instruction registry and CLI access
- [[sources/back-521.6]] — Root command local instruction hub
- [[sources/back-521.7]] — Milestone CLI parity with MCP operations

## 验证

- `bun test src/test/cli.test.ts --test-name-pattern "backlog instructions command"` — 7 pass
- `bun test src/test/mcp-server.test.ts` — 10 pass
- `bunx tsc --noEmit` — changed files 无新增类型错误
- `bun run check .`

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/task-lifecycle]] — 任务生命周期
- [[concepts/milestones]] — 里程碑管理

## Related Entities

- [[entities/ai-agents]] — AI 代理与集成
- [[entities/backlog-cli]] — Backlog.md CLI 工具

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.2]] — BACK-521.2 Short agent nudge and init default migration
- [[sources/back-521.7]] — BACK-521.7 Milestone CLI parity with MCP operations

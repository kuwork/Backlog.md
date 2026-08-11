---
title: BACK-532 在指令指南中记录 CLI 草稿工作流
labels: [source, cli, mcp, docs, agent-guidance]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-532 - Document-CLI-draft-workflow-in-agent-instruction-guides.md
---

# BACK-532 在 agent 指令指南中记录 CLI 草稿工作流

为 CLI 与 MCP 指令面补齐草稿（draft）工作流的说明。

## 问题

CLI 与 MCP 指令面未说明如何使用草稿、如何 promote/demote，以及 promote/demote 输出新 ID 后如何继续编辑（前缀被剥离）。

## 解决方案

仿照 milestones 指南模式，为 CLI 与 MCP 各建一份草稿指南，并注册 MCP 资源、更新所有引用文件与测试。指南覆盖：草稿 vs 任务的取舍、`backlog draft create` 与 `backlog task create --draft` 的差异、promote/demote 后 ID 变化与继续编辑方法。

## 实现位置

- `src/guidelines/cli-instructions/drafts.md`、`src/guidelines/mcp/drafts.md`（新建）
- `src/mcp/workflow-guides.ts`（注册 `backlog://workflow/drafts`）
- `src/guidelines/cli-instructions/index.ts`、`src/guidelines/mcp/index.ts`
- 更新 `overview.md`、`cli-agent-nudge.md`、`task-creation.md`

## 测试

`src/test/mcp-server.test.ts`、`src/test/mcp-drafts.test.ts` 等通过。

## Related Concepts
- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流
- [[concepts/task-lifecycle]] — 草稿生命周期

## Related Sources
- [[sources/back-521.6]] — Root command local instruction hub

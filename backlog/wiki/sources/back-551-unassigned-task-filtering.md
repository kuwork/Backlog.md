---
title: BACK-551 CLI 与 MCP 支持未指派任务过滤
labels: [source, cli, mcp, filtering]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-551 - Support-unassigned-task-filtering-in-CLI-and-MCP.md
---

# BACK-551 CLI 与 MCP 支持未指派任务过滤

让 `backlog task list` 与 MCP `task_list` 能单独列出没有 assignee 的任务。

## 解决方案

核心 `TaskListFilter.unassigned` 在 `applyTaskFilters` 中一次性实现，被 plain-list、interactive 与 search 各路径共享；任务无任何非空 assignee 条目即视为未指派。

- **CLI**：task list 新增 `--unassigned` 标志，与 `--assignee` 互斥（冲突时报清晰错误并 exit 1），支持 `--plain` 与交互视图，接入 baseFilters、active-filter 显示与交互 loader
- **MCP**：`task_list` 接受 `unassigned` 布尔（schema 含描述），与 assignee 组合时以 `VALIDATION_ERROR` 拒绝，在普通路径和 Draft 状态路径均应用该过滤

## 实现位置

- `src/types/index.ts`、`src/core/backlog.ts`、`src/cli.ts`
- `src/mcp/tools/tasks/schemas.ts`、`handlers.ts`
- 指南 `cli-instructions/task-creation.md`、`task-execution.md`、`mcp/overview.md`

## 测试

`src/test/cli.test.ts`（`--unassigned` 过滤 + 冲突错误）、`src/test/mcp-tasks.test.ts`（未指派过滤含 drafts + 冲突拒绝）。

## Related Concepts
- [[concepts/search-sequences]] — 任务过滤
- [[concepts/cli-entry]] — task list
- [[concepts/mcp-server]] — task_list 工具

## Related Sources
- [[sources/back-548-status-exclude-filtering]] — 状态过滤

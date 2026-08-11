---
title: BACK-548 状态排除与多状态过滤
labels: [source, cli, mcp, web-ui, tui, filtering]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-548 - Add-exclude-status-filtering-to-task-list-and-search.md
---

# BACK-548 任务列表与搜索增加状态排除及多状态过滤

为 CLI/Web/MCP/TUI 的任务列表与搜索增加多状态选择与状态排除过滤。

## 解决方案

核心层 `TaskListFilter.status` 扩展为 `string | string[]`，新增 `statusExcluded`，`applyTaskFilters` 以 Set 做排除匹配。

- **CLI**：`--status` 支持重复/逗号分隔多值（case-insensitive），新增 `--exclude-status`；均经 `normalizeCliStatusList` 校验（无效输入 exitCode 1）
- **Web**：All Tasks 增加两个仿 Label 过滤器的独立多选下拉 StatusFilterDropdown（包含）与 StatusExcludedDropdown（排除），状态参数持久化到 URL 查询参数；修复 URL 解析把单个状态参数重复读成两条的 bug
- **MCP**：`taskListSchema`/`taskSearchSchema` 的 status 支持字符串或数组并新增 `statusExcluded`，validators.ts JsonSchema 增加 oneOf 支持
- **TUI**：统一视图 filter state 携带 status 数组与 statusExcludedFilter，看板 move 模式忽略仅排除类过滤

## 实现位置

- `src/types/index.ts`、`src/core/backlog.ts`、`src/core/search-service.ts`
- `src/utils/status.ts`、`src/utils/task-search.ts`
- `src/cli.ts`、`src/ui/unified-view.ts`、`src/ui/board.ts`
- `src/web/components/TaskList.tsx`、`StatusFilterDropdown.tsx`、`StatusExcludedDropdown.tsx`
- `src/mcp/tools/tasks/schemas.ts`、`handlers.ts`、`src/mcp/validation/validators.ts`

## 测试

`cli-exclude-status-filtering.test.ts`（9 例）、search-service 排除测试、MCP filter 透传、unified-view、web 单状态 URL 去重。

## Related Concepts
- [[concepts/search-sequences]] — 状态过滤
- [[concepts/web-ui-features]] — 状态下拉
- [[concepts/cli-entry]] — task list 过滤

## Related Sources
- [[sources/back-551-unassigned-task-filtering]] — 未指派过滤

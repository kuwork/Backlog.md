---
title: BACK-560 - 里程碑 ID 查询匹配
labels: [source, milestones, filtering]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-560 - Match-milestone-ID-queries-in-task-list-milestone-filtering.md
---

# BACK-560 - 里程碑 ID 查询匹配

任务列表的里程碑过滤现在可以在 CLI、交互式列表和 MCP 之间一致地解析数字与规范里程碑 ID（`0`、`m-0`）、大小写变体和带标点标题。

## 实现要点

- 升级 `src/utils/milestone-filter.ts`，新增 `createMilestoneFilterValueResolver`，暴露 `resolveExactId`、`resolveExactTitle`、`resolveId` 和 `createMilestoneFilterMatcher`。
- `normalizeMilestoneFilterValue` 改用 `\p{L}\p{N}` Unicode 字符类，纯符号和非 ASCII 标题得以保留自身身份。
- `src/utils/task-search.ts`、`src/core/backlog.ts`、`src/ui/board.ts`、`src/ui/task-viewer-with-search.ts` 和 `src/ui/unified-view.ts` 全部改走共享 matcher。
- `src/cli.ts` 移除了在交互式视图之前对里程碑过滤值做预归一化的代码块。
- MCP `task_list` 的 active 与 Draft 路径一致解析里程碑 ID。
- 匹配不到任何已配置里程碑的查询返回空任务列表。

## 验收标准

- 数字/规范里程碑 ID 查询只列出分配给该里程碑的任务。
- 标题过滤支持精确、部分和容错查询，包括对标点敏感标题的处理。
- 回归测试覆盖共享匹配、CLI 输出、交互式过滤和 MCP active/draft 路径。

## Related Concepts

- [[concepts/milestones]] — 里程碑管理
- [[concepts/search-sequences]] — 搜索与过滤基础设施

## Related Sources

- [[sources/milestone-search-fix]] — BACK-480 里程碑搜索模糊匹配误报修复

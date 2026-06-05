---
title: BACK-512 看板列排序菜单跨分支任务修复
labels: [source, web-ui, bug]
created_date: '2026-06-05 15:19'
updated_date: '2026-06-05 15:19'
source_path: backlog/tasks/back-512 - Web-UI-Kanban-Show-column-sort-menu-for-cross-branch-tasks-hide-only-Apply-Priority-Order.md
---

# BACK-512 看板列排序菜单跨分支任务修复

修复看板列包含跨分支任务时，整个列操作菜单被错误隐藏的问题。

## 问题

- 原代码使用单一 `canSort` 标志检查 `tasks.every(task => !task.branch)`
- 当列中任一任务来自其他分支时，整个排序下拉菜单消失
- 但菜单中仅「Apply Priority Order」会修改持久化数据（ordinal），本地排序选项（ID/标题/优先级）完全是视图级操作

## 修复

将 `canSort` 拆分为两个独立标志：

| 标志 | 作用 | 条件 |
|---|---|---|
| `showColumnMenu` | 控制菜单按钮显示 | `onTaskReorder` 存在且列长度 > 1，不再检查跨分支 |
| `canReorder` | 控制「Apply Priority Order」显示 | `onTaskReorder` 存在且列中无跨分支任务 |

## 实现

- `src/web/components/TaskColumn.tsx` 中重构条件判断
- 用户可在含跨分支任务的列中继续使用本地排序
- 「Apply Priority Order」仅在当前分支任务列中显示

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 看板与交互

## Related Sources
- [[sources/back-504]] — BACK-504 看板拖拽修复
- [[sources/web-ui-sort-optimization]] — BACK-484 排序优化

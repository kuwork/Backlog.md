---
title: BACK-496 修复子任务在所有视图中按 ID 排序时的分组
source_path: backlog/tasks/back-496 - Fix subtask grouping under parent task for ID sorting across all views.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, bug, web-ui, sorting]
---

# BACK-496 修复子任务在所有视图中按 ID 排序时的分组

修复子任务在看板、所有任务、里程碑、甘特图四个视图中按 ID 排序时未能正确归组到父任务下方的问题。

## 根因

1. `TaskList`、`MilestonesPage`、`GanttView` 使用 `extractTaskNumericId`（仅匹配末尾数字），导致小数 ID 如 `task-495.4` 被解析为 4，与父任务 `task-495` 相隔甚远
2. 上述视图缺少子任务→父任务的归组逻辑

## 解决方案

1. 统一四个视图使用 `compareTaskIds`（支持小数 ID 正确排序）
2. 新增 `groupSubtasksUnderParents` 工具函数（`src/utils/task-sorting.ts`），支持方向参数
3. 在 Board、All Tasks、Milestones、Gantt 视图的 ID 排序时应用归组
4. 子任务内部顺序跟随整体排序方向（升序/降序）

## 实现细节

`groupSubtasksUnderParents` 遍历已排序数组，按父 ID 收集子任务到 Map，然后重建输出：每个父任务后紧跟其子任务。`direction` 参数在 `compareFn` 排序后反转子任务顺序，以匹配整体升/降序。

`TaskColumn.tsx`（看板视图）需要特殊处理：其 ID 排序是列级本地切换，与默认 ordinal/date 排序分离，仅在用户显式选择 ID 排序时应用归组。

## 文件变更

- `src/utils/task-sorting.ts` — 新增 `groupSubtasksUnderParents`
- `src/test/task-sorting.test.ts` — 单元测试（含方向反转场景）
- `src/web/components/TaskColumn.tsx` — 看板 ID 排序应用归组
- `src/web/components/TaskList.tsx` — 所有任务 ID 排序应用归组
- `src/web/components/MilestonesPage.tsx` — 里程碑 ID 排序应用归组
- `src/web/components/GanttView.tsx` — 甘特图 ID 排序应用归组

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 视图与排序

## Related Sources

- [[sources/web-ui-sort-optimization]] — BACK-484 Web UI 排序优化

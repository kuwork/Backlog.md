---
title: BACK-542 任务列表视图默认序号排序
labels: [source, web-ui, cli, sorting]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-542 - Add-ordinal-sorting-to-task-list-views.md
---

# BACK-542 任务列表视图默认序号排序

让 Web 所有任务列表与 CLI 任务列表默认按序号（ordinal）排序，与看板对齐，但不新增专门 Ordinal 列。

## 问题

Web 所有任务列表与 CLI 任务列表默认按 ID 降序，与看板不一致。

## 解决方案

- 默认排序改为序号（`sortByOrdinal`），不新增 Ordinal 列，通过默认排序与表头点击表达
- 表头点击循环：首次升序、二次降序、三次清除该列排序并恢复默认序号排序
- CLI `backlog task list` 默认返回序号排序结果，保留 `--sort ordinal` 并写入帮助文本
- 排序状态以 null 列代表默认/序号模式；`handleSortChange` 对每列三击循环；`sortedDisplayTasks` 在 null 分支用 `sortByOrdinal`；保留 `sortTasksByIdDescending` 供 ID 列分支使用

## 实现位置

- `src/web/components/TaskList.tsx`
- `src/cli.ts`

## 测试

`src/test/web-task-list-sort.test.tsx`（默认序号、三击循环）、`src/test/cli-priority-filtering.test.ts`（CLI 默认序号行为）。

## Related Concepts
- [[concepts/web-ui-features]] — 任务列表排序
- [[concepts/cli-entry]] — task list 命令

## Related Sources
- [[sources/back-541-board-column-created-sort]] — 看板列排序
- [[sources/back-543-milestone-cards-created-column]] — 里程碑 Created 列

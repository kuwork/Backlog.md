---
title: BACK-541 看板列菜单新增创建日期排序
labels: [source, web-ui, sorting]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-541 - Add-creation-date-sorting-to-board-column-menu.md
---

# BACK-541 为看板列菜单新增创建日期排序

GitHub issue #694 要求 Web 看板列菜单能按创建日期排序任务，范围刻意收紧为不加通用排序框架。

## 解决方案

在既有"按优先级排序"旁新增按创建日期排序操作，复用现有 `createdDate` 字段与当前列重排行为。将 `createdDate` 加入 `TaskColumn` 的 `columnSort` 字段与 `handleLocalSort` 签名；菜单新增升序/降序选项（沿用 sortOptions 模式）；`getDisplayTasks` 加排序分支，用 `parseStoredUtcDate` 比较日期，缺失/无效日期排末尾，任务 ID 作平局决胜。

## 实现位置

- `src/web/components/TaskColumn.tsx`
- 文案 `src/web/locales/zh-CN.ts`、`zh-TW.ts`

## 测试

`src/test/web-task-column-sort.test.tsx`（升序、降序、缺失日期回退、清空排序）。

## Related Concepts
- [[concepts/web-ui-features]] — 看板列排序
- [[concepts/date-fields]] — createdDate

## Related Sources
- [[sources/back-542-ordinal-task-list-sort]] — 序号排序
- [[sources/back-512-kanban-column-sort-menu-cross-branch]] — 看板列菜单

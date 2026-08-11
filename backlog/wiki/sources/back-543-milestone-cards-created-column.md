---
title: BACK-543 里程碑卡片任务表 Created 列
labels: [source, web-ui, milestones, sorting]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-543 - Sort-web-milestone-cards-in-creation-order.md
---

# BACK-543 按创建顺序排序 Web 里程碑卡片

让每张里程碑卡片内的任务表对齐 All Tasks：默认序号排序、新增 Created 列、同样三击表头循环；里程碑卡片本身顺序保持不变。

## 解决方案

将 `created` 加入 `BucketSortColumn` 并新增 Created 表头按钮；`getSortedTasks` 在无显式列排序时默认 `sortByOrdinal`；`handleBucketSortChange` 改为与 TaskList 一致的三击循环（升→降→清除/序号）；新增 `createdDate` 排序分支（`parseStoredUtcDate`，缺失/无效日期排末尾、ID 决胜）；更新 `MilestoneTaskRow` 网格并显示 createdDate；补充 i18n 文案。

## 实现位置

- `src/web/components/MilestonesPage.tsx`、`src/web/components/MilestoneTaskRow.tsx`
- 文案 `src/web/locales/en.ts`、`zh-CN.ts`、`zh-TW.ts`、`ja.ts`

## 测试

`src/test/web-milestones-page-search.test.tsx`（Created 列与三击重置）。

## Related Concepts
- [[concepts/milestones]] — 里程碑管理
- [[concepts/web-ui-features]] — 里程碑卡片
- [[concepts/date-fields]] — createdDate

## Related Sources
- [[sources/back-542-ordinal-task-list-sort]] — 序号排序

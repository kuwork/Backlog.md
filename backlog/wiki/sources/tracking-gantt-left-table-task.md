---
title: BACK-495.1 跟踪甘特图左表与时间解析引擎
source_path: backlog/tasks/back-495.1 - Update-left-table-and-actual-bar-time-resolution-for-tracking-Gantt.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, feature, web-ui, gantt, frontend]
---

# BACK-495.1 跟踪甘特图左表与时间解析引擎

修改甘特图左表以显示四列时间数据，并更新底层时间解析引擎支持 `actualStart`/`actualEnd`。

## 左表时间列

左表从 2 列扩展到 4 列：
- Planned Start / Planned End（计划起止）
- Actual Start / Actual End（实际起止）

工具栏新增 `showPlanTime` 和 `showActualTime` 开关，动态控制列的显示/隐藏。

## 时间解析优先级

**实际条坐标**：
1. `actualStart` → `actualEnd`
2. 缺失 → `createdDate` / `updatedDate`
3. 仍缺失 → `createdDate` + 最小宽度回退

**计划边框坐标**：
1. `plannedStart` → `plannedEnd`
2. 缺失 → 不绘制计划边框层

## 关键实现

- `parseDate` 对 date-only 值使用 `T00:00:00` 解析，确保本地时间一致性
- `getTimelineX` 新增 `snapToDay` 参数：计划日期在非日视图中吸附到 00:00，实际日期保留时间精度
- 跨年任务自动检测，实际列宽度扩展为 `w-44`（176px）防止溢出
- `formatDisplayDate` 在时间分量非零时显示 HH:MM，date-only 计划日期省略时间
- 动态左侧面板宽度基于 `showPlanTime` / `showActualTime` / `hasCrossYearTasks` 计算

## Related Sources

- [[sources/tracking-gantt-view-task]] — BACK-495 父任务
- [[sources/tracking-gantt-dual-layer-task]] — BACK-495.2 双层渲染

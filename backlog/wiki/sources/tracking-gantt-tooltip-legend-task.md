---
title: BACK-495.3 跟踪甘特图 Tooltip、图例与交互增强
source_path: backlog/tasks/back-495.3 - Add-tooltip-legend-and-interaction-enhancements-for-tracking-Gantt.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, feature, web-ui, gantt, frontend, ux]
---

# BACK-495.3 跟踪甘特图 Tooltip、图例与交互增强

增强跟踪甘特图的交互体验：悬停 Tooltip 展示计划与实际时间、点击高亮包含计划层、工具栏图例说明视觉元素。

## Tooltip 增强

悬停任务条时展示：
- 任务 ID 与标题
- 计划时间范围（plannedStart → plannedEnd）
- 实际时间范围（actualStart → actualEnd，带 fallback 指示器）
- 状态、优先级等元数据

## 点击高亮

- 点击任务条后，上下游任务 + 依赖箭头高亮，其他淡化至 30%
- 计划边框层一同参与高亮/淡化（通过共享 opacity state）

## 图例

工具栏新增图例说明：
- 状态色条 = 实际任务时间（按状态分组）
- 斜线框 = 计划时间范围
- 箭头 = 任务依赖关系
- 琥珀色 `*` = Fallback/估计时间（无 actualEnd 时使用）

## 其他交互调整

- 排序图标移至表头标签右侧并垂直居中
- 中日英表头标签使用双行布局（如 Planned\nStart、Actual\nStart）
- 默认排序改为 ID 降序；默认视图改为日视图
- 加载时自动选中第一个任务；切换视图时自动滚动时间线到选中任务
- 选中任务背景色从 `bg-blue-50` 加深为 `bg-blue-100`

## Related Sources

- [[sources/tracking-gantt-view-task]] — BACK-495 父任务
- [[sources/tracking-gantt-dual-layer-task]] — BACK-495.2 双层渲染

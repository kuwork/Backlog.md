---
title: BACK-516 修复甘特图拖拽交互改为滚动而非修改视图范围
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, bug, web-ui, gantt]
source_path: backlog/tasks/back-516 - Fix-Gantt-chart-drag-interaction-to-use-scroll-instead-of-modifying-view-range.md
---

# BACK-516 修复甘特图拖拽交互改为滚动而非修改视图范围

修复甘特图拖拽行为，使拖拽操作平移视口而非改变日期比例尺。

## 问题

在甘特图时间线区域按住并拖拽时，`viewStart`/`viewEnd` 状态会在每一帧拖拽时直接被修改。这会重新计算整个 `columns` 数组，改变 `timelineWidth`，并导致超出当前最右日期限制的任务/结束日期被挤压到右边缘。当时间线范围缩小到早于今天时，红色"今天"标记也会被推到右边缘。

## 解决方案

将视图范围突变替换为对时间线容器的直接 `scrollLeft`/`scrollTop` 操作：
- 在 `handleMouseDown` 中记录初始滚动位置
- 在 `handleMouseMove` 中计算增量并设置 `container.scrollLeft` / `container.scrollTop`
- 从拖拽处理器中移除 `viewStartAtDrag` ref 和 `setViewStart`/`setViewEnd` 调用
- 添加 `dragStartY` 和 `scrollTopAtDrag` refs 以实现垂直同步

## 结果

- 水平拖拽平移时间线视口，不改变日期比例尺范围
- 垂直拖拽平移并与左侧任务列表同步
- 任务和今天线不再被挤压到右边缘
- 拖拽感觉像在移动滚动条滑块

## 相关概念
- [[concepts/gantt-view]] — 甘特图可视化与交互设计
- [[concepts/web-ui-features]] — Web UI 视图

## 相关来源
- [[sources/tracking-gantt-view-task]] — BACK-495 跟踪甘特图
- [[sources/smart-gantt-view-task]] — BACK-491 智能甘特图视图

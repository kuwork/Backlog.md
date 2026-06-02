---
title: BACK-495 跟踪甘特图（计划 vs 实际对比）
source_path: backlog/tasks/back-495 - Implement-tracking-Gantt-view-with-plan-vs-actual-comparison.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, feature, web-ui, gantt, visualization, tracking]
---

# BACK-495 跟踪甘特图（计划 vs 实际对比）

在 Web UI 中新增**跟踪甘特图**视图，在同一行上同时展示计划时间范围（斜线边框）和实际任务进度（实心色条），实现视觉偏差追踪。

## 背景

Backlog.md 任务数据存在三种时间状态：
1. **新建任务** — 仅有 `createdDate`
2. **已规划/执行中** — 有 `plannedStart`/`plannedEnd`，可能有 `actualStart`/`actualEnd`
3. **已完成** — 同时具备计划时间和实际时间

BACK-491 基础甘特图将所有任务按解析后的有效时间绘制为单色条，无法区分计划与实际。跟踪甘特图引入双层渲染解决此问题。

## 架构概览

- 左侧表格时间列始终显示实际时间
- 甘特条采用**双层结构**：底层实际条（实心填充）+ 上层计划边框（斜线填充）
- 依赖箭头使用智能时间解析确定连接点
- Tooltip 同时展示计划与实际时间
- 图例解释所有视觉元素

## 子任务分解

- [[sources/tracking-gantt-left-table-task]] — BACK-495.1 左表 + 时间解析引擎
- [[sources/tracking-gantt-dual-layer-task]] — BACK-495.2 双层甘特条渲染
- [[sources/tracking-gantt-tooltip-legend-task]] — BACK-495.3 Tooltip、图例与交互增强
- [[sources/tracking-gantt-arrow-resolution-task]] — BACK-495.4 智能依赖箭头时间解析

## Related Concepts

- [[concepts/gantt-view]] — 甘特图视图概念与技术实现
- [[concepts/date-fields]] — 日期字段语义

## Related Sources

- [[sources/smart-gantt-view-task]] — BACK-491 基础甘特图实现
- [[sources/tracking-gantt-design-doc]] — doc-6 跟踪甘特图设计方案

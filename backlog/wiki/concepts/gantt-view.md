---
title: Gantt 甘特图视图
labels: [concept, web-ui, gantt, visualization]
created_date: 2026-05-28 00:50
updated_date: 2026-05-28 00:50
---

# Gantt 甘特图视图

Backlog.md Web UI 中的时间线可视化视图，纯 React/CSS 实现，基于现有任务日期字段与依赖关系，无需新增数据结构。

## 页面结构

### 左侧：五列固定表格
- 任务 ID
- 任务标题
- 开始时间（解析后的有效开始时间）
- 结束时间（解析后的有效结束时间）
- 操作（详情按钮，点击打开 `TaskDetailsModal`）

表头前四列支持点击排序，交互与"所有任务"页一致：双箭头图标（↑/↓），三态等宽外框避免抖动。

### 右侧：动态甘特时间线
- 顶部粒度切换器（日 / 周 / 月 / 季度 / 年）
- 动态比例时间轴
- 任务时间条渲染（基于解析后的起止时间）
- 任务依赖箭头叠加（SVG 绝对定位覆盖层）

## 时间解析引擎

### 开始时间优先级
1. `plannedStart` → 优先使用
2. `createdDate` 日期部分 → 回退

### 结束时间优先级
1. `plannedEnd` → 优先使用
2. `updatedDate` 日期部分 → 回退
3. 仅有 `createdDate` → 启用最小宽度回退

## 最小宽度回退策略

防止单日期任务在任何视图中渲染为 0 宽度：

| 视图 | 回退策略 |
|---|---|
| 日视图 | 最小 4 小时视觉宽度，同天多任务水平错位 |
| 周视图 | 最小 1 天 |
| 月视图 | 最小 1 天 |
| 季度/年视图 | 固定 8px 视觉宽度 |

## 依赖可视化

- 读取任务 `dependencies` 字段（前驱任务 ID 列表）
- SVG 立方贝塞尔曲线：水平引入 + 曲线 + 箭头
- 多依赖自动错位防止缠绕
- 箭头自适应时间粒度缩放
- 点击任务条高亮上下游链，其他元素淡化至 30%

## 技术特点

- 零外部库依赖（无 DHTMLX Gantt、no Frappe Gantt 等）
- 时间线拖拽平移通过鼠标事件计算 `deltaDays` 推导 `viewStart/viewEnd`
- 左右面板滚动事件双向同步
- 全量 `dark:` 变体支持暗黑模式
- 回退任务在列表中以 `*` 标记，Tooltip 标注 fallback

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/date-fields]] — 日期字段语义
- [[concepts/task-lifecycle]] — 任务生命周期与依赖关系

## Related Sources

- [[sources/smart-gantt-view-task]] — BACK-491 实现任务

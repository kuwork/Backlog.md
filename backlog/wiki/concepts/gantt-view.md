---
title: Gantt 甘特图视图
created_date: 2026-05-28 00:50
updated_date: 2026-05-29 22:36
labels:
  - concept
  - web-ui
  - gantt
  - visualization
---

# Gantt 甘特图视图

Backlog.md Web UI 中的时间线可视化视图，纯 React/CSS 实现，基于任务日期字段与依赖关系。

## 页面结构

### 左侧：固定表格

- 任务 ID
- 任务标题
- 开始时间 / 结束时间（实际时间，可切换显示计划列）
- 操作（详情按钮，点击打开 `TaskDetailsModal`）

表头支持点击排序，双箭头图标（↑/↓），三态等宽外框避免抖动。

### 右侧：动态甘特时间线

- 顶部粒度切换器（日 / 周 / 月 / 季度 / 年）
- 动态比例时间轴
- 任务时间条渲染
- 任务依赖箭头叠加（SVG 绝对定位覆盖层）

## 两种模式

### 基础甘特图（BACK-491）

所有任务按解析后的有效时间绘制为**单色条**，使用 `plannedStart` / `plannedEnd` 优先，fallback 到 `createdDate` / `updatedDate`。

### 跟踪甘特图（BACK-495）

在同一行上同时展示**计划**与**实际**时间范围，实现视觉偏差追踪。

#### 双层渲染结构

- **底层实际条**：状态色实心填充（In Progress=蓝，Done=绿，To Do=灰，Blocked=红，Cancelled=浅灰）
- **上层计划边框**：60° 斜线填充（`repeating-linear-gradient`），两层边框（2px 阴影层 + 1px 最终线）
- 两者根据各自时间坐标**独立定位**，z 轴叠加

#### 偏差场景视觉表现

| 偏差场景 | 条件 | 视觉结果 |
|---|---|---|
| 早开始 | actualStart < plannedStart | 实际条从计划框左侧提前开始；左侧溢出为纯色 |
| 正常 | actualStart = plannedStart，actualEnd ≤ plannedEnd | 实际条在框内延伸；重叠区颜色+斜线，未到达尾部纯斜线 |
| 延期 | actualEnd > plannedEnd | 实际条超出计划框右侧；右侧溢出为纯色 |

#### 时间解析优先级（跟踪模式）

**实际条坐标**：
1. `actualStart` → `actualEnd`
2. 缺失 → `createdDate` / `updatedDate`
3. 仍缺失 → `createdDate` + 最小宽度回退

**计划边框坐标**：
1. `plannedStart` → `plannedEnd`
2. 缺失 → 不绘制计划边框层

#### 智能依赖箭头

箭头连接点基于「识别的有效时间」选择：
- **开始端**（后继开始）：若 resolvedStart < plannedStart，使用 resolvedStart，否则使用 plannedStart
- **结束端**（前驱结束）：若 resolvedEnd < plannedStart，使用 plannedEnd，否则使用 resolvedEnd
- 箭头颜色统一 gray-500，避免与状态色冲突

#### 交互增强

- **悬停 Tooltip**：展示计划时间范围、实际时间范围、fallback 指示器
- **点击高亮**：上下游 + 依赖箭头高亮，计划边框层一同参与淡化
- **图例**：状态色条（按状态分组）、斜线框=计划、箭头=依赖、琥珀色 `*`=估计时间
- 默认排序 ID 降序；默认视图日视图；加载自动选中首个任务

## 最小宽度回退策略

防止单日期任务在任何视图中渲染为 0 宽度：

| 视图 | 回退策略 |
|---|---|
| 日视图 | 最小 4 小时视觉宽度，同天多任务水平错位 |
| 周视图 | 最小 1 天 |
| 月视图 | 最小 1 天 |
| 季度/年视图 | 固定 8px 视觉宽度 |

## 技术特点

- 零外部库依赖
- 时间线拖拽平移通过鼠标事件计算 `deltaDays` 推导 `viewStart/viewEnd`
- 左右面板滚动事件双向同步
- 全量 `dark:` 变体支持暗黑模式
- 回退任务在列表中以 `*` 标记
- 子任务按 ID 归组到父任务下方（BACK-496）
- 时区一致：所有存储的 UTC 字符串统一通过 `parseStoredUtcDate` 解析为本地时间（BACK-497）

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/date-fields]] — 日期字段语义与存储格式
- [[concepts/task-lifecycle]] — 任务生命周期与依赖关系

## Related Sources

- [[sources/smart-gantt-view-task]] — BACK-491 基础甘特图实现
- [[sources/tracking-gantt-view-task]] — BACK-495 跟踪甘特图父任务
- [[sources/tracking-gantt-left-table-task]] — BACK-495.1 左表与时间解析
- [[sources/tracking-gantt-dual-layer-task]] — BACK-495.2 双层渲染
- [[sources/tracking-gantt-tooltip-legend-task]] — BACK-495.3 Tooltip 与图例
- [[sources/tracking-gantt-arrow-resolution-task]] — BACK-495.4 智能依赖箭头
- [[sources/tracking-gantt-design-doc]] — doc-6 设计方案

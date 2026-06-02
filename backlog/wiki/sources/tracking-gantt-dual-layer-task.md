---
title: BACK-495.2 双层甘特条渲染（实际条 + 计划边框）
source_path: backlog/tasks/back-495.2 - Implement-dual-layer-Gantt-bar-rendering-actual-plan-border.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, feature, web-ui, gantt, frontend, css]
---

# BACK-495.2 双层甘特条渲染（实际条 + 计划边框）

实现跟踪甘特图的核心双层渲染：底层为实际时间条（状态色实心填充），上层为计划边框（60° 斜线填充）。

## 底层：实际任务条

- 时间坐标基于 `actualStart` → `actualEnd`（或 fallback 创建/更新时间）
- 实心矩形，颜色随状态变化
  - In Progress → blue-500
  - Done / Completed → emerald-500
  - To Do → gray-400 / dark:gray-500
  - Blocked → red-500
  - Cancelled → gray-300 / dark:gray-600
- 圆角 `rounded-md`，高度占行高 60%–70%，垂直居中

## 上层：计划边框

- 时间坐标基于 `plannedStart` → `plannedEnd`
- 无计划时间则不绘制
- 两层重叠边框在同一坐标上叠加：
  - **粗边框（2px）** — 制造厚度阴影感；亮色模式白色，暗色模式灰色
  - **细边框（1px）** — 最终可见计划线；亮色模式灰色，暗色模式白色
- 内部填充：`-60deg` `repeating-linear-gradient`，间距 6px

## Z 轴叠加效果

| 偏差场景 | 条件 | 视觉表现 |
|---|---|---|
| 早开始 | actualStart < plannedStart | 实际条从计划框左侧提前开始；左侧溢出为纯色 |
| 正常 | actualStart = plannedStart，actualEnd ≤ plannedEnd | 实际条在框内延伸；重叠区为颜色+斜线，未到达尾部为纯斜线 |
| 延期 | actualEnd > plannedEnd | 实际条超出计划框右侧；右侧溢出为纯色 |

## 实现细节

- `planPositions` useMemo 独立计算计划边框坐标
- 计划边框层设置 `pointer-events-none`，点击事件穿透到实际条
- 非 fallback 任务使用真实 duration + 4px 最小可见宽度
- 状态图例动态渲染当前任务中所有唯一状态（保留原始大小写）

## Related Sources

- [[sources/tracking-gantt-view-task]] — BACK-495 父任务
- [[sources/tracking-gantt-left-table-task]] — BACK-495.1 左表与时间解析

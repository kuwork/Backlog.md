---
title: BACK-495.4 跟踪甘特图智能依赖箭头时间解析
source_path: backlog/tasks/back-495.4 - Implement-smart-dependency-arrow-time-resolution-for-tracking-Gantt.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, feature, web-ui, gantt, frontend]
---

# BACK-495.4 跟踪甘特图智能依赖箭头时间解析

更新依赖箭头渲染，使用智能时间解析确定连接点，兼顾实际时间与计划时间的偏差。

## 智能时间解析（箭头专用）

**识别开始时间**：
1. actualStart 存在 → 使用 actualStart
2. 否则 createdDate 存在 → 使用 createdDate 日期部分
3. 否则 → 无有效开始时间

**识别结束时间**：
1. actualEnd 存在 → 使用 actualEnd
2. 否则 updatedDate 存在 → 使用 updatedDate 日期部分
3. 否则 createdDate 存在 → 使用 createdDate + 1d
4. 否则 → 无有效结束时间

## 连接点选择逻辑

**开始端（箭头尾部，连接前驱结束）**：
```
resolvedEnd = 识别结束时间
if (resolvedEnd < plannedStart) {
  使用 plannedEnd 作为连接点
} else {
  使用 resolvedEnd 作为连接点
}
```

**结束端（箭头头部，连接后继开始）**：
```
resolvedStart = 识别开始时间
if (resolvedStart < plannedStart) {
  使用 resolvedStart 作为连接点
} else {
  使用 plannedStart 作为连接点
}
```

## 视觉调整

- 箭头颜色统一使用 `gray-500`，避免与状态色实际条冲突
- SVG cubic-bezier 曲线、水平引入 + 曲线 + 箭头样式保持不变
- 多依赖自动错位防止缠绕逻辑保持不变

## Related Sources

- [[sources/tracking-gantt-view-task]] — BACK-495 父任务
- [[sources/tracking-gantt-dual-layer-task]] — BACK-495.2 双层渲染

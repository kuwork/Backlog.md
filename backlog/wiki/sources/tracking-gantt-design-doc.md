---
title: doc-6 跟踪甘特图设计方案
source_path: backlog/docs/doc-6 - 跟踪甘特图设计方案.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, design, gantt, visualization, web-ui]
---

# doc-6 跟踪甘特图设计方案

Backlog.md Web UI 跟踪甘特图的完整设计方案文档，涵盖双层渲染、智能依赖箭头、交互设计与时间解析策略。

## 左侧表格时间列

「开始时间」「结束时间」两列统一展示实际时间，按以下优先级 fallback：
1. `actualStart` / `actualEnd`
2. `createdDate` / `updatedDate`
3. `createdDate` / `createdDate` + 1d

## 甘特条双层结构

- **底层实际条**：状态色实心填充，基于 actualStart→actualEnd（或 fallback）
- **上层计划边框**：60° 斜线填充，基于 plannedStart→plannedEnd，两层边框（2px 阴影层 + 1px 最终线）

## 偏差场景视觉表现

| 场景 | 条件 | 视觉 |
|---|---|---|
| 早开始 | actualStart < plannedStart | 实际条从计划框左侧溢出 |
| 正常 | actualStart = plannedStart，actualEnd ≤ plannedEnd | 实际条在框内延伸 |
| 延期 | actualEnd > plannedEnd | 实际条从计划框右侧溢出 |

## 依赖箭头智能时间解析

箭头连接点基于「识别的有效时间」选择：
- 开始端：若 resolvedStart < plannedStart，使用 resolvedStart，否则使用 plannedStart
- 结束端：若 resolvedEnd < plannedStart，使用 plannedEnd，否则使用 resolvedEnd

## 交互设计

- **悬停 Tooltip**：展示计划/实际时间范围与偏差分析
- **点击高亮**：上下游 + 依赖箭头高亮，计划边框层一同参与
- **图例**：说明实心条=实际、斜线框=计划、箭头=依赖、黄色`*`=估计时间

## Out of Scope

1. 拖拽调整计划/实际时间
2. 关键路径计算与红色高亮
3. 基线对比（多版本计划）
4. 资源负载视图
5. 导出 PNG/PDF

## Related Concepts

- [[concepts/gantt-view]] — 甘特图概念与技术实现
- [[concepts/date-fields]] — 日期字段语义

## Related Sources

- [[sources/smart-gantt-view-task]] — BACK-491 基础甘特图
- [[sources/tracking-gantt-view-task]] — BACK-495 跟踪甘特图实现

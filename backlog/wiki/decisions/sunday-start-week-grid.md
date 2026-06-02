---
title: 热力图网格采用周日开始而非周一开始
labels: [decision, ui, heatmap, calendar]
created_date: 2026-05-31 01:11
updated_date: 2026-05-31 01:11
---

# 热力图网格采用周日开始而非周一开始

## Context

BACK-503 最初需求文档指定网格布局为 "7 rows (Mon-Sun)"，左侧 weekday 标签为 Mon/Wed/Fri。

## Decision

改为周日开始（Sun-Sat），与 GitHub 贡献图保持一致。

## Rationale

- **用户心智模型**: GitHub 是全球开发者最熟悉的贡献图，其周日开始布局已成为事实标准。
- **一致性**: 项目参考风格明确指向 GitHub，偏离其布局会降低可识别性。
- **标签调整**: weekday 标签从 Mon/Wed/Fri 调整为 Sun/Tue/Thu，保持隔行显示以节省空间。

## Implementation Detail

- 日期网格生成逻辑以 `getDay() === 0`（周日）为第一列。
- 第一周的 padding 计算基于周日前置空位。
- 月份标签位置基于每周的周日日期计算。

## Related
- [[sources/task-completion-heatmap-task]] — BACK-503 实现任务

---
title: BACK-489 项目健康指标重构（临期 / 逾期 / 停滞）
labels: [source, feature, web-ui, statistics, health]
source_path: backlog/tasks/back-489 - Refactor-project-health-indicators-to-support-at-risk-overdue-and-stale-categories-with-dueDate-awareness.md
created_date: 2026-05-26 23:42
updated_date: 2026-05-26 23:42
---

# BACK-489 项目健康指标重构（临期 / 逾期 / 停滞）

**状态**: Done | **标签**: web-ui | **负责人**: @kimi | **依赖**: BACK-401

## 目标

在 BACK-401 引入 `dueDate` 后，将原有的单一「Stale Tasks >30 days」健康指标重构为三种独立的风险分类，避免有截止日期的任务被错误归类为停滞。

## 三种健康分类

| 分类 | 英文名 | 判定条件 | 颜色 |
|---|---|---|---|
| **临期** | At Risk | 非 Done 任务，有 `dueDate`，今天或明天截止 (`diffDays <= 1`) | 🟡 琥珀色 |
| **逾期** | Overdue | 非 Done 任务，有 `dueDate`，已过截止日期 (`diffDays < 0`) | 🔴 红色 |
| **停滞** | Stale | 非 Done 任务，**无** `dueDate`，超过 30 天未更新 | 🔵 蓝色 |
| **阻塞** | Blocked | 依赖未完成的任务（保持不变） | 🔴 红色 |

**关键规则**：有 `dueDate` 的任务**不再**计入 `staleTasks`，杜绝双重分类。

## 变更摘要

| 文件 | 变更 |
|---|---|
| `src/core/statistics.ts` | 新增 `atRiskTasks`、`overdueTasks`；收窄 `staleTasks` 为无 `dueDate` 的任务 |
| `src/web/components/Statistics.tsx` | 统计页头部显示三色计数圆点；健康详情区展示四类任务列表；临期/逾期卡片显示 `dueDate` 而非更新日期 |
| `src/web/components/TaskCard.tsx` | 新增 `dueDateRiskClass` 逻辑（临期/逾期左侧边条），实际渲染被优先级边条 `border-l-4` 覆盖，当前版本无可见效果 |
| `src/web/locales/{en,ja,zh-CN,zh-TW}.ts` | 新增 `atRiskCount`、`overdueCount`、`atRiskTooltip`、`overdueTooltip` 等 i18n 键 |
| `src/test/statistics.test.ts` | 4 个新测试用例：临期、逾期、停滞排除、Done 任务排除 |

## 设计细节

- **颜色 token**：Tailwind `text-amber-500` / `border-l-amber-500`（临期）、`text-red-600` / `border-l-red-500`（逾期）、`text-slate-400`（停滞）。
- **Tooltip 单语言**：悬停提示严格单语言显示，不混排（如中文 tooltip 不含英文）。
- **看板卡片视觉标识**：代码层面新增 `dueDateRiskClass`，但因与优先级边条（`border-l-4`）的 CSS 层叠冲突，当前版本无可见效果；健康度信息集中展示在统计页面。

## Related Concepts
- [[concepts/project-health]] — 项目健康度指标的详细语义与计算逻辑
- [[concepts/date-fields]] — dueDate / plannedStart / plannedEnd 字段说明
- [[concepts/web-ui-features]] — Web UI 统计页面与看板卡片样式

## Related Sources
- [[sources/due-date-fields-task]] — BACK-401 日期字段基础实现

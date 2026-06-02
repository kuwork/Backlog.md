---
title: Web UI 日期自动填充规则（dueDate → plannedStart / plannedEnd）
labels: [decision, web-ui, ux, dates]
created_date: 2026-05-25 23:45
updated_date: 2026-05-25 23:45
---

# Web UI 日期自动填充规则（dueDate → plannedStart / plannedEnd）

## 决策

当用户在 Web UI 中设置或更新 `dueDate` 且 `plannedStart` 为空时，自动填充：
- `plannedStart = 当前日历日期`
- `plannedEnd = dueDate`

用户可在保存前覆盖这些自动填充值。

## 上下文

BACK-401 引入三个独立日期字段，但要求用户每次手动填写三个输入框会增加 friction。社区 Fork（andrewlongman07）的甘特图实现也证明「计划时间窗口」是高频需求。

## 权衡

| 方案 | 优点 | 缺点 |
|---|---|---|
| **自动填充（选定）** | 降低填写负担；提供合理的默认规划窗口；用户仍可覆盖 | 可能产生不符合用户预期的默认值 |
| 全部留空 | 完全由用户控制 | 三个字段均需手动输入，friction 高 |
| 强制联动 | 始终保持 plannedStart ≤ plannedEnd = dueDate | 过度限制；用户可能需要 plannedEnd 早于 dueDate（预留缓冲） |

## 实施

- 触发时机：`dueDate` input 的 `onChange`，检测 `plannedStart` 是否为空。
- 仅自动填充空字段，不会覆盖用户已填值。
- 填充后用户可立即修改，保存时提交用户最终值。

## Related Concepts
- [[concepts/date-fields]] — 日期字段语义
- [[concepts/web-ui-features]] — Web UI 任务编辑与日期指示器

## Related Sources
- [[sources/due-date-fields-task]] — BACK-401 需求与实现

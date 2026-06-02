---
title: 日期字段采用 Date-only 存储（YYYY-MM-DD）
labels: [decision, dates, storage]
created_date: 2026-05-25 23:45
updated_date: 2026-05-25 23:45
---

# 日期字段采用 Date-only 存储（YYYY-MM-DD）

## 决策

`dueDate`、`plannedStart`、`plannedEnd` 以 **date-only**（`YYYY-MM-DD`）格式存储，而非 date-time（`YYYY-MM-DD HH:MM`）。

## 上下文

- `createdDate` 使用 date-time（UTC），因为它记录的是精确的发生时刻。
- 新日期字段代表「日历日」概念（deadline、计划起止），用户通常按天而非按分钟思考。

## 权衡

| 方案 | 优点 | 缺点 |
|---|---|---|
| **Date-only（选定）** | 与用户心智模型一致；frontmatter 更简洁；无 UTC/时区歧义 | 无法表达「截止到今天下午 5 点」 |
| Date-time | 精确 | 对项目管理过度设计；引入时区复杂性；与 `normalizeDate` 现有行为需额外协调 |

## 实施

- 复用现有 `normalizeDate` 基础设施（它对午夜 UTC 值返回 `YYYY-MM-DD`，非午夜返回 `YYYY-MM-DD HH:MM`）。
- 写路径显式确保三个字段不带时间组件。
- 解析路径通过 `normalizeDate` 统一处理，兼容用户手写的 date-only 输入。

## Related Concepts
- [[concepts/date-fields]] — 日期字段语义与使用场景

## Related Sources
- [[sources/due-date-fields-task]] — BACK-401 实现详情

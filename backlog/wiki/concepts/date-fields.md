---
title: 日期字段（dueDate / plannedStart / plannedEnd）
labels: [concept, dates, task, milestone]
created_date: 2026-05-25 23:45
updated_date: 2026-05-25 23:45
---

# 日期字段（dueDate / plannedStart / plannedEnd）

Backlog.md 为任务和里程碑提供的三个可选日期字段，用于在时间维度上管理项目。

## 字段语义

| 字段 | 含义 | 刚性/柔性 | 典型用途 |
|---|---|---|---|
| `dueDate` | 截止日期 | 刚性 | 任务必须完成的最后日期 |
| `plannedStart` | 计划开始日期 | 柔性 | 计划何时开始工作 |
| `plannedEnd` | 计划结束日期 | 柔性 | 计划何时完成工作 |

三者相互独立，可同时存在。例如：`plannedStart=2026-06-01`，`plannedEnd=2026-06-15`，`dueDate=2026-06-20`。

## 存储格式

- **Date-only**：`YYYY-MM-DD`，代表日历日而非精确时刻。
- 与 `createdDate`（`YYYY-MM-DD HH:MM` UTC date-time）区分。
- Frontmatter 键名为 snake_case：`due_date`、`planned_start`、`planned_end`。
- 写路径通过 `normalizeDate` 确保不附带时间组件。

## CLI 使用

```bash
# 创建任务时指定日期
backlog task add "完成 API 文档" --due-date 2026-06-01 --planned-start 2026-05-25 --planned-end 2026-05-30

# 编辑任务日期
backlog task edit back-10 --due-date 2026-06-15
backlog task edit back-10 --clear-due-date --clear-planned-start

# 里程碑编辑
backlog milestone edit M1 --due-date 2026-06-01 --description "第一阶段截止"
```

## Web UI 行为

- **Task 详情弹窗**：侧边栏提供三个 `<input type="date">` 字段。
- **自动填充规则**：当用户设置 `dueDate` 且 `plannedStart` 为空时，自动填充 `plannedStart = 今天`、`plannedEnd = dueDate`。用户可在保存前覆盖。
- **TaskCard 指示器**：
  - 头部：日历图标 + `plannedStart~plannedEnd`（当年份与当前年一致时省略年份）
  - 脚部：时钟图标 + `dueDate`（紧邻相对创建时间）
  - 逾期且任务非终端状态（Done/Cancelled）时，`dueDate` 标红（`text-red-600 dark:text-red-400 font-semibold`）
- **Milestone 卡片**：显示日期（如有）。

## MCP 支持

- `task_create` / `task_edit` JSON Schema 包含三个字段（严格名，无别名）。
- `milestone_edit`（原 `milestone_rename`）支持更新标题、描述和日期；传空字符串清空字段。

## 与甘特图的关系

当前日期字段是数据层基础工作。甘特时间线视图（Gantt view）为后续独立任务，将基于 `plannedStart` / `plannedEnd` 进行纯 React/CSS 渲染。

## Related Concepts
- [[concepts/task-lifecycle]] — 任务 frontmatter 完整字段说明
- [[concepts/web-ui-features]] — Web UI 日期指示器与自动填充细节
- [[concepts/cli-entry]] — CLI 日期选项与 `milestone edit`

## Related Sources
- [[sources/due-date-fields-task]] — BACK-401 实现详情与跨层变更

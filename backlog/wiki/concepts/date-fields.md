---
title: 日期字段（dueDate / plannedStart / plannedEnd / actualStart / actualEnd）
labels: [concept, dates, task, milestone]
created_date: 2026-05-25 23:45
updated_date: 2026-05-29 22:36
---

# 日期字段（dueDate / plannedStart / plannedEnd / actualStart / actualEnd）

Backlog.md 为任务和里程碑提供的可选日期字段，用于在时间维度上管理项目。分为两组存储格式。

## 字段语义

### 计划与截止字段（Date-only）

| 字段 | 含义 | 刚性/柔性 | 典型用途 |
|---|---|---|---|
| `dueDate` | 截止日期 | 刚性 | 任务必须完成的最后日期 |
| `plannedStart` | 计划开始日期 | 柔性 | 计划何时开始工作 |
| `plannedEnd` | 计划结束日期 | 柔性 | 计划何时完成工作 |

三者相互独立，可同时存在。存储格式为 **Date-only**：`YYYY-MM-DD`，代表日历日而非精确时刻。

### 实际追踪字段（Date-time）

| 字段 | 含义 | 存储格式 | 自动填充 |
|---|---|---|---|
| `actualStart` | 实际开始时间 | `YYYY-MM-DD HH:MM` UTC | 状态变更为进行中时自动设置 |
| `actualEnd` | 实际结束时间 | `YYYY-MM-DD HH:MM` UTC | 状态变更为终态时自动设置 |

提供分钟级精度，与 `createdDate` 格式一致。用户可手动覆盖自动填充值。

## 存储格式对比

| 字段组 | 格式 | Frontmatter 键名 | 输入控件 |
|---|---|---|---|
| dueDate / plannedStart / plannedEnd | Date-only `YYYY-MM-DD` | `due_date` / `planned_start` / `planned_end` | `<input type="date">` |
| actualStart / actualEnd | Date-time `YYYY-MM-DD HH:MM` UTC | `actual_start` / `actual_end` | `<input type="datetime-local">` |

## 自动填充规则

### 任务级（BACK-492 / BACK-498）

- 状态变更为进行中且 `actualStart` 为空 → 设为当前日期时间
- 状态变更为终态/Done 且 `actualEnd` 为空 → 设为当前日期时间
- 创建时直接指定 `--status Done` / `--status 'In Progress'` 也会触发填充（BACK-498）
- 仅字段为空时填充，尊重手动覆盖

### 里程碑级（BACK-493）

- 里程碑下任一任务变更为进行中且 `actualStart` 为空 → 设为当前日期时间
- 里程碑下最后一个非终态任务变更为终态且 `actualEnd` 为空 → 设为当前日期时间

## CLI 使用

```bash
# 计划字段
task add "完成 API 文档" --due-date 2026-06-01 --planned-start 2026-05-25 --planned-end 2026-05-30
task edit back-10 --clear-due-date --clear-planned-start
milestone edit M1 --due-date 2026-06-01

# 实际字段
task add "紧急修复" --status "In Progress" --actual-start "2026-05-29 10:00"
task edit back-10 --actual-end "2026-05-30 18:00" --clear-actual-start
milestone edit M1 --actual-start "2026-05-25 09:00"
```

## Web UI 行为

- **Task 详情弹窗**：`dueDate`/`plannedStart`/`plannedEnd` 使用 `date` 输入；`actualStart`/`actualEnd` 使用 `datetime-local` 输入
- **自动填充规则**：设置 `dueDate` 且 `plannedStart` 为空时，自动填充 `plannedStart = 今天`、`plannedEnd = dueDate`
- **TaskCard 指示器**：头部日历图标 + `plannedStart~plannedEnd`；脚部时钟图标 + `dueDate`；逾期标红
- **时区一致性**：`datetime-local` 输入通过 `storedUtcToDateTimeLocal` / `dateTimeLocalToStoredUtc` 正确转换 UTC 存储与本地显示（BACK-497）

## MCP 支持

- `task_create` / `task_edit` JSON Schema 包含全部 5 个日期字段
- `milestone_edit` 支持 `actualStart` / `actualEnd`

## 与甘特图的关系

- **基础甘特图**（BACK-491）：使用 `plannedStart` / `plannedEnd` 绘制单色条
- **跟踪甘特图**（BACK-495）：双层渲染，底层 `actualStart`→`actualEnd` 实心条，上层 `plannedStart`→`plannedEnd` 斜线边框

## Related Concepts
- [[concepts/task-lifecycle]] — 任务 frontmatter 完整字段说明
- [[concepts/web-ui-features]] — Web UI 日期指示器与自动填充细节
- [[concepts/cli-entry]] — CLI 日期选项与 `milestone edit`
- [[concepts/gantt-view]] — 甘特图时间解析与可视化

## Related Sources
- [[sources/due-date-fields-task]] — BACK-401 计划日期字段实现
- [[sources/actual-start-end-fields-task]] — BACK-492 actual 字段实现
- [[sources/milestone-actual-dates-task]] — BACK-493 里程碑 actual 字段
- [[sources/actual-dates-auto-create-task]] — BACK-498 创建时自动填充
- [[sources/timezone-handling-fix]] — BACK-497 时区一致性修复
- [[sources/back-506-cli-utc-conversion-fix]] — BACK-506 CLI UTC 转换修复

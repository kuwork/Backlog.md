---
title: BACK-401 日期字段支持（dueDate / plannedStart / plannedEnd）
labels: [source, feature, dates, cli, web-ui, mcp]
source_path: backlog/tasks/back-401 - Add-dueDate-plannedStart-and-plannedEnd-support-for-tasks-and-milestones-across-CLI-TUI-Web-and-MCP.md
created_date: 2026-05-25 23:45
updated_date: 2026-05-25 23:45
---

# BACK-401 日期字段支持（dueDate / plannedStart / plannedEnd）

**状态**: Done | **标签**: feature, dates, cli, web-ui, mcp | **负责人**: @codex

## 目标

为任务和里程碑引入三个可选日期字段，并在 CLI、TUI、Web UI、MCP 所有用户界面保持一致暴露：

- **`dueDate`** — 截止日期（刚性，单时间点）
- **`plannedStart`** — 计划开始日期（柔性）
- **`plannedEnd`** — 计划结束日期（柔性）

三者相互独立，可同时存在于同一任务或里程碑。

## 存储语义

- `createdDate` 为 **date-time**（`YYYY-MM-DD HH:MM`，UTC），记录精确时刻。
- `dueDate` / `plannedStart` / `plannedEnd` 为 **date-only**（`YYYY-MM-DD`），代表日历日而非精确时刻。
- 复用现有 `normalizeDate` 基础设施，写路径确保不带时间组件。

## 跨层变更摘要

| 层级 | 变更 |
|---|---|
| **类型** | `Task`、`TaskCreateInput`、`TaskUpdateInput`、`Milestone` 新增三个可选字段 |
| **Markdown** | `parseTask`/`parseMilestone` 读取 `due_date`/`planned_start`/`planned_end`；`serializeTask` 写入；新增 `serializeMilestone` 保留 `rawContent` |
| **文件系统** | `createMilestone` / `updateMilestone` 支持日期与描述持久化 |
| **Core** | `createTaskFromInput`、`applyTaskUpdateInput` 传递日期；`updateMilestone` 支持标题/描述/日期更新 |
| **CLI** | `task create`/`edit` 新增 `--due-date`/`--planned-start`/`--planned-end`/`--clear-*`；`milestone edit` 新增（原 `milestone rename` 扩展）|
| **Web UI** | Task 详情侧边栏三个 `<input type="date">`；自动填充规则（设 dueDate 且 plannedStart 为空时自动填充 today / dueDate）；TaskCard 日期指示器；Milestone 卡片/编辑支持日期 |
| **MCP** | `task_create`/`task_edit` JSON Schema 加入字段；`milestone_rename` → `milestone_edit`，支持标题/描述/日期更新；空字符串清字段 |
| **i18n** | 4 种语言新增 `dates`、`dueDate`、`plannedStart`、`plannedEnd` 键 |
| **Agent 指南** | `agent-guidelines.md` 增加里程碑管理指令与日期字段 CLI 命令 |
| **测试** | Markdown 解析/序列化 round-trip 测试；MCP 里程碑测试（32 pass）|

## 关键设计决策

- **方法重命名**：`renameMilestone` → `updateMilestone`，因为方法现在即使标题未变也会更新日期字段；同步修复了「仅修改日期时短路返回 No changes made」的 bug。
- **任务里程碑重写优化**：标题未变时跳过 `updateTasks`，避免不必要的文件写入。
- **Web UI 自动填充**：降低用户填写负担，允许保存前覆盖。
- **日期指示器**：TaskCard 头部显示日历图标 + `plannedStart~plannedEnd`，脚部显示时钟图标 + `dueDate`；当年份与当前年一致时省略年份；逾期且非终端状态标红。

## 已知限制

- 甘特时间线视图（Gantt view）不在本任务范围内，属于后续独立任务。

## Related Concepts
- [[concepts/date-fields]] — 三个日期字段的详细语义与使用场景
- [[concepts/task-lifecycle]] — 任务 frontmatter 字段说明
- [[concepts/web-ui-features]] — Web UI 日期指示器与自动填充
- [[concepts/cli-entry]] — CLI 日期选项与 milestone edit 命令
- [[concepts/mcp-server]] — MCP milestone_edit 工具与日期字段 schema


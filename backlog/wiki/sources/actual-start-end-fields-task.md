---
title: BACK-492 actualStart 与 actualEnd 字段支持
source_path: backlog/tasks/back-492 - Add-actualStart-and-actualEnd-fields-for-tasks-with-auto-population-on-status-change.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, feature, dates, cli, web-ui, mcp]
---

# BACK-492 actualStart 与 actualEnd 字段支持

为任务引入可选的 `actualStart` 和 `actualEnd` 日期时间字段，用于追踪任务实际开始与完成时间。

## 自动填充规则

- 当任务状态变更为**进行中**（in-progress）时，若 `actualStart` 为空，自动设置为当前日期时间
- 当任务状态变更为**终态/Done**时，若 `actualEnd` 为空，自动设置为当前日期时间
- 用户可手动覆盖这些值

## 存储格式

`actualStart` / `actualEnd` 采用**日期时间**格式（`YYYY-MM-DD HH:MM`，UTC），与 `createdDate` 保持一致，提供分钟级精度。这与 `plannedStart`/`plannedEnd` 的 date-only 格式（`YYYY-MM-DD`）形成对比。

## 覆盖范围（12 层表面栈）

1. **类型层** — `Task`、`TaskCreateInput`、`TaskUpdateInput`、`TaskEditArgs`
2. **Markdown 层** — parser/serializer 读写 `actual_start`/`actual_end` frontmatter
3. **核心逻辑层** — `core/backlog.ts` 的 `updateTask` 中检测状态迁移并自动填充
4. **CLI 层** — `task create/edit` 增加 `--actual-start`、`--actual-end`、`--clear-actual-start`、`--clear-actual-end` 选项
5. **Server API 层** — create/update handler 透传字段
6. **MCP 层** — task schema 与 handler 支持
7. **Web UI 层** — `datetime-local` 输入框，UTC 存储 ↔ 本地显示转换
8. **i18n 层** — 4 个语言环境新增标签
9. **Formatter 层** — plain-text 输出显示
10. **Wizard 层** — `task-wizard.ts` 支持
11. **Agent Guidelines** — 示例 frontmatter 更新
12. **测试层** — markdown 测试、date-display 测试

## 关键设计决策

- `isInProgressStatus()` 使用大小写不敏感匹配 "inprogress"，支持本地化状态名
- 自动填充仅在字段为空时触发，尊重用户手动覆盖
- Web UI 使用 `datetime-local` 输入（actual 字段），而 `plannedStart`/`plannedEnd`/`dueDate` 仍使用 `date` 输入
- 引入 `storedUtcToDateTimeLocal` / `dateTimeLocalToStoredUtc` 工具函数确保时区一致性

## Related Concepts

- [[concepts/date-fields]] — 日期字段语义与存储格式对比（date-only vs datetime）
- [[concepts/task-lifecycle]] — 任务状态流转与自动填充触发条件
- [[concepts/cli-entry]] — CLI 命令选项体系

## Related Sources

- [[sources/due-date-fields-task]] — BACK-401 日期字段（plannedStart / plannedEnd / dueDate）
- [[sources/milestone-actual-dates-task]] — BACK-493 里程碑 actualStart / actualEnd 支持
- [[sources/actual-dates-auto-create-task]] — BACK-498 创建时自动填充 actual 字段

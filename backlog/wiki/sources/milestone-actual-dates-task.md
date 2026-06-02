---
title: BACK-493 里程碑 actualStart 与 actualEnd 支持
source_path: backlog/tasks/back-493 - Add-actualStart-and-actualEnd-support-for-milestones.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, feature, dates, milestones, cli, web-ui, mcp]
---

# BACK-493 里程碑 actualStart 与 actualEnd 支持

将 BACK-492 引入的 `actualStart` / `actualEnd` 字段扩展到**里程碑**，由里程碑下属任务的状态变化驱动自动填充。

## 自动填充规则

- 当里程碑下任一任务变更为进行中状态时，若里程碑 `actualStart` 为空，自动设为当前日期时间
- 当里程碑下**最后一个非终态任务**变更为终态/Done 时，若里程碑 `actualEnd` 为空，自动设为当前日期时间

## 覆盖范围

- `Milestone` 类型与 markdown parser/serializer
- `core/backlog.ts` — `updateTask` 中检测里程碑级触发条件并级联更新父里程碑
- CLI — 新增 `milestone create` 命令，`milestone edit` 增加 `--actual-start`、`--actual-end`、`--clear-actual-start`、`--clear-actual-end`
- Server API — milestone create/update handlers
- Web UI — milestone 详情/编辑表单使用 `datetime-local` 输入
- MCP — milestone schema 与 handler 支持
- i18n — 复用 BACK-492 的 `taskDetails.section.actualStart` / `actualEnd` 标签

## 实现细节

- `milestone create` CLI 命令此前不存在，为本任务新增
- MCP 工具名引用从 `milestone_rename` 统一更新为 `milestone_edit`
- 里程碑自动填充使用 `milestoneKey()` 进行大小写不敏感匹配
- 检查里程碑下所有任务是否终态时，在保存当前任务后调用 `listTasks()`，确保当前任务的终态已反映

## Related Concepts

- [[concepts/date-fields]] — 日期字段语义与存储格式
- [[concepts/web-ui-features]] — Web UI 里程碑管理

## Related Sources

- [[sources/actual-start-end-fields-task]] — BACK-492 任务级 actual 字段

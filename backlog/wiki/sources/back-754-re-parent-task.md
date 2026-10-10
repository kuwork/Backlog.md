---
title: BACK-754 - task edit 重定父任务
labels: [source, cli, mcp]
created_date: 2026-10-07 22:50
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-754 - Re-parent-an-existing-task-task-edit-parent-clear-parent.md
---

# BACK-754 - task edit 重定父任务

## 问题

`--parent` 仅存在于 `task create`（并作为 `task list` 过滤项）。已存在任务无法设置/变更父任务，导致无父任务创建的任务永远无法加入既有父子树。这在把 BACK-614/751/753 事后归入 BACK-239 特性下时暴露——唯一途径是调用 `core.updateTask` 的一次性脚本。

## 解决方案

在编辑面增加一等公民的重定父路径，CLI 与 MCP 共享：

- `backlog task edit <id> --parent <parentId>` 设 `parent_task_id`
- `backlog task edit <id> --clear-parent` 移除它

父 ID 在创建时铸造（`generateNextId(type, parent)` 产出 `BACK-239.01`），但父子边本身只是 `parent_task_id` 前字段、按 ID 解析，故重定父不要求重命名；保留原 ID，仅改边。

- **类型**：`TaskEditArgs` 与 `TaskUpdateInput` 加 `parentTaskId?: string | null`，`null` 清除、镜像 `milestone`
- **builder**：`undefined` 不动、`null` 清除、字符串 trim（空串亦清除）
- **core**：`applyTaskUpdateInput` 像 `milestone` 一样应用；新私有 `resolveParentTaskId` 解析目标（tasks + completed）归一化存储 ID；写入前拒三情形——不匹配、目标是自身、目标在自身之下（沿父链上溯、遇编辑 ID 即拒、`seen` 防既有环自旋）
- **CLI**：`-p, --parent <taskId>` 与 `--clear-parent` 计入编辑字段标志；二者同给拒绝、空 `--parent` 指向 `--clear-parent`；排除出 `PER_TASK_ONLY_EDIT_FLAGS`（多任务定同一父是合法批量）
- **MCP**：`task_edit` schema 加 `parentTaskId`（字符串设 / null 清除），`TaskEditRequest` 已透传
- **文档**：CLI 与 MCP 的 Task Field Quick Reference 并行更新

## 验证

`cli-reparent` + `mcp-reparent` 12 pass；相关套件通过；biome/tsc 干净

## Related Concepts
- [[concepts/task-identity]] — 任务 ID 归一化与父子边解析

## Related Sources
- [[sources/back-614-entity-id-auto-link-autocomplete]] — 事后归入 BACK-239 的源任务之一
- [[sources/back-753-referenced-by-backlinks]] — 同批归入 BACK-239
- [[sources/back-755-include-completed-subtasks]] — 同批父子/层级相关修复

---
title: BACK-855 - 任务标题驱动文件更名
labels: [source, cli, mcp, tasks, rename]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-855 - Rename-task-files-when-task-titles-change.md
---

# BACK-855 - 任务标题驱动文件更名

任务标题变化导致 sanitize 后路径变化时，`Core.updateTask` 复用 `FileRenamePlan` 原子更名并修复本地引用；CLI、MCP 与 Web 自动继承。

## 目标

活动与已完成任务的文件名都应随标题更新，同时保留任务 ID 和父目录。只触发 `/task/:id/:title` 路由规范化，不误改文档或决策路由；无路径变化保持原有保存流程。

## 实现要点

- 提取共享 `getTaskFilename`，创建与标题更名使用完全相同的 sanitize 规则。
- 只有持久化标题变化且目标路径不同才构建计划；任务 ID、父目录、状态与普通字段更新语义不变。
- 引用、任务结构化字段、Wiki `source_path` 与任务 slug 同步；同 ID 目标冲突在写入前失败。
- 自动提交包含任务移动及每个变更引用。
- CLI/MCP 指南改为自动更名优先，失败时才用 `mv` 加手工引用修复兜底。

## 验证

相关更名与路径测试 93 项、Core 任务操作 27 项、自动提交回归 1 项均通过；TypeScript 与 Biome 通过。

## Related Concepts

- [[concepts/file-rename-plan]] — 复用的原子更名计划
- [[concepts/task-identity]] — ID 保留与路径身份边界

## Related Sources

- [[sources/back-854-document-rename-reference-repair]] — 共享计划与引用重写来源
- [[sources/back-856-decision-title-file-rename]] — 决策侧的平行接入
- [[sources/back-858-entity-id-update-source-selection]] — 后续扩展到 ID 更新

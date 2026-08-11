---
title: BACK-530 task edit 新增 --append-description
labels: [source, cli, mcp]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-530 - Add-append-description-option-to-task-edit.md
---

# BACK-530 为 task edit 新增 --append-description 选项

让 `backlog task edit` 支持在保留原文的情况下追加描述，与已有的 `--append-notes`、`--append-final-summary` 对齐。

## 问题

`--description` 总是整段替换，用户无法在保留原文的情况下追加描述内容。

## 解决方案

新增可重复的 `--append-description` / `--append-desc` 选项，将文本追加到现有描述末尾。实现贯穿类型定义、核心追加逻辑、CLI 选项、帮助 schema 与 MCP schema。复用已有的 `appendBlock` 辅助函数，并在 `hasEditFieldFlags` 中注册以避免误触发编辑向导。

## 实现位置

- `src/types/index.ts`（`TaskEditArgs`/`TaskUpdateInput.descriptionAppend`）
- `src/cli.ts`（注册 `--append-description`/`--append-desc`）
- `src/utils/task-edit-builder.ts`（`buildTaskUpdateInput` 映射）
- `src/core/backlog.ts`（`updateTaskFromInput` 追加）
- `src/mcp/utils/schema-generators.ts`（task_edit 的 descriptionAppend）

## 测试

`src/test/append-description.test.ts`（5 项）：单次/多次追加、空描述、`\n` 转义、`--description` 与追加组合。

## Related Concepts
- [[concepts/cli-entry]] — CLI task edit 命令
- [[concepts/task-lifecycle]] — 任务字段编辑

## Related Sources
- [[sources/back-529-doc-update-multiline-append]] — 文档追加

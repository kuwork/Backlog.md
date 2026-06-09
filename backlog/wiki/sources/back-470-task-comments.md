---
title: BACK-470 任务评论功能
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, feature, comments, cli, mcp, web-ui, tui]
source_path: backlog/tasks/back-470 - Add-task-comments-across-Backlog.md.md
---

# BACK-470 任务评论功能

在所有 Backlog.md 公共界面上添加一级（first-class）任务评论的**父任务**。评论功能允许人类用户和代理在不超载"实现备注"或"最终总结"的情况下讨论或批注任务。

## 范围

在所有公共界面上提供有序的任务级评论：
- CLI（`task edit --comment`）
- MCP（`task_edit` 评论追加字段）
- Web UI / Server API
- 终端/纯文本任务视图

明确超出初始 PR 范围的功能：嵌套回复、表情反应、精细权限控制、评论编辑/历史记录。

## 关键设计决策

- **Markdown 持久化**：评论保存在任务 Markdown 文件内一个结构化的 `## Comments` 区域中，使用哨兵（sentinel）定界块分隔，不采用附属文件（sidecar files）
- **通过现有管道仅追加**：复用任务更新路径，而非新增独立持久化服务
- **区域位置**：位于"实现备注"之后、"最终总结"之前
- **搜索收录**：评论文本同时被 `SearchService` 和内存任务搜索索引

## 子任务

- [[sources/back-470-1-core-task-comments]] — 核心模型与 Markdown 持久化
- [[sources/back-470-2-cli-mcp-task-comments]] — CLI 与 MCP 暴露
- [[sources/back-470-3-server-web-task-comments]] — Server API 与 Web UI
- [[sources/back-470-4-tui-docs-task-comments]] — 终端渲染与公开指南

## 相关概念
- [[concepts/task-comments]] — 任务评论模型、Markdown 持久化与使用指南
- [[concepts/markdown-pipeline]] — 结构化区域解析与哨兵处理
- [[concepts/mcp-workflow]] — MCP 任务执行与收尾指南

## 相关来源
- [[sources/back-470-1-core-task-comments]] — 核心评论模型
- [[sources/back-470-2-cli-mcp-task-comments]] — CLI/MCP 评论界面
- [[sources/back-470-3-server-web-task-comments]] — Server/Web 评论界面
- [[sources/back-470-4-tui-docs-task-comments]] — TUI/文档评论界面

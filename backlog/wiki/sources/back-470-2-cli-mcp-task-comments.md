---
title: BACK-470.2 CLI 与 MCP 评论暴露
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, feature, comments, cli, mcp]
source_path: backlog/tasks/back-470.2 - Expose-task-comments-in-CLI-and-MCP.md
---

# BACK-470.2 CLI 与 MCP 评论暴露

通过公共命令行和 MCP 任务界面暴露任务评论功能。

## CLI

- `task edit --comment "..."` — 追加一条或多条评论
- `task edit --comment-author "..."` — 可选作者
- 纯文本任务输出按顺序渲染评论，包含作者、时间戳和 Markdown 正文

## MCP

- `task_edit` 模式扩展了评论追加输入字段
- `task_view` 输出与纯文本任务输出一致地包含评论
- 验证会拒绝保留标记

## 行为约束

- 现有的"实现备注"和"最终总结"标志保持不变
- 评论可以与其他任务编辑合并为单次更新

## 相关概念
- [[concepts/task-comments]] — 评论模型与使用指南
- [[concepts/mcp-workflow]] — MCP 任务工具与工作流
- [[concepts/cli-entry]] — CLI 命令注册与任务编辑

## 相关来源
- [[sources/back-470-task-comments]] — 父功能任务
- [[sources/back-470-1-core-task-comments]] — 核心模型
- [[sources/back-470-3-server-web-task-comments]] — Server/Web 界面

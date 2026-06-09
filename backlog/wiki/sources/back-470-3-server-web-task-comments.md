---
title: BACK-470.3 Server API 与 Web UI 评论支持
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, feature, comments, server, web-ui]
source_path: backlog/tasks/back-470.3 - Add-task-comments-to-server-API-and-Web-UI.md
---

# BACK-470.3 Server API 与 Web UI 评论支持

使用与 CLI 和 MCP 相同的共享任务模型，为任务评论添加浏览器支持。

## Server API

- 任务响应包含 `comments` 数组
- 任务更新端点接受评论追加负载
- 与 CLI/MCP 采用相同的验证（拒绝保留标记）

## Web UI

- 任务详情弹窗在预览模式下以只读方式显示评论
- 评论按时间顺序渲染，包含作者、时间戳和 Markdown 渲染正文
- 本地可编辑任务可在编辑模式下追加评论
- 添加评论**不会**将弹窗切换出编辑模式
- 跨分支只读任务显示评论但隐藏提交表单

## 相关概念
- [[concepts/task-comments]] — 评论模型与 Web UI 行为
- [[concepts/web-server]] — BacklogServer REST API
- [[concepts/web-ui-features]] — 任务弹窗与预览/编辑模式

## 相关来源
- [[sources/back-470-task-comments]] — 父功能任务
- [[sources/back-470-1-core-task-comments]] — 核心模型
- [[sources/back-470-2-cli-mcp-task-comments]] — CLI/MCP 界面

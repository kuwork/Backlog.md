---
title: BACK-470.4 终端 UI 评论渲染与公共文档更新
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, feature, comments, tui, docs]
source_path: backlog/tasks/back-470.4 - Render-task-comments-in-terminal-UI-and-update-public-guidance.md
---

# BACK-470.4 终端 UI 评论渲染与公共文档更新

在剩余的公共界面和文档中完成评论支持。

## TUI 渲染

- 终端任务详情和弹窗视图按与纯文本输出和 Web UI 相同的区域顺序渲染评论
- 评论区域添加到结构化区域标题中，以实现稳定的区域导航

## 公共指南更新

文档说明了评论与"实现备注"和"最终总结"的区别：
- **评论**：任务讨论/批注
- **实现备注**：执行进度日志
- **最终总结**：PR 风格的完成总结

更新的文件：
- `README.md`
- `CLI-INSTRUCTIONS.md`
- 代理指南（`src/guidelines/agent-guidelines.md`）
- MCP 工作流指南（`src/guidelines/mcp/overview.md`、`task-execution.md`、`task-finalization.md`）
- MCP 工作流资源（`src/mcp/resources/workflow/index.ts`）

## 相关概念
- [[concepts/task-comments]] — 评论使用指南
- [[concepts/cli-tui]] — 终端 UI 视图
- [[concepts/mcp-workflow]] — 面向代理的指南

## 相关来源
- [[sources/back-470-task-comments]] — 父功能任务
- [[sources/back-470-1-core-task-comments]] — 核心模型
- [[sources/back-470-2-cli-mcp-task-comments]] — CLI/MCP 界面
- [[sources/back-470-3-server-web-task-comments]] — Server/Web 界面

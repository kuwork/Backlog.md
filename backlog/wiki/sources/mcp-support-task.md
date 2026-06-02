---
title: BACK-287 MCP 支持实现
labels: [source]
source_path: backlog/completed/back-287 - Add-MCP-support-for-agent-integration.md
created_date: 2026-05-06 00:00
---


# BACK-287 摘要

实现了 Model Context Protocol (MCP) 支持，将 Backlog.md 功能通过标准化协议暴露给 AI 代理。

## 架构

- MCP 服务器扩展 Core 类
- **30+ Tools**：与 CLI 功能对等（任务、草稿、文档、笔记、看板、配置、依赖、序列）
- **10+ Resources**：只读数据访问（任务、看板状态、指标、文档）
- **Transport**：仅 stdio（推荐，本地助手最安全）
- **CLI 命令**：`backlog mcp start`

## 安全原则

- 纯协议包装器，MCP 层零业务逻辑
- 所有操作通过现有 Core 方法
- 仅限 localhost，运行时验证防止网络暴露
- CLI 和 MCP 共享工具构建器与验证器

## 支持的 AI 客户端

- Claude Code / Claude Desktop
- OpenAI Codex
- Google Gemini CLI
- Kiro
- Cursor

## 客户端配置示例

```bash
claude mcp add backlog --scope user -- backlog mcp start
codex mcp add backlog backlog mcp start
gemini mcp add backlog -s user backlog mcp start
kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start
```

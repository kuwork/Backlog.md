---
title: Backlog.md CLI 工具
labels: [entity]
created_date: '2026-05-06 00:00'
updated_date: '2026-07-14 11:20'
---

# Backlog.md CLI 工具

**类型**：项目 / 工具  
**技术栈**：Bun + TypeScript 5  
**构建输出**：单文件可执行二进制（含嵌入式 Web 资源）

## 定位

Markdown 原生的任务管理与看板可视化 CLI 工具，同时作为 MCP 服务器为 AI 代理提供协议接口。

## 核心模块

- `src/cli.ts` — CLI 入口与命令注册（Commander.js）
- `src/core/backlog.ts` — Core 类，所有业务逻辑中心
- `src/file-system/` — 文件系统操作（任务/文档/决策的读写）
- `src/ui/` — TUI 组件（看板、任务列表、概览、序列）
- `src/web/` — Web UI（React + Tailwind CSS v4）
- `src/mcp/server.ts` — MCP 服务器（stdio 传输）
- `src/guidelines/cli-instructions/` — CLI 工作流指南 markdown
- `src/guidelines/mcp/` — MCP 工作流指南 markdown
- `src/mcp/workflow-guides.ts` — CLI/MCP 共享指南注册表
- `src/git/` — Git 集成（跨分支任务检测、自动提交）
- `src/completions/` — Shell 补全逻辑

## 代理集成入口

- **CLI instructions**：`backlog instructions` 命令提供本地工作流指南；`backlog init` 默认安装短 CLI nudge 到 `AGENTS.md`。
- **MCP**：`backlog mcp start` 启动 stdio MCP 服务器；MCP 客户端通过 `get_backlog_instructions` 工具读取指南。

## 分发渠道

- npm：`backlog.md`
- Homebrew：`backlog-md`
- Nix：`nix run github:MrLesk/Backlog.md`
- GitHub Releases：平台二进制文件

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/cli-entry]] — CLI 入口与命令体系

## Related Entities

- [[entities/ai-agents]] — AI 代理与集成

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.2]] — BACK-521.2 Short agent nudge and init default migration

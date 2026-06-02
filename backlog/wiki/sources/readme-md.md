---
title: README.md 产品概述
labels: [source]
source_path: README.md
created_date: 2026-05-06 00:00
---


# README.md 摘要

Backlog.md 是一款 Markdown 原生的任务管理与看板可视化工具，可将任意 Git 仓库目录转变为自包含的项目看板。

## 核心定位

- **Markdown-native**：每个任务都是独立的 `.md` 文件
- **AI-Ready**：支持 Claude Code、Gemini CLI、Codex、Kiro、Cursor 等 MCP/CLI 兼容的 AI 助手
- **100% 离线私有**：所有数据存放在仓库本地，无需联网
- **跨平台**：macOS、Linux、Windows

## 安装方式

`npm i -g backlog.md` / `bun add -g backlog.md` / `brew install backlog-md` / `nix run github:MrLesk/Backlog.md`

## 两种使用路径

1. **MCP 规范驱动（推荐）**：AI 代理通过 MCP 协议直接管理任务
2. **手动 CLI 模式**：用户通过终端命令直接操作

## 主要功能特性

- 终端即时看板：`backlog board`
- 现代 Web 界面：`backlog browser`（React + Tailwind CSS v4）
- 强大的模糊搜索：`backlog search`
- 看板导出为 Markdown：`backlog board export`
- 可复用的 Definition of Done 默认清单
- Shell 智能补全（bash/zsh/fish/PowerShell）

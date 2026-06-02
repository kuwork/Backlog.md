---
title: Backlog.md 用户手册
labels: [usermanual]
created_date: 2026-05-07 00:00
---


# Backlog.md 用户手册

**Markdown 原生的任务管理与看板可视化工具**

---

Backlog.md 将任意 Git 仓库目录转变为自包含的项目看板。每个任务都是独立的 Markdown 文件，100% 离线私有，无需联网即可使用。

## 核心特性

- **Markdown-native**：所有数据以 `.md` 文件存储，Git 原生友好
- **AI-Ready**：支持 Claude Code、Gemini CLI、Codex、Kiro、Cursor 等 AI 助手
- **双模式界面**：终端 TUI 看板 + 现代 Web 浏览器界面
- **富文本粘贴**：从 Word、Google Docs 一键粘贴为 Markdown，支持 `.docx` 文件上传
- **日期与计划**：任务与里程碑支持 `dueDate`、`plannedStart`、`plannedEnd`，看板卡片实时显示计划窗口与逾期高亮
- **Wiki 知识库**：LLM 维护的增量式项目知识库，人类可读可编辑；浏览器中支持文件树导航、在线编辑、labels 标签与实时同步；内置 skill 可安装到 Claude/Codex
- **跨平台**：macOS、Linux、Windows

## 两种使用路径

1. **MCP 规范驱动（推荐）**：AI 代理通过 MCP 协议直接管理任务，无需手动输入命令
2. **手动 CLI 模式**：用户通过终端命令直接操作任务、看板与文档

## 安装

```bash
npm i -g backlog.md
```

其他安装方式：
- `bun add -g backlog.md`
- `brew install backlog-md`
- `nix run github:MrLesk/Backlog.md`

## 快速开始

```bash
# 初始化项目
backlog init my-project

# 创建任务
backlog task create "实现用户登录功能"

# 查看 TUI 看板
backlog board

# 启动 Web 界面
backlog browser
```

---

本手册涵盖从基础安装到高级 AI 集成的完整使用指南。

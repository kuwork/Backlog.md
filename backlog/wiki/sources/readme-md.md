---
title: README.md 产品概述
created_date: '2026-05-06 00:00'
updated_date: '2026-08-17 23:00'
labels: [source]
source_path: README.md
---

# README.md 摘要

Backlog.md 是一款 Markdown 原生的任务管理与看板可视化工具，可将任意 Git 仓库目录转变为自包含的项目看板。

## 核心定位

- **Markdown-native**：每个任务都是独立的 `.md` 文件
- **AI-Ready**：支持 Claude Code、Gemini CLI、Codex、Kiro、Cursor 等 MCP/CLI 兼容的 AI 助手
- **100% 离线私有**：所有数据存放在仓库本地
- **跨平台**：macOS、Linux、Windows

## 安装方式

`npm i -g @kuwork/backlog.md` / `bun add -g @kuwork/backlog.md` / `brew install backlog-md`（上游） / `nix run github:MrLesk/Backlog.md`（上游）

## 两种使用路径

1. **CLI 指令（推荐）**：AI 代理通过 `backlog instructions` 读取本地工作流指南
2. **MCP 连接器**：AI 直接调用 MCP 工具

## 主要功能特性

- 终端即时看板：`backlog board`
- 现代 Web 界面：`backlog browser`（React + Tailwind CSS v4）
  - 默认仅绑定回环地址 `127.0.0.1`；`--host 0.0.0.0` 可开放 LAN（API 未认证，慎用）
  - 支持 `BROWSER` 环境变量指定浏览器（devcontainer 场景）
- 强大的模糊搜索：`backlog search`，TUI/CLI/MCP 统一使用 Fuse.js 分数阈值 0.45
- 稳定 JSON 输出：`task list/view/search/doc list` 支持 `--json`（schemaVersion 1）
- 看板导出为 Markdown：`backlog board export`
- 可复用的 Definition of Done 默认清单
- Shell 智能补全（bash/zsh/fish/PowerShell）
- 跟踪甘特图：计划 vs 实际双层对比
- LLM Wiki 知识库：自动摄取、查询、健康检查
- 富文本粘贴与 `.docx` 上传

## 关键 CLI 行为

- `backlog task edit --append-plan` 可重复追加实现计划
- `backlog task edit --append-notes/--append-final-summary` 追加备注/总结
- 多行字段支持在普通双引号内使用 `\n`；指南警告避免 bash ANSI-C 引号 `$'...'`
- `autoCommit` 仅暂存本次操作触碰的文件，不污染用户其他 staged/untracked 工作

## Related Sources

- [[sources/readme-en-md]] — English README
- [[sources/cli-instructions-md]] — CLI reference

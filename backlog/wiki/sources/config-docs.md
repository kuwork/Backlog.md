---
title: 配置文档与决策记录
labels: [source]
source_path: backlog/docs/ + backlog/decisions/
created_date: 2026-05-06 00:00
---


# 配置与决策摘要

## 配置层次（高 → 低）

1. CLI flags
2. 项目配置文件：`backlog.config.yml`（如果存在）→ `backlog/config.yml` / `.backlog/config.yml`
3. 内置默认值

## 关键配置项

- `project_name`：项目名称
- `default_status`：新建任务默认状态
- `statuses`：允许的状态列表（默认 To Do / In Progress / Done）
- `labels`：可用标签
- `milestones`：里程碑列表
- `definition_of_done`：项目级 DoD 默认清单
- `default_editor`：默认编辑器
- `default_port` / `auto_open_browser`：Web UI 默认设置
- `checkActiveBranches` / `remoteOperations` / `activeBranchDays`：跨分支检测与远程操作
- `autoCommit` / `bypassGitHooks`：Git 工作流
- `zeroPaddedIds`：ID 前导零格式化
- `task_prefix` / `draft_prefix`：自定义 ID 前缀

## 编辑器配置优先级

1. `EDITOR` 环境变量
2. `config.defaultEditor`
3. 平台默认（macOS/Linux: nano，Windows: notepad）

## 技术决策

- **Tailwind CSS v4**：CSS-first 配置，无 `tailwind.config.js`，使用 `@import "tailwindcss"` 和 `@theme`
- **MCP stdio-only**：移除 HTTP/SSE 传输，仅支持 stdio 传输以确保安全

---
title: CLI-INSTRUCTIONS.md 命令参考
created_date: '2026-05-06 00:00'
updated_date: '2026-08-17 23:00'
labels: [source]
source_path: CLI-INSTRUCTIONS.md
---

# CLI-INSTRUCTIONS.md 摘要

完整的 Backlog.md CLI 命令参考文档，涵盖项目设置、任务管理、搜索、看板、文档、决策、Web 界面等所有用户-facing 命令。

## 新增与更新的命令/选项

- `backlog task edit --append-plan <text>` — 追加实现计划，可重复
- `backlog task edit --append-notes/--append-final-summary` — 追加备注/总结
- `backlog task list/view/search --json` — 稳定 JSON 输出（schemaVersion 1）
- `backlog doc list --json` — JSON 文档列表
- `backlog browser --host <host>` — 显式绑定主机（默认 `127.0.0.1`）
- `BROWSER=/path/to/browser backlog browser` — 使用指定浏览器打开 Web UI
- `backlog instructions overview` — 现在包含 Sequences Quick Reference

## 任务管理

创建/编辑/查看/归档/删除任务，支持描述、负责人、状态、标签、优先级、AC、DoD、计划、备注、评论、最终总结、依赖、引用、文档链接、日期字段。

## 多行输入

- `--desc` / `--description`：CLI 解释 `\n` 为换行
- `--plan`、`--notes`、`--comment`、`--final-summary` 及 `--append-*` 变体：在普通双引号内使用真实换行或 `\n`
- 避免 `$'...'` 包装（bash ANSI-C 引号），因为 tree-sitter/agent sandbox 可能不支持

## 搜索与过滤

- `backlog search "关键词" --status/--exclude-status/--unassigned --plain`
- 状态支持多选和排除；`--unassigned` 过滤无负责人任务
- Fuse.js 搜索在 TUI/CLI/MCP/Web 统一使用 0.45 分数阈值

## Web 界面

- `backlog browser` 默认仅本机回环；`--host 0.0.0.0` 开放 LAN（未认证 API，谨慎使用）
- `BROWSER` 环境变量用于 devcontainer/自定义浏览器

## 其他区域

- 里程碑管理、草稿工作流、看板导出、统计概览、Shell 补全、配置管理、维护清理等保持不变并随相关任务增强。

## Related Sources

- [[sources/readme-md]] — 中文产品概述
- [[sources/readme-en-md]] — 英文产品概述

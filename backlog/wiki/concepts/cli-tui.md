---
title: CLI 与 TUI 界面
labels: [concept]
created_date: 2026-05-06 00:00
---


# CLI 与 TUI 界面

Backlog.md 提供命令行界面（CLI）和终端用户界面（TUI）两种交互方式。

## CLI 命令结构

```
backlog <command> <subcommand> [options]
```

主要命令组：
- `task` — 任务 CRUD
- `draft` — 草稿管理
- `board` — 看板查看与导出
- `search` — 模糊搜索
- `browser` — 启动 Web UI
- `doc` / `decision` — 文档与决策
- `milestone` — 里程碑管理
- `config` — 配置管理
- `cleanup` — 清理已完成任务
- `overview` — 统计概览
- `completion` — Shell 补全安装
- `mcp` — MCP 服务器管理
- `agents` — 代理指令更新

## TUI 看板（`backlog board`）

基于 bblessed 的交互式终端看板：
- 按状态分栏显示任务
- 键盘导航：方向键移动，Enter 打开任务详情
- 按 `E` 在编辑器中打开任务（自动挂起 TUI）
- Tab 键在看板与任务列表间切换
- 支持看板移动模式（move mode）
- 实时文件监控（Bun.watch）

## TUI 任务列表

- 可筛选：状态、负责人、标签、里程碑
- 紧凑视图支持
- 循环导航（首尾相连）

## 纯文本输出（`--plain`）

所有查看类命令支持 `--plain` 标志，输出结构化纯文本而非交互式 UI，便于 AI 代理解析和脚本处理。

## Shell 补全

内置 bash/zsh/fish/PowerShell 补全脚本：
- 动态补全实际任务 ID
- 动态补全配置中的状态值、标签、负责人
- `backlog completion install` 一键安装

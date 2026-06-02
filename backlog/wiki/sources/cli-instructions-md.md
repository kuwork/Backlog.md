---
type: source
title: CLI-INSTRUCTIONS.md 命令参考
source_path: CLI-INSTRUCTIONS.md
updated: 2026-05-06
---

# CLI-INSTRUCTIONS.md 摘要

完整的 Backlog.md CLI 命令参考文档，涵盖项目设置、任务管理、搜索、看板、文档、决策、Web 界面等所有用户-facing 命令。

## 项目设置

- `backlog init [project-name]` — 初始化项目（交互式向导）
- `backlog init --no-git` — 无 Git 的纯文件系统项目
- `backlog config` — 高级配置向导（DoD 默认值、编辑器、端口等）

## 任务管理（Task）

创建：`backlog task create "标题" [-d 描述] [-a 负责人] [-s 状态] [-l 标签] [--priority high|medium|low] [--ac 验收标准] [--plan 计划] [--notes 备注] [--dep 依赖] [--ref 引用] [--doc 文档] [--dod DoD项] [--no-dod-defaults]`

子任务：`backlog task create -p 14 "子任务标题"`

列表：`backlog task list [-s 状态] [-a 负责人] [-p 父任务]`

查看：`backlog task <id>`（交互式 TUI，按 E 编辑） / `backlog task <id> --plain`（纯文本，适合 AI）

编辑：`backlog task edit <id> [所有创建时的选项] [--remove-ac 序号] [--check-ac 序号] [--uncheck-ac 序号] [--append-notes] [--final-summary] [--append-final-summary] [--clear-final-summary]`

归档：`backlog task archive <id>`

降级为草稿：`backlog task demote <id>`

## 草稿（Draft）

- `backlog task create "标题" --draft`
- `backlog draft create "标题"`
- `backlog draft promote <id>`

## 看板（Board）

- `backlog board` — 交互式 TUI 看板
- `backlog board export [文件]` — 导出为 Markdown 表格
- `backlog board export --readme` — 导出到 README.md
- `backlog board export --export-version "v1.0.0"`

## 搜索（Search）

- `backlog search "关键词"` — 模糊搜索任务/文档/决策
- `backlog search "关键词" --status "In Progress" --priority high`
- `backlog search "关键词" --plain`

## 统计与概览

- `backlog overview` — 交互式 TUI 统计面板（状态分布、优先级、完成率、近期活动）

## Web 界面

- `backlog browser` — 启动 Web UI（默认端口 6420，自动打开浏览器）
- `backlog browser --port 8080 --no-open`

## 文档（Doc）

- `backlog doc create "标题" [-p 子路径]`
- `backlog doc update <id> --content "内容" [--title] [-t type] [--tags] [-p path]`
- `backlog doc list`
- `backlog doc view <id>`

## 决策（Decision）

- `backlog decision create "标题" [-s proposed|accepted|rejected|deprecated|superseded]`
- `backlog decision list`

## 维护

- `backlog cleanup` — 将旧的 Done 任务移动到 completed 文件夹
- `backlog agents --update-instructions` — 更新 AI 代理指令文件

## Shell 补全

- `backlog completion install` — 自动检测并安装当前 shell 的补全脚本
- 支持 bash、zsh、fish、PowerShell

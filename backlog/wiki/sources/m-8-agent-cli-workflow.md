---
title: m-8 - 代理 CLI 工作流里程碑
labels: [source, milestone, cli, agent-workflow]
created_date: 2026-09-08 17:00
updated_date: 2026-10-09 23:30
source_path: backlog/milestones/m-8 - agent-cli-workflow.md
---

# m-8 - 代理 CLI 工作流里程碑

里程碑 m-8 目标是让 `backlog` 命令成为人类与代理共用的唯一默认指令入口。范围包括简短的生成式安装文本、本地工作流指南（`backlog instructions` 系列）、更清晰的命令帮助，以及可选的 MCP 支持。

- 单一入口：`backlog` CLI 兼作指令面，降低人类与代理上手对外部文档的依赖。
- 简短的生成式安装文本：由 CLI 自身生成的仓库专属快速开始输出。
- 本地工作流指南：随工具发布的按命令指导材料（`backlog instructions <topic>` 系列）。
- 更清晰的命令帮助：`--help` 界面被视为工作流的一部分，而非纯参考。
- 可选的 MCP 支持：MCP 服务器作为 CLI 之外的选配伴随面。
- 里程碑文件本身极简（id + 标题 + 一段描述）；任务级细节在所链接的 BACK 任务与 `backlog instructions overview` 等指南中。

## Related Concepts

- [[concepts/cli-instructions]] — 指令/指南面是本里程碑的核心交付物
- [[concepts/cli-entry]] — CLI 作为人类+代理统一入口
- [[concepts/mcp-workflow]] — 可选 MCP 支持补齐里程碑的面故事

## Related Sources

- [[sources/cli-instructions-md]] — 体现本里程碑的随附指令文件

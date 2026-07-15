---
title: BACK-521.6 Root command local instruction hub
labels: [source, cli, agent-guidance]
source_path: backlog/tasks/back-521.6 - Root-command-local-instruction-hub.md
created_date: '2026-06-13 19:10'
updated_date: '2026-07-14 11:20'
---

# BACK-521.6 Root command local instruction hub

**状态**: Done | **负责人**: @codex | **优先级**: medium | **父任务**: [[sources/back-521|BACK-521]]

将 CLI 文档入口点转换为纯文本指令表面。裸 `backlog` 命令和 `backlog instructions` 默认输出纯文本：无 TTY UI、无富终端渲染、无需 `--plain`。

## Acceptance Criteria

- 裸 `backlog` 输出始终为纯文本，不再将 `https://backlog.md` 作为主要文档路径。
- 裸 `backlog` 输出指向本地指令命令，特别是 `backlog instructions`、指南专用命令和命令级 `--help`。
- `backlog instructions` 默认打印 overview、task-creation、task-execution、task-finalization、init-required 的纯文本指南索引。
- `backlog instructions <guide>` 默认直接打印指南 markdown，无需 `--plain`。
- 文档入口点复用与指令命令相同的工作流指南内容，而非陈旧的在线文档。
- 测试覆盖根命令纯文本行为、指令列表行为、指南专用输出、移除旧在线文档指针。

## 实现要点

- 裸 `backlog` 打印带有文本 logo 的本地入口点，包含设置/常用工作流命令、指令指南命令、命令帮助。
- `backlog instructions` 默认打印纯文本指南索引；`backlog instructions <guide>` 直接打印 markdown。
- 对命令输出、根命令帮助文案、生成的 agent nudge、CLI 指南 markdown、README、CLI-INSTRUCTIONS、任务文案进行 copy audit，移除解释实现选择的措辞，改为直接的用户/代理指令。
- 索引中 `overview` 是必须首先阅读的指南。

## 验证

- 聚焦 root-entry/instructions 测试
- `bunx tsc --noEmit`
- `bun run check .`

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/cli-entry]] — CLI 入口与命令体系

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.1]] — BACK-521.1 Shared workflow instruction registry and CLI access
- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance

---
title: BACK-24.02 - TUI 看板里程碑泳道
labels: [source, tui, enhancement, archived, milestones]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/archive/tasks/back-24.02 - CLI-TUI-Add-milestone-swimlanes-to-interactive-board-view.md
---

# BACK-24.02 - TUI 看板里程碑泳道

一条较早（2025-12-17 提出）的 TUI 增强需求，父任务 BACK-24，priority low。该任务已归档，状态仍为 To Do、无 assignee，从未实现。

## 目标

`backlog board` 的 `-m/--milestones` 标志只在非 TTY 模式（markdown 输出）下生效，交互式 TUI 看板完全忽略该标志。需求是在 TUI 看板视图里实现里程碑泳道，行为对齐 Web UI 的里程碑视图——按里程碑分组任务并带可折叠分区。任务正文仅有这段 Description，无验收标准与实现笔记。

## 与后续任务的重叠

作为历史需求背景参考：TUI 侧的里程碑分组浏览后来由 BACK-687 交付——但它实现的是 `backlog milestone list` 双窗格交互视图（左里程碑列表 + 右侧被限定里程碑的看板），而非主看板内的泳道；plain 输出的里程碑分组由 BACK-688 补齐。"`backlog board -m` 在 TTY 下按泳道分组"这一确切交互在本仓库 backlog 中未见对应实现任务。

## Related Concepts

- [[concepts/milestones]] — 泳道分组所依据的里程碑模型
- [[concepts/cli-tui]] — `backlog board` 交互看板所在面

## Related Sources

- [[sources/back-687-milestone-board-tui]] — TUI 里程碑交互看板视图，覆盖了本需求的分组浏览意图（以独立命令而非看板泳道形式）
- [[sources/back-688-milestones-plain-grouped-output]] — milestones plain 分组输出，覆盖非 TTY 侧
- [[sources/back-222-subtask-visualization-web-ui]] — 同为历史未实现增强的归档任务先例

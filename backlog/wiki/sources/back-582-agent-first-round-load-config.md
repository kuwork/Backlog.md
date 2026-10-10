---
title: BACK-582 - Agent 首轮先读项目配置
labels: [source, agent-guidance, cli-instructions, config]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-582 - Agent-first-round-should-load-project-config-before-acting.md
---

# BACK-582 - Agent 首轮先读项目配置

修复一种首轮失败模式：新 agent 会话运行 `backlog instructions overview`，它只打印通用工作流指令，然后基于对 defaultAssignee、statuses 和活动任务的默认假设作答——用户不得不纠正。overview 指南现在要求 agent 在给出任何回答或计划前，先经 CLI 加载实时项目状态。

## 实现要点

- 实现在 `src/guidelines/cli-instructions/overview.md` 而不是项目的 `AGENTS.md`——刻意选择，使该指令随 Backlog.md CLI 发布并适用于每个使用它的项目。
- 新增显式的首会话步骤，列出任何工作开始前要运行的 `config list`、`search`、`task list`、`task view` 和 `overview` 命令。
- 新增警告：agent 必须读取 `config list` 中配置的 `statuses`/`defaultStatus`，不得假设默认的 `[To Do, In Progress, Done]` 集合；设置或校验任务状态时必须在配置的 statuses 之内。
- 新增 `defaultStatus` 校验提醒：`defaultStatus` 必须是 `statuses` 的成员；如果不是，agent 应警告用户并请其把它加入 `statuses` 或另选默认值。
- 记录初始化默认值（`statuses: [To Do, In Progress, Done]`、`defaultStatus: To Do`），同时强调项目可自定义，agent 必须用 `config list` 核实。现已冗余的 BACK-584 任务被归档。
- 验证：`bun run check .` 干净（仅既有警告）；`bun test src/test/cli.test.ts src/test/cli-root-entry.test.ts` 98 pass / 0 fail。

## 验收标准

- 启动指令要求会话开始时读取实时项目配置；列出的命令覆盖 defaultAssignee、statuses、活动任务和里程碑。
- 首轮回答使用取回的配置而非默认值；验证显示模拟首轮提示使用正确的 defaultAssignee/statuses。

## Related Concepts

- [[concepts/cli-instructions]] — 已发布的 overview 指南是 agent 的主要入口
- [[concepts/mcp-workflow]] — 同样的先读配置纪律适用于 MCP 驱动的 agent

## Related Sources

- [[sources/back-521]] — 创建 overview 界面的 CLI 优先 agent 工作流重构
- [[sources/back-521.1]] — overview 所属的共享工作流指令注册表
- [[sources/back-579-default-assignee]] — agent 现在必须实时取回的配置值之一（同批次）

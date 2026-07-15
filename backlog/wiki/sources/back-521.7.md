---
title: BACK-521.7 Milestone CLI parity with MCP operations
labels: [source, cli, milestones, mcp]
source_path: backlog/tasks/back-521.7 - Milestone-CLI-parity-with-MCP-operations.md
created_date: '2026-06-13 21:12'
updated_date: '2026-07-14 11:20'
---

# BACK-521.7 Milestone CLI parity with MCP operations

**状态**: Done | **负责人**: @gpt-5.5-xhigh | **优先级**: high | **父任务**: [[sources/back-521|BACK-521]]

在 BACK-401 基础上，为里程碑添加非交互式 CLI 命令（add、edit、remove），使 CLI 用户和代理能执行与 MCP 相同的里程碑管理操作。

## Acceptance Criteria

- `backlog milestone add <name>` 创建里程碑文件，可选 description，与 MCP `milestone_add` 一致地验证重复。
- `backlog milestone remove <name>` 支持 clear、keep、reassign 任务处理模式，包括验证必需的 reassign 目标。
- `backlog milestone edit <name>` 支持 title、description、dueDate、plannedStart、plannedEnd 更新；保留 BACK-401 `updateTasks` 行为（仅标题变化时重写本地任务里程碑引用）；暴露 `--no-update-tasks` 禁用标题驱动的重写。
- 里程碑命令帮助包含输入 schema 章节、读/写行为、输出和示例，包括 edit 的日期字段类型。
- 测试覆盖 CLI add/edit/remove 成功路径、验证失败、标题驱动任务引用更新、日期字段更新、已归档里程碑处理、与 MCP milestone handler 行为的一致性。
- README 或 CLI reference docs 在里程碑管理文档处提及新命令。

## 实现要点

1. 移除旧 CLI `milestone create` 和 `milestone rename`，使 CLI 表面与 post-401 MCP 形状一致。
2. `milestone edit <name>` 作为单一变更命令，支持 `--title`、`-description`、`--due-date`、`--planned-start`、`--planned-end` 及对应 `--clear-*` 选项，加 `--no-update-tasks`。
3. `milestone add`/`edit`/`remove`/`archive` 路由到共享 `MilestoneHandlers`，使验证、任务引用更新、归档处理、auto-commit、错误文本与 MCP 保持一致。
4. MCP `editMilestone` handler 增加 description 变更检查，移除未使用的 `renameMilestone` 别名。
5. 更新里程碑命令帮助 schema 和公共文档（CLI-INSTRUCTIONS.md、README.md、agent-guidelines.md）。

## 验证

- `bun test src/test/cli-milestone-management.test.ts src/test/cli-task-milestone.test.ts src/test/cli-milestone-filter.test.ts src/test/mcp-milestones.test.ts`
- `bunx tsc --noEmit`
- `bunx biome check` on modified files

## Related Concepts

- [[concepts/milestones]] — 里程碑管理
- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/date-fields]] — 日期字段语义与格式

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/milestone-actual-dates-task]] — BACK-493 里程碑 actualStart/actualEnd 支持
- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance

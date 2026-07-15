---
title: BACK-521.1 Shared workflow instruction registry and CLI access
labels: [source, cli, agent-guidance]
source_path: backlog/tasks/back-521.1 - Shared-workflow-instruction-registry-and-CLI-access.md
created_date: '2026-06-13 14:13'
updated_date: '2026-07-14 11:20'
---

# BACK-521.1 Shared workflow instruction registry and CLI access

**状态**: Done | **负责人**: @codex | **优先级**: high | **父任务**: [[sources/back-521|BACK-521]]

创建面向 CLI 的指令表面。工作流指南注册表同时服务于 MCP 资源/工具和 CLI 命令；CLI 暴露列出可用指南和打印单个指南 markdown 的入口。

## 公共 CLI 表面

- `backlog instructions`
- `backlog instructions --list`
- `backlog instructions <overview|task-creation|task-execution|task-finalization|init-required|milestones>`

不使用 `backlog agent` 这类 agent-only 命名空间。

## Acceptance Criteria

- 工作流指南内容可通过公共 CLI 命令读取。
- CLI 指令命令与 MCP workflow resources/tools 共享一个注册表/单一真相源。
- overview 指南作为索引，指向任务创建、执行、完结指南。
- init-required 指南在未初始化目录可用。
- 测试覆盖指南列表、每个 guide key 返回预期内容。

## 实现要点

1. 复用现有工作流指南注册表作为 CLI instruction 输出的来源；如需将 `init-required` 加入 CLI 可见注册表。
2. 添加公共 `backlog instructions` 命令，支持 `--list` 和可选 guide key 参数。
3. 对人类和代理保持 markdown/text-first 输出。
4. 添加聚焦 CLI 测试：列表输出、overview 输出、选定指南输出、无效指南处理。
5. 验证 MCP workflow resource/tool 测试仍通过，因为它们应读取同一注册表。

## 验证

- `bun test src/test/cli.test.ts --test-name-pattern "backlog instructions command"`
- `bun test src/test/mcp-server.test.ts --test-name-pattern "workflow"`
- `bunx tsc --noEmit`

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/cli-entry]] — CLI 入口与命令体系

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.2]] — BACK-521.2 Short agent nudge and init default migration
- [[sources/back-521.6]] — BACK-521.6 Root command local instruction hub
- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance

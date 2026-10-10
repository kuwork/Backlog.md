---
title: BACK-656 - 纠正 agent 指南 overview 节奏与描述要求
labels: [source, cli, mcp, agent-guidance, upstream-migration]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-656 - Correct-the-shipped-agent-guidance-on-overview-cadence-and-task-descriptions.md
---

# BACK-656 - 纠正 agent 指南 overview 节奏与描述要求

两份已发布的 agent 指南文本教会了与其行文本意相悖的行为：CLI agent 提示让 agent 在每个用户请求时都重读 `backlog instructions overview`；任务创建指南要求描述承载"为什么"，给出的示例描述却只写结果（agent 复制演示形态比遵循文字更可靠）。仅改指南，不动运行时代码。

- Nudge（`src/guidelines/cli-agent-nudge.md:7`，init/update 时注入 AGENTS.md 的唯一来源）：触发措辞从每个请求一次改为每会话一次——"run `backlog instructions overview` before answering or taking action. Re-read it only if you have not read it yet in the current conversation"；本仓库自己的 AGENTS.md 实例也用同一句更新
- CLI 任务创建指南（`src/guidelines/cli-instructions/task-creation.md`）：描述条目现在点名应写内容（问题、触发点或用户需求，加上未来 agent 无法从代码中复原的上下文），并明确禁止复述验收标准；示例先给需求再给变更，随后用两行 "Too thin" 对比标注旧的结果导向写法
- MCP 指南（`src/guidelines/mcp/task-creation.md`）补上首个示例描述及同样的要求、禁令与对比；其"精简描述"相关行文调和为限制代码细节而非理由
- 项目经理 agent 指南的示例不再把标题复述成指令——理由由引用的用户请求承载；本 fork 中该文件是符号链接，一处编辑覆盖两个面
- 与分析报告的偏差：每请求一次的句子位于 CLI nudge 而非 MCP 指南（MCP nudge 使用基于资源的触发，未动）；因项目经理示例共享同一上游缺陷，范围相应扩大
- 测试在 `src/test/cli.test.ts`（渲染后的指南 + 生成的 AGENTS.md）与 `src/test/mcp-server.test.ts` 中钉住措辞，防止悄悄回漂；经回退验证（三条新断言在改动前的指南上失败）

## 验收标准

- 已发布的 nudge 改为每次会话开始时读 overview，仅当尚未读过时才重读
- 两份任务创建指南都写明描述必须包含什么、禁止复述验收标准，并演示需求先行的示例与 "too thin" 对比
- 项目经理示例把需求放进用户请求，而不是复述标题
- 测试断言改动后的指令文本，措辞无法悄悄回漂

## Related Concepts

- [[concepts/cli-instructions]] — 本任务纠正的已发布指南面
- [[concepts/mcp-workflow]] — MCP 任务创建指南补上首个示例描述
- [[concepts/upstream-migration]] — 移植上游 BACK-664（dedeaa06a）与 BACK-676（04c4210fb）

## Related Sources

- [[sources/back-532-cli-draft-workflow-guides]] — 更早的 CLI 指令指南工作
- [[sources/back-572-agent-guides-date-fields-multiline-input]] — 此前的 agent 指南纠正

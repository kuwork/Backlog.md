---
title: BACK-537 清单编辑与序列化确定性化
labels: [source, core, markdown, cli, mcp]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-537 - Make-checklist-edits-and-serialization-deterministic.md
---

# BACK-537 使清单（checklist）编辑与序列化确定性化

让 AC/DoD 清单的解析与序列化变得确定性，并引入原子清空操作。

## 问题

- AC/DoD 清单编辑缺少确定性序列化，regex 哨兵匹配对畸形结构敏感
- 缺少明确的原子清空操作
- `--ac`/`--acceptance-criteria` 语义不清晰

## 解决方案

- `src/markdown/structured-sections.ts`：将 regex 哨兵匹配替换为 tokenizer + 区间解析器（tokenize 所有已知哨兵、屏蔽外来族区间、配对 AC/DoD 标记、对歧义结构 fail-closed）
- `--ac`/`--acceptance-criteria` 在 task edit 中保持叠加别名（task create 不变）；新增 `--clear-ac` 通过 `acceptanceCriteriaSet=[]` 原子清空并拒绝与其它 AC 变更选项组合
- 为 `TaskEditArgs`、MCP task_edit schema、handler 增加 `acceptanceCriteriaClear` 布尔字段；`toAcceptanceCriteriaEntries` 对空数组返回空列表使清空真正生效
- 更新 agent/CLI/MCP 指南说明 clear-then-add 工作流

## 实现位置

- `src/markdown/structured-sections.ts`、`src/cli.ts`、`src/utils/task-edit-builder.ts`
- `src/mcp/utils/schema-generators.ts`、`src/mcp/tools/tasks/handlers.ts`
- 指南 `agent-guidelines.md`、`cli-instructions/task-execution.md`、`mcp/task-execution.md` 等

## 测试

`src/test/acceptance-criteria.test.ts`、`markdown.test.ts`、`mcp-tasks.test.ts` 聚焦测试 118/118 通过。

## Related Concepts
- [[concepts/markdown-pipeline]] — 结构化章节解析
- [[concepts/task-lifecycle]] — AC/DoD 字段
- [[concepts/cli-entry]] — task edit 选项

## Related Sources
- [[sources/back-530-append-description]] — task edit 追加

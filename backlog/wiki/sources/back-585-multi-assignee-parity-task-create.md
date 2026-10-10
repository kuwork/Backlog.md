---
title: BACK-585 - task create 多负责人对齐
labels: [source, cli]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-585 - Multi-assignee-parity-for-task-create.md
---

# BACK-585 - task create 多负责人对齐

修复 task create/draft create 把 `-a "@a,@b"` 存成一个字面负责人，而 task edit 会解析逗号分隔输入的问题。create/draft 现在经共享 `parseDelimitedStringList` helper 路由负责人，且 `-a` 可重复，与之前的 --labels 修复对齐。

## 实现要点

- 在 `src/cli.ts` 中为 task create、task edit 和 draft create 的 -a/--assignee 注册 `createMultiValueAccumulator`；逗号分隔值经 `parseDelimitedStringList` 拆为独立负责人。
- 用 `parseDelimitedStringList` 替换 create/draft 中重复的内联标签拆分（行为相同，因为 createTaskFromInput 已对 labels 运行 normalizeStringList）。
- 保留 BACK-584 的 --unassign 防护和空 -a 校验；edit 路径已用 `parseClearableStringList`，只需注册可重复。
- 审计：任务创建向导（`src/commands/task-wizard.ts` 的 `parseListInput`）和 MCP task_create/task_edit（JSON 数组）已支持多负责人——无需改动。
- 文档：`src/guidelines/cli-instructions/task-creation.md`、`drafts.md`、`task-execution.md` 更新；限定测试 20 pass / 0 fail。

## 验收标准

- 逗号分隔负责人在 create 和 draft create 上解析为独立负责人；重复的 -a 在三个命令上都收集；与 task edit 的共享 helper 对齐；测试覆盖两种输入形式。

## Related Concepts

- [[concepts/cli-entry]] — commander 选项注册模式（多值累加器）
- [[concepts/task-identity]] — 与 BACK-584 取消分配工作共享的负责人列表语义

## Related Sources

- [[sources/back-584-explicit-unassign-across-surfaces]] — 本任务保留的 --unassign 防护

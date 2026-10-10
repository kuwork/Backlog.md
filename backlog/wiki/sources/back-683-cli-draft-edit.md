---
title: BACK-683 - CLI 草稿编辑对齐 Web 看板
labels: [source, cli, drafts]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-683 - Add-draft-editing-to-the-CLI-aligned-with-the-web-boards-draft-editing.md
---

# BACK-683 - CLI 草稿编辑对齐 Web 看板

Web 看板已能编辑草稿（向任务更新端点发 `DRAFT-` id 会落入 `core.editTaskOrDraft`），但 CLI 止于 list/create/view/archive/promote。本任务新增 `backlog draft edit`，与 `task edit` 共享完全相同的字段选项面，只有一个刻意差异：草稿不能从 CLI 获得真实状态——提升仍是显式的 `draft promote` 步骤。

- `src/cli.ts`：`task edit` 背后的字段选项链移入 `addEditFieldOptions(command)`，选项到参数的映射移入 `buildEditArgs(core, options, kind, id)`；移动经逐 flag 验证（56 个选项、92 条帮助条目）与 HEAD 完全一致，两条命令不可能漂移
- 打印并设置 `process.exitCode` 的映射守卫现在改为抛出、由调用方打印 `error.message`——stderr 文本相同（函数无法替调用方 `return`）；`buildEditArgs` 把 id 作为参数接收以用于需要它的消息
- 新 `draft edit [taskIds...]`：折叠重复 id、拒绝批次（CLI 层检查而非 `allowExcessArguments`，因为消息有教学作用）、要求至少一个字段 flag、经现有 fail-closed 草稿解析器解析、经 `core.updateDraftFromInput` 应用、打印 `Updated draft DRAFT-n` 或带 `--plain` 打印记录
- 状态规则：`--status` 只接受 Draft，否则指向 `backlog draft promote`——不同于从状态变更提升的 Web/MCP 路径——因为藏在编辑里的提升在脚本中是意外
- `loadDraftOrReport` 现在对缺失草稿设置 `process.exitCode = 1`，只读草稿命令继承该行为
- 指南更新：`src/guidelines/cli-instructions/drafts.md`（"Editing a draft" + 关键规则）、`CLI-INSTRUCTIONS.md` 草稿流行、命令帮助示例
- 测试：`src/test/cli-draft-edit.test.ts` 8 个新用例；七个 `task edit` 套件 108 用例绿作为重构安全网；六变体回退矩阵带 task-edit 对照；在仓库外项目上实测。注：`Task` 携带 `acceptanceCriteriaItems` 而非 `acceptanceCriteria`

## 验收标准

- `draft edit` 经 Core 草稿入口应用与 `task edit` 相同的字段 flag，文件里保留 `status: Draft`
- 字段选项与映射与 `task edit` 共享，不重复
- 非 Draft `--status` 被拒并给 promote 指引，exit 1，文件逐字节一致；未知 id、任务 id、批次与歧义身份全部 fail-closed 且无写入
- `--plain` 打印更新后的记录；随附指南教学该命令

## Related Concepts
- [[concepts/cli-entry]] — CLI 命令注册与共享选项管道
- [[concepts/cli-instructions]] — 更新以教学该命令的指南面
- [[concepts/task-lifecycle]] — 状态规则保护的草稿→任务提升边界

## Related Sources
- [[sources/back-532-cli-draft-workflow-guides]] — 同一命令家族上的早期草稿工作流指南工作
- [[sources/demote-to-draft-action]] — 草稿生命周期上的反向转换

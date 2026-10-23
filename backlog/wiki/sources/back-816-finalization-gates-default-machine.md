---
title: BACK-816 - 收尾门禁同步进默认状态机
labels: [source, config, state-machine]
created_date: 2026-10-23 17:20
updated_date: 2026-10-23 17:20
source_path: backlog/tasks/back-816 - Sync-finalization-gates-into-default-state-machine.md
---

# BACK-816 - 收尾门禁同步进默认状态机

把定稿的 task-finalization 收尾门禁同步进 `backlog init` 写入的默认状态机，让新项目开箱即带。

## 背景

定稿后的 `backlog/config.yml` 给两条边加了门禁：

- `In Progress → In Review`：`requires` 任务文件按 task-finalization 完成
- `In Review → Done`：`requires` 任务文件按 task-finalization 验收通过

但 `backlog init` 写入的默认机器来自 `DEFAULT_STATE_MACHINES`（`src/web/locales/*`），仍是旧的 `finalSummary` 非空门禁，且缺 `In Review → Done` 的 `requires`——新项目因此拿不到门禁。

## 改了什么

更新四语言（zh-CN / en / ja / zh-TW）默认机器：

- `In Progress → In Review` 的 `when` 收紧为"实际工作完成"事件，`requires` 改为 task-finalization 完成措辞
- `In Review → Done` 补上"按 task-finalization 验收通过"的 `requires`（此前缺失）

仅本地化 `when`/`if`/`requires`/`evidence` 散文，状态名与分类不变。验证：`defaultStateMachineForLocale` 直接调用断言 `ALL_GATES_PRESENT`，`tsc --noEmit` 与 119 个 state-machine + init + 编辑器测试通过。

## Related Concepts

- [[concepts/state-machine]] — 状态机语义与默认七列机器
- [[concepts/task-lifecycle]] — 收尾门禁如何约束任务流转

## Related Sources

- [[sources/doc-19-default-state-machine-prd]] — 默认七列状态机 PRD
- [[sources/back-715-state-machine-editor-settings]] — 设置页编辑器与状态机编译器

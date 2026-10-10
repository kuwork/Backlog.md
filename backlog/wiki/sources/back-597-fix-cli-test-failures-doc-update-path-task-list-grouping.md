---
title: BACK-597 - 修复 doc update 路径与任务列表分组的既有测试失败
labels: [source, bug, cli, tests]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-597 - Fix-two-pre-existing-CLI-test-failures-in-doc-update-path-and-task-list-grouping.md
---

# BACK-597 - 修复 doc update 路径与任务列表分组的既有测试失败

BACK-596 评审期间在 `src/test/cli.test.ts` 发现两个失败，并在 HEAD 上复现为预先存在的 fork bug：`doc update -p` 路径移动断言与 `task list --plain --limit` 状态分组断言。两者最终都是测试侧缺陷而非产品 bug：Bun shell 插值会丢弃真实换行之后的参数，分组测试假设的排序/限制顺序与已实现（正确）行为不同。

- Doc update 失败根因：测试在 Bun shell 插值内传了真实换行；Bun shell 丢弃换行后的参数，`-p runbooks` 因此从未到达 CLI。修复方式是在插值前把换行转义为字面反斜杠-n 序列（与 doc-content-newlines.test.ts 同模式）；`saveDocument` 本身改名一直正确。
- 任务列表分组：确认默认 `--plain` 排序为 `sortByOrdinal`（ordinal 然后任务 ID），与 web All Tasks 列表一致；`--limit N` 在按状态分组前应用于全局排序列表。显式 `--sort priority` 使用优先级顺序。
- 测试期望已更新以反映默认（ordinal）与 priority 排序两种行为；无需改源码。
- 验证 `bun test src/test/cli.test.ts` 92/92 通过，外加类型检查与 biome。

## 验收标准

- `doc update doc-1 -p runbooks` 在测试中把文件物理移动到 `backlog/docs/runbooks/`。
- `task list --plain --limit 1` 按配置的状态顺序打印分组，而非只打印第一个分组。

## Related Concepts

- [[concepts/cli-entry]] — task list 与 doc update 命令的 CLI flag 处理与 plain 输出分组语义。
- [[concepts/task-lifecycle]] — 任务列表的状态分组与 ordinal 排序顺序。

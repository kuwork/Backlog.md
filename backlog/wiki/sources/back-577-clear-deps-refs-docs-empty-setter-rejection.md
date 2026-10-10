---
title: BACK-577 - task edit 清空列表与拒空值
labels: [source, migration, cli, mcp, bug]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-577 - Add-clear-deps-clear-refs-clear-docs-to-task-edit-and-reject-empty-list-setter-values.md
---

# BACK-577 - task edit 清空列表与拒空值

修复静默的无效果编辑：`task edit` 中空的 `--dep`/`--ref`/`--doc` 值会让列表保持不变并以 0 退出——虚假成功。为 task edit 新增显式的 `--clear-deps`/`--clear-refs`/`--clear-docs` 标志清空这些列表，并让 task create 和 task edit 都拒绝空 setter 值（edit 的错误指向匹配的 `--clear-*` 标志）。MCP `task_edit` 现在拒绝含空字符串元素的数组；只有显式空数组 `[]` 才清空列表。合并三个上游任务（BACK-572/586/618）。

## 实现要点

- `src/cli.ts`：`task edit` 新增 `--clear-deps`/`--clear-refs`/`--clear-docs` 选项；共享校验器 `validateClearableListInput` 和 `validateTaskListFlags` 对 create 和 edit 都拒绝空 setter 值、拒绝 clear 与 setter 冲突，并纳入交互式 TTY edit 谓词，使带标志的编辑直接生效而不是打开向导。
- `src/utils/task-edit-builder.ts`：`sanitizeClearableStringArray` 拒绝含空字符串元素的数组；显式 `[]` 清空列表；deps/refs/docs 全部经它路由。
- `src/utils/task-builders.ts`：`parseClearableStringList` 保留给 CLI 解析。
- 与上游的刻意分歧：fork 在 edit 中拒绝空 setter 值（错误指向 `--clear-*`），而不是上游后来的 `emptyClears` 行为（显式空值等于清空）——选择保持 fork 列表 setter 语义一致（记录在 doc-10 CLI-4）。
- MCP：`task_edit` 拒绝 references/documentation/dependencies 数组中的空字符串元素；显式 `[]` 清空。
- 测试在 `src/test/cli-dependency.test.ts`、`src/test/cli-refs-docs.test.ts`、`src/test/mcp-tasks.test.ts`、`src/test/mcp-refs-docs.test.ts` 中，覆盖 clear 标志、空值拒绝、setter/clear 冲突、create 错误、纯空白与显式空数组语义。构建成功到替代输出路径，因为 `dist/backlog.exe` 被运行中的进程锁定。

## 验收标准

- `--clear-deps`/`--clear-refs`/`--clear-docs` 各自清空对应列表。
- task edit 拒绝空的 `--dep`/`--depends-on`/`--ref`/`--doc` 值并提示匹配的 `--clear-*` 标志；task create 仍拒绝空值。
- clear 标志不能与同字段的 setter 标志组合；非法输入使任务保持不变。
- MCP `task_edit` 拒绝空字符串元素；显式 `[]` 清空；deps/refs/docs 使用共享校验器。

## Related Concepts

- [[concepts/cli-entry]] — task edit 的选项定义、帮助模式和 TTY 谓词
- [[concepts/mcp-workflow]] — MCP task_edit 与 CLI 共享同一校验 helper
- [[concepts/task-lifecycle]] — 任务模型上的 dependencies/references/documentation 字段

## Related Sources

- [[sources/back-578-task-edit-list-set-add-remove-flags]] — 在这些校验器之上新增 --add-*/--remove-* 的后续任务（同批次）
- [[sources/doc-10-upstream-v1-49-3-to-v1-50-1-migration-analysis-by-domain]] — CLI-4 记录与上游的空值拒绝分歧
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — 条目 B3/B22 把该数据正确性簇归为一个波次

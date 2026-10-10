---
title: BACK-578 - task edit 列表 set/add/remove 语义
labels: [source, migration, cli, task-editing]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-578 - Unify-task-edit-ref-doc-dep-as-set-and-add-add-remove-flags.md
---

# BACK-578 - task edit 列表 set/add/remove 语义

统一 task edit 的 references、documentation 和 dependencies 列表字段语义：`--ref`/`--doc`/`--depends-on`/`--dep` 现在替换整个列表（set 语义），而新的 `--add-ref`/`--add-doc`/`--add-depends-on`/`--add-dep` 追加到现有值。set 与 add 标志在同一命令中互斥；`--clear-*` 仍是显式清空操作，`--remove-*` 按值移除特定条目。

## 实现要点

- `src/cli.ts`：`--ref` 映射 `references`、`--doc` 映射 `documentation`、`--depends-on`/`--dep` 映射 `dependencies`，在 task edit 上是 set/替换操作；新的 `--add-*` 选项映射 `addReferences`/`addDocumentation`/`addDependencies`，为追加语义。
- `validateTaskListFlags` 扩展了按标志的空白值和 clear 冲突检查，覆盖新的 `--add-*` 和已有的 `--remove-*` 标志；互斥校验阻止同一命令组合 `--ref` 与 `--add-ref`（等）。
- 新标志加入选项定义、帮助模式和 `hasEditFieldFlags`，使带任何 set/add/remove/clear 标志的 TTY 直接生效而不是打开编辑向导。
- `--remove-ref`/`--remove-doc`/`--remove-dep` 按值移除条目，接受重复出现和逗号分隔值，拒绝空值并非零退出、任务保持不变。
- 更新 `src/guidelines/agent-guidelines.md`（set/add/remove 示例）和 `src/guidelines/cli-instructions/task-execution.md`。
- `src/test/cli-refs-docs.test.ts` 和 `src/test/cli-dependency.test.ts` 中的回归测试覆盖 set 语义、add 语义、remove 语义、重复/逗号形式、空白拒绝、clear 冲突、set/add 互斥和交互式 TTY 路径。

## 验收标准

- remove 标志按值删除且不影响无关条目；所有列表标志接受重复和逗号分隔形式；空 remove 值被拒绝。
- `--clear-*` 不能与匹配的 setter/add/remove 标志组合；非法输入不修改任务。
- set 标志替换列表、add 标志追加、set/add 互斥；TTY 谓词包含新标志；帮助文档化全部 12 个标志。

## Related Concepts

- [[concepts/cli-entry]] — task edit 标志定义与校验漏斗
- [[concepts/task-lifecycle]] — references/documentation/dependencies 列表字段

## Related Sources

- [[sources/back-577-clear-deps-refs-docs-empty-setter-rejection]] — 引入本任务扩展的共享校验器（同批次）
- [[sources/back-556-task-edit-append-plan]] — 追加类编辑标志 `--append-plan` 的先例
- [[sources/back-530-append-description]] — description 上相关的 set/append 语义

---
title: BACK-649 - 列表视图统一共享任务 ID 排序
labels: [source, tui, core]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-649 - Sort-the-TUI-list-view-through-the-shared-task-ID-comparator.md
---

# BACK-649 - 列表视图统一共享任务 ID 排序

超过九个子任务时，看板按数字排序（1.9 在 1.10 之前），而看板的任务列表视图却按字母排序（issue 953）。分歧不在视图：`TaskIdentityIndex.getTasks()` 用 `id.localeCompare` 排列身份分组，`Core.loadTasks()` 把该顺序原样返回给视图。现在一行改动让语料读取器走共享的 `compareTaskIds`。移植自上游 BACK-674。

- 改代码前先复现：一个临时项目中 TASK-1 加按倒序创建的 1.1–1.11 子任务显示 CLI plain/JSON、`queryTasks()` 和 `filesystem.listTasks()` 已是数字序，而 `Core.loadTasks()` 是字母序——`ContentStore` 一直用 `sortByTaskId` 重排掩盖了索引顺序
- 根因：`TaskIdentityIndex.getTasks()` 用了 `id.localeCompare`，即第二个临时 ID 比较器；现在改用 `src/utils/task-sorting.ts` 的共享 `compareTaskIds` 排序，消除重复比较器而不是再加第三个排序
- 列表视图（`task-viewer-with-search.ts`）刻意保持不排序：其他所有入口都传给它已排好序的数组，在视图内排序会覆盖 `task list --sort` 及其 ordinal 默认值
- 刻意保留的排序不动：看板 ordinal 排序与父子分组、CLI `--sort` 及其 ordinal 默认、Web 列表默认；`src/ui/board.ts` 只给 `prepareBoardColumns` 加了一个导出，让回归测试读到真实看板列
- 新的 `src/test/subtask-ordering-consistency.test.ts` 断言看板语料、其他语料读取器、真实看板列、Web 列表比较器与 CLI plain/JSON 给出完全一致的 ID 顺序；回退该比较器会让三个一致性用例加身份索引单元用例变红
- 工具备注：一个既有的 `useTemplate` lint 错误在独立提交中修复，以保持 `bun run check .` 有意义；一次把被改文件转成 CRLF 的 Python 写入已被归一化回 LF

## 验收标准

- 看板语料按数字序排列层级 ID（TASK-1.9 在 TASK-1.10 之前），与看板列一致
- 排序来自现有的共享比较器，不存在第二份实现
- 看板 ordinal/分组、`task list --sort` 与 Web 列表默认保持不变
- 看板语料、CLI plain/JSON 与 Web 列表比较器对子任务顺序给出完全一致的结果

## Related Concepts

- [[concepts/task-identity]] — 共享 `compareTaskIds` 作为唯一 ID 排序权威
- [[concepts/cli-tui]] — 消费语料的看板与统一视图界面
- [[concepts/upstream-migration]] — 移植自上游 BACK-674（commit 49e2f5d1a）

## Related Sources

- [[sources/back-542-ordinal-task-list-sort]] — 保持为刻意默认的 ordinal 排序
- [[sources/subtask-grouping-fix]] — BACK-496 看板/列表视图子任务分组
- [[sources/back-567-cross-branch-task-identity]] — 该比较器修复所在的身份索引

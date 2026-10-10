---
title: BACK-691 - 归档完成降级本地优先并清理空置引用
labels: [source, cli, task-lifecycle, core]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-691 - Make-task-archive-complete-and-demote-local-first-like-view-and-edit.md
---

# BACK-691 - 归档完成降级本地优先并清理空置引用

archive、complete 和 demote 过去通过跨分支语料加载器解析目标，为工作副本本可直接解析的目标触发全量存储刷新。另一个问题：释放任务 ID 后留下指向它的过期依赖/引用——一旦释放的编号被重新分配给不相关的任务就很危险。本任务让三个命令全部本地优先，并清理工作副本与 completed 语料中指向已腾空 ID 的引用。

## 解决方案

- Core：`sanitizeArchivedTaskLinks` 更名为 `sanitizeVacatedTaskLinks`；`collectVacatedIdCleanup` 同时扫描活动工作副本与 completed 语料；活动依赖方经 `updateTasksBulk` 处理，completed 依赖方经 `fs.saveTask` 原地重写（保留 filePath，无 `onStatusChange` 副作用）
- `archiveTask`/`demoteTask` 接受可选 `TaskMutationOptions`：`includeCrossBranch=false` 通过工作副本索引解析目标，歧义时 fail-closed 报 `AmbiguousTaskIdError`；`onVacatedIdCleanup` 上报变更的任务 ID，且不改变既有返回形状（boolean / 新草稿 id）
- `demoteTaskWithUpdates`（`task edit -s Draft`）在其锁区间内运行同样的清理，并净化降级的草稿，使自命名链接不会混入草稿；降级时引用被移除而非重写为新草稿身份
- `completeTask` 不做清理——已完成的依赖正是 readiness 读取所需
- 各面：CLI archive/complete 预检以 `includeCrossBranch: false` 解析；CLI/MCP 打印一行清理信息，服务器 DELETE/demote 响应携带附加的 `cleanedTaskIds` 字段，TUI 页脚追加清理的 ID；`commitWrittenFile` 新增 `alsoWrittenPaths` 列表，使提交覆盖被清理的文件
- 测试：`src/test/vacated-task-references.test.ts`（7 个用例）固定误绑定回归（archive/demote、重新分配腾出的 ID、断言无依赖方被静默解析）、completed 语料清理、降级清理、编辑路径降级、complete 不清理、fail-closed 歧义；四个定向原地还原确认恰好区分的用例在修复前失败

## 验收标准

- archive、complete、demote 在 CLI 预检与 core 变更边界都本地优先解析目标，并保留 fail-closed 歧义
- 归档或降级从工作副本与 completed 语料中每个依赖方的 dependencies 与 references 中移除腾出的 ID
- complete 绝不移除引用
- 清理的任务 ID 上报到每个面，且不改变既有 core 返回形状
- 回归测试覆盖误绑定场景，还原检查可区分本修复

## Related Concepts

- [[concepts/task-lifecycle]] — archive/complete/demote 语义与腾空 ID 清理
- [[concepts/task-identity]] — ID 回收与 fail-closed 歧义防护
- [[concepts/core-architecture]] — 共享清理的所在位置，使每个面都继承它

## Related Sources

- [[sources/back-538-duplicate-task-id-recovery]] — 重复 ID 恢复与 fail-closed 身份
- [[sources/back-567-cross-branch-task-identity]] — 这些命令绕过的跨分支解析
- [[sources/back-600-query-tasks-local-fast-path]] — 应用于读路径的本地优先解析方向
- [[sources/demote-to-draft-action]] — 其编辑路径现在同样清理引用的降级动作

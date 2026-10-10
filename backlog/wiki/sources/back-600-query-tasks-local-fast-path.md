---
title: BACK-600 - 常用任务命令避免无谓跨分支工作
labels: [source, cli, performance]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-600 - Make-common-task-commands-avoid-unnecessary-cross-branch-work.md
---

# BACK-600 - 常用任务命令避免无谓跨分支工作

即使调用方传 `includeCrossBranch: false`，`queryTasks` 仍会初始化跨分支 ContentStore，因此每个仅本地的列表（task list、交互选择器、父任务存在性检查、MCP task_list）在结果过滤到工作副本之前，都先为远程抓取与其他分支语料扫描付出代价。本任务新增本地快路径，直接从文件系统加载工作副本任务，跳过全部 Git 工作，同时保持结果集与排序完全一致。

- `src/core/backlog.ts` 的 `queryTasks` 中，`includeCrossBranch: false` 分支在任何 ContentStore 访问之前运行：任务经 `this.fs.listTasks()` 加载并流经既有 `applyFiltersAndLimit` helper，仅本地列表永不初始化 ContentStore、抓取远程或枚举分支。
- 快路径的自由文本搜索分支使用 `src/utils/task-search.ts` 的 `createTaskSearchIndex`，而非启动 SearchService。
- 默认作用域查询保持完整 ContentStore 语义；单任务查找保持本地优先解析与活动窗口回退（fail-closed 行为不变）。
- 新 `src/test/query-tasks-local-fast-path.test.ts`（6 个测试）把 `Core.loadTasks` 打桩为抛错，证明快路径在不依赖它的情况下完成解析/过滤/限制/搜索，断言与 store 支撑结果集的一致性，并证明默认作用域查询仍需要 store。
- 真实仓库冒烟：`task list --plain` 列出 305 个任务，含 Bun 启动约 0.85s 墙钟时间。

## 验收标准

- `includeCrossBranch: false` 的 `queryTasks` 经文件系统加载器加载工作副本任务，不初始化 ContentStore、不抓取远程、不枚举分支。
- 快路径输出与先加载后过滤的旧行为一致（相同任务集、排序、过滤、搜索、limit）。
- 不带 flag 的调用保持 ContentStore 语义；测试证明 Git 操作边界。

## Related Concepts

- [[concepts/core-architecture]] — 绕过跨分支语料的查询层快路径，用于仅本地作用域。
- [[concepts/cli-entry]] — 仅本地 CLI 列表（task list、选择器）是主要受益者。

## Related Sources

- [[sources/back-602-incremental-cross-branch-task-loading]] — 后续任务使跨分支路径本身快速且增量，与本快路径互补。
- [[sources/back-601-core-browser-publication-ownership]] — 跨分支加载架构同一 B16 迁移项的组成部分。

---
title: BACK-602 - 共享跨分支任务加载提速与增量化
labels: [source, cli, server, web, performance]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-602 - Make-shared-cross-branch-task-loading-fast-and-incremental.md
---

# BACK-602 - 共享跨分支任务加载提速与增量化

跨分支任务读取反复抓取、枚举、索引、水合、解析同一 Git 语料，使分支众多的仓库中 browser 启动、MCP 任务操作与全局任务视图变慢。本任务移植上游 BACK-624（commit `94c10a6`），用不可变分支末梢快照加共享缓存架构取代先索引后水合的加载器，热跨分支读取从约 394 次 Git 操作降到 ≤3 次。

- `src/git/operations.ts`：`GitBranchTip` + `listRecentBranchTips`（一次 for-each-ref）、`listWorktreePaths`、`resolveCommit`、记忆化 `isRepository`、合并的有界抓取（10s 硬超时、进程组 kill、`GIT_TERMINAL_PROMPT=0`/`GCM_INTERACTIVE=Never`）、`execGit` 超时支持、`getBranchLastModifiedMap` 的 Date `since`。
- `src/core/task-loader.ts`：全面重写为 `BranchTaskLoader`，带以 commit SHA 为键的 commit 索引与任务/blob 缓存、`retainSnapshot`、带防御性克隆的不可变 commit 读取。
- `src/core/backlog.ts`：`ActiveBranchSnapshot` 指纹仅从安装 store 的加载发布、任务 ID 分配时 `forceRemoteRefresh`（绕过 60s 合并刷新窗口，避免两个克隆发出相同数字 ID）、60s 读取时引用租约（`refreshRemoteRefsForTaskRead`/`refreshTasksForTaskRead`）、项目代重试循环、`loadTasksWithStableBranchSnapshot`/`loadTaskCorpusSnapshot`/`loadContentStoreCorpus`/`loadWorkingCopyTasks`、worktree 状态条目、`buildTaskIdentityIndex`。
- `src/core/content-store.ts`：快照新增 `branchStateEntries`/`config`、`mergeConcurrentTaskCorpus`、`hasTaskListChanged`、`needsBranchFallbackHydration`、`hasBranchTaskStateChanged`、`transitionTask` generation 自增、经 `resolveForRead`/`resolveForMutation` 的 `resolveInSnapshot`；`src/core/task-identity-index.ts` 新增 `resolveForRead`/`resolveForMutation`。
- `src/file-system/operations.ts`：精确内容任务解析缓存，带防御性克隆与有界读取并发。
- 各界面：MCP `task_search` 经 `loadWorkingCopyTasks` 路由（无 Git 本地语料）；server `handleListTasks`/`handleSearch`/`handleGetStatistics` 使用刷新/语料快照路径；仅文档/决策搜索跳过任务刷新。
- 正确性门控基准（`scripts/benchmark-task-loading.ts`）：Core `loadTasks` 热态 = 3 次 Git 操作（原 394），MCP `taskSearch` 热态 = 0（原 394），web `taskList` 热态 = 0（原 395）；每个样本校验精确计数、ID、哨兵值与稳定摘要。
- Fork 适配：丢弃 3 个不兼容的上游测试（server-statistics-endpoint、server-tasks-spa-fallback、重复发现语料测试）；cli-dependency 文件超时提高到 20s 以容纳新的创建路径跨分支开销；新增回归套件（shared-branch-task-loader、filesystem-task-cache、branch-task-loader-resilience、core-task-corpus-regressions、worktree-refresh）。

## 验收标准

- 不可变末梢快照与分支末梢 generation 把跨分支读取钉到单一不可变代。
- Commit/blob 共享缓存与精确内容解析缓存复用未变化的分支数据。
- 仅安装 store 的加载发布指纹，ID 分配走 `forceRemoteRefresh`。
- 合并的有界抓取（10s 超时、非交互环境）与 60s 读取时引用租约刷新。
- MCP `task_search` 路由到无 Git 本地语料；基准场景下热跨分支读取 ≤3 次 Git 操作。

## Related Concepts

- [[concepts/core-architecture]] — 不可变末梢快照、publication-owner generation 与共享缓存构成的跨分支加载架构。
- [[concepts/browser-loading]] — browser/web 任务列表热读取复用共享语料而非重建分支索引。
- [[concepts/mcp-server]] — MCP task_search 的无 Git 本地语料路径。

## Related Sources

- [[sources/back-601-core-browser-publication-ownership]] — 本任务依赖的 publication-owner 基础。
- [[sources/back-600-query-tasks-local-fast-path]] — queryTasks 中互补的仅本地快路径。
- [[sources/back-567-cross-branch-task-identity]] — 增量加载器必须保持的跨分支任务身份模型。

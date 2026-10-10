---
title: BACK-601 - 补齐 Core browser 边界的 publication 所有权
labels: [source, cli, server, web, core]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-601 - Complete-Core-browser-boundary-with-publication-ownership.md
---

# BACK-601 - 补齐 Core browser 边界的 publication 所有权

BACK-568 给 ContentStore 留下的轻量语料快照缺少上游 publication-owner 机制。本任务把完整 publication 所有权体系（根 watcher epoch、内容条目 generation/版本、并发刷新合并、publication 入队）回填进 `src/core/content-store.ts`，使内存 publication 胜过并发磁盘刷新，为 BACK-602 的增量跨分支加载打下稳定基础。

- 在 `src/core/content-store.ts` 采用 publication-owner 核心：根 watcher epoch、`contentItemGenerations`/`contentItemVersions`/`publicationRoots`（覆盖 tasks/documents/decisions）、`mergeConcurrentChanges`、`enqueueRoot`/`enqueuePublication`、`reconcileOrSchedule`、`reconcileRenamedItem`、`findIdentityCandidate` 及 epoch 感知的目录 watcher。
- 配置监视切换到 `src/utils/config-watcher.ts` 的 `watchConfigFile`，新增 `"config"` ContentStoreEvent；`src/server/index.ts` 的 `store.subscribe` 处理它：更新 projectName、广播 `config-updated` 并使统计失效。
- 在新机制之上保留 fork 特性：wiki 支持（快照、`"wikis"` 事件、容忍 wiki 目录缺失的 watcher）、task-loader 进度回调、异步 `getTaskCorpusSnapshot`、返回 `TaskResolution` 的异步 `resolveTaskForRead`/`resolveTaskForMutation`、`getTasks` 数组过滤、fail-closed 409 语义。
- 文件系统补丁用 `normalizeTaskIdentity` 规范化保存的任务并把 `PublicationOwner` 传给更新 handler；watcher 驱动的 `tasks-updated` 广播与重排原子性不变。
- 新增 publication-owner 并发重载回归测试到 `src/test/content-store-publication.test.ts`（scoped 运行 28 pass）。

## 验收标准

- 回填缺失的 publication-owner / contentItemVersions / batchTaskUpdates / transitionTask 机制，不回归 fail-closed 409 行为或 watcher 驱动广播。
- 确定性测试覆盖 publication 所有权、批量流转与热语料对账。
- Server 更新/创建 handler 仍经 `core.getTask` 路由，并在 `AmbiguousTaskIdError` 时返回 409。

## Related Concepts

- [[concepts/core-architecture]] — publication-owner 版本机制：经 generation 与 epoch 使内存 publication 胜过并发磁盘刷新。
- [[concepts/web-server]] — server 订阅新配置事件并广播、使统计失效。

## Related Sources

- [[sources/back-568-core-browser-task-boundary]] — 本任务以 publication-owner 基础补齐的轻量 ContentStore 边界。
- [[sources/back-602-incremental-cross-branch-task-loading]] — 直接依赖方，在本基础之上构建增量跨分支加载。

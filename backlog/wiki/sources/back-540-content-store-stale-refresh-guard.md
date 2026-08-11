---
title: BACK-540 防止过期 ContentStore 刷新覆盖新状态
labels: [source, core, concurrency, bug]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-540 - Prevent-stale-ContentStore-refresh-from-overwriting-newer-state.md
---

# BACK-540 防止过期 ContentStore 刷新覆盖更新状态

修复 ContentStore 中较旧异步刷新晚于较新持久化编辑完成、从而覆盖更新内存状态的竞态。

## 问题

较旧的异步刷新可能晚于较新的持久化编辑/upsert 完成，覆盖更新的内存状态，导致任务、文档、决策读后写不一致，影响搜索与列表视图。

## 解决方案

引入逐项发布版本守卫与条件合并。直接写入（`upsertTask`/`updateTaskFromDisk`/`updateDocumentFromDisk`/`updateDecisionFromDisk`）及 watcher 驱动的更新/删除都会递增对应逐项版本（`taskVersions`/`documentVersions`/`decisionVersions`/`wikiVersions`）；完整刷新路径（`refresh*FromDisk`）在读取前捕获版本，加载后经 `merge*` 合并——若项在加载期间被变更则丢弃过期快照。用 `?? 0` 处理未初始化版本，确保 init 后首次刷新仍合并真实外部变更。同步按 root/epoch 检查发布。加固 root 生命周期与外部 watcher 行为。

## 实现位置

- `src/core/content-store.ts`、`src/core/search-service.ts`

## 测试

`src/test/content-store.test.ts` 与 `src/test/search-service.test.ts` 新增确定性回归：旧刷新不覆盖新 upsert、旧文档刷新不覆盖新保存、刷新期间无关任务并发更新被保留、ABA 值循环被保留。

## Related Concepts
- [[concepts/core-architecture]] — ContentStore 缓存与刷新
- [[concepts/search-sequences]] — 搜索索引一致性

## Related Sources
- [[sources/back-538-duplicate-task-id-recovery]] — 数据一致性

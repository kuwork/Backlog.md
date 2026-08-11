---
title: ContentStore 用逐项版本守卫防止过期刷新
labels: [decision, core, concurrency]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
---

# ContentStore 用逐项版本守卫 + 条件合并防止过期刷新覆盖（BACK-540）

## 决策

ContentStore 引入逐项发布版本（`taskVersions`/`documentVersions`/`decisionVersions`/`wikiVersions`）：直接写入与 watcher 驱动的更新递增版本；完整刷新路径在读取前捕获版本，加载后经 `merge*` 合并——若项在加载期间被变更则丢弃过期快照。用 `?? 0` 处理未初始化版本。

## 理由

- 较旧异步刷新可能晚于较新持久化编辑完成，覆盖更新内存状态，造成读后写不一致
- 逐项版本守卫比全局锁更细粒度、无阻塞，允许并发读
- `?? 0` 保证 init 后首次刷新仍合并真实外部变更

## 拒绝的替代方案

- 全局锁/串行化刷新：降低并发性能，且不解决"旧刷新晚到"的时序
- 时间戳比较：时钟漂移与文件系统时间戳粒度不足

## 关联

- 相关任务：[[sources/back-540-content-store-stale-refresh-guard]]
- 相关概念：[[concepts/core-architecture]]

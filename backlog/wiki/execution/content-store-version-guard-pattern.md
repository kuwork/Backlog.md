---
title: ContentStore 版本守卫刷新合并模式
labels: [execution, core, concurrency]
created_date: 2026-08-09 00:00
updated_date: 2026-10-09 23:30
---

# ContentStore 版本守卫刷新合并模式

防止异步刷新晚于写入完成而覆盖新状态的标准做法，源自 BACK-540。

## 适用场景

- 内存缓存（ContentStore）既有完整刷新路径，又有直接写入路径（upsert / updateFromDisk / watcher 驱动的更新/删除）
- 较旧异步刷新可能晚于较新持久化编辑完成，造成读后写不一致

## 标准步骤

1. 为每类实体维护逐项版本 Map（`taskVersions`/`documentVersions`/`decisionVersions`/`wikiVersions`）
2. 直接写入与 watcher 更新/删除时递增对应项版本
3. 完整刷新路径（`refresh*FromDisk`）在读取前捕获版本快照
4. 加载后经 `merge*` 合并：若项版本在加载期间被变更则丢弃过期快照
5. 用 `?? 0` 处理未初始化版本，保证 init 后首次刷新仍合并真实外部变更
6. 同步按 root/epoch 检查发布，加固 root 生命周期与外部 watcher

## Related Concepts

- [[concepts/core-architecture]] — 核心架构与数据流

## Related Sources

- [[sources/back-540-content-store-stale-refresh-guard]] — BACK-540 过期刷新守卫任务

## Related Decisions

- [[decisions/content-store-version-guard]] — ContentStore 版本守卫决策
